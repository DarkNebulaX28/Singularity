import path from 'node:path';
import fs from 'node:fs';
import type { FastifyPluginAsync } from 'fastify';
import type { ServerLifecycleService } from '../../../servers/services/server-lifecycle.js';
import type { ProcessRunner } from '../../../process-supervisor/services/process-runner.js';
import type { AuthService } from '../../../auth-identity/services/auth-service.js';
import { createAuthHook, requireRole } from '../middleware/auth-hook.js';
import type { CreateServerInstanceOptions, ServerInstance } from '../../../servers/models/server-instance.js';
import type { PropertyValue } from '../../../servers/models/server-properties.js';
import { minecraftVersionsService } from '../../../servers/services/minecraft-versions.js';
import { BackupService } from '../../../backups/index.js';
import { FileManagerService } from '../../../file-manager/index.js';
import { IdeBridge } from '../../desktop/ide-bridge.js';
import {
  detectSystemRuntimes,
  inspectJavaBinary,
  isRuntimeCompatible,
  selectBestRuntime
} from '../../../java-manager/index.js';

export interface ServerRoutesOptions {
  serverLifecycle: ServerLifecycleService;
  processRunner: ProcessRunner;
  authService: AuthService;
  backupService?: BackupService;
  fileManagerService?: FileManagerService;
}

export const serverRoutes: FastifyPluginAsync<ServerRoutesOptions> = async (fastify, opts) => {
  const { serverLifecycle, processRunner, authService } = opts;
  const backupService = opts.backupService ?? new BackupService(serverLifecycle, processRunner);
  const fileManagerService = opts.fileManagerService ?? new FileManagerService(serverLifecycle);
  const authenticate = createAuthHook(authService);

  // Apply authentication to all server routes
  fastify.addHook('preHandler', authenticate);

  function checkServerPermission(request: any, serverId: string): boolean {
    if (!request.user || request.user.role === 'ADMIN') return true;
    const allowed = request.user.allowedServers || ['*'];
    return allowed.includes('*') || allowed.includes(serverId);
  }

  // Enforce granular server permission on all /:id subroutes
  fastify.addHook('preHandler', async (request, reply) => {
    const params = request.params as { id?: string } | undefined;
    if (params?.id && params.id !== 'versions') {
      if (!checkServerPermission(request, params.id)) {
        return reply.status(403).send({ error: 'Acceso denegado: No tienes permisos para gestionar este servidor' });
      }
    }
  });

  const BLOCKED_JVM_PREFIXES = [
    '-javaagent:',
    '-agentlib:',
    '-agentpath:',
    '-xx:onoutofmemoryerror',
    '-xx:onerror',
    '-xx:errorfile'
  ];

  function validateAndSanitizeJvmArgs(jvmArgs?: string[]): string[] {
    if (!Array.isArray(jvmArgs)) return [];
    const safeArgs: string[] = [];
    for (const raw of jvmArgs) {
      if (typeof raw !== 'string') continue;
      const arg = raw.trim();
      if (!arg) continue;
      if (!arg.startsWith('-')) {
        throw new Error(`Argumento JVM inválido '${arg}': Todos los flags deben comenzar con '-'`);
      }
      const lower = arg.toLowerCase();
      if (BLOCKED_JVM_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
        throw new Error(`Argumento JVM bloqueado por seguridad: '${arg}'`);
      }
      safeArgs.push(arg);
    }
    return safeArgs;
  }

  async function resolveCompatibleJavaExecutable(instance: ServerInstance): Promise<string> {
    const defaultFallback = process.platform === 'win32' ? 'java.exe' : 'java';
    let candidate = instance.javaPath?.trim();

    // Check if current configured binary exists and satisfies compatibility
    let currentRuntime = null;
    if (candidate && candidate !== 'java' && candidate !== 'java.exe' && fs.existsSync(candidate)) {
      currentRuntime = await inspectJavaBinary(candidate);
    } else {
      currentRuntime = await inspectJavaBinary(defaultFallback);
    }

    if (!currentRuntime || !isRuntimeCompatible(currentRuntime, instance.gameVersion)) {
      try {
        const detected = await detectSystemRuntimes();
        const best = selectBestRuntime(detected, instance.gameVersion);
        if (best) {
          if (instance.javaPath !== best.path) {
            await serverLifecycle.updateInstance(instance.id, { javaPath: best.path }).catch(() => {});
          }
          return best.path;
        }
      } catch {
        // ignore detection failure
      }
    }

    return currentRuntime?.path || candidate || defaultFallback;
  }

  // List all Minecraft versions with full metadata (VIEWER, OPERATOR, ADMIN)
  fastify.get<{
    Querystring: {
      includeSnapshots?: string;
      search?: string;
    };
  }>('/versions', async (request, reply) => {
    const includeSnapshots = request.query.includeSnapshots === 'true';
    const search = request.query.search;
    const versionsData = await minecraftVersionsService.getVersions({ includeSnapshots, search });
    return reply.status(200).send(versionsData);
  });

  // List all servers (VIEWER, OPERATOR, ADMIN)
  fastify.get('/', async (request, reply) => {
    const instances = await serverLifecycle.listInstances();
    const allowedInstances = (request.user?.role === 'ADMIN' || !request.user?.allowedServers || request.user.allowedServers.includes('*'))
      ? instances
      : instances.filter((srv) => request.user?.allowedServers.includes(srv.id));

    const withLiveStatus = allowedInstances.map((srv) => {
      const liveState = processRunner.getState(srv.id);
      return {
        ...srv,
        status: liveState ? liveState.status : srv.status,
        pid: liveState?.pid
      };
    });
    return reply.status(200).send(withLiveStatus);
  });

  // Create server instance (OPERATOR, ADMIN)
  fastify.post<{
    Body: CreateServerInstanceOptions;
  }>('/', { preHandler: [requireRole(['ADMIN', 'OPERATOR'])] }, async (request, reply) => {
    try {
      if (request.body.jvmArgs) {
        request.body.jvmArgs = validateAndSanitizeJvmArgs(request.body.jvmArgs);
      }

      if (request.body.javaPath && request.user?.role !== 'ADMIN') {
        const candidate = request.body.javaPath.trim();
        if (candidate !== 'java' && candidate !== 'java.exe') {
          const inspected = fs.existsSync(candidate) ? await inspectJavaBinary(candidate) : null;
          if (!inspected) {
            return reply.status(400).send({ error: 'Ruta de binario Java no válida o no autorizada' });
          }
        }
      }

      if (!request.body.javaPath) {
        try {
          const runtimes = await detectSystemRuntimes();
          const best = selectBestRuntime(runtimes, request.body.gameVersion);
          if (best) {
            request.body.javaPath = best.path;
          }
        } catch {
          // ignore detection error
        }
      }
      const created = await serverLifecycle.createInstance(request.body);
      return reply.status(201).send(created);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al crear instancia';
      return reply.status(400).send({ error: message });
    }
  });

  // Get server details
  fastify.get<{
    Params: { id: string };
  }>('/:id', async (request, reply) => {
    const instance = await serverLifecycle.getInstance(request.params.id);
    if (!instance) {
      return reply.status(404).send({ error: `Servidor '${request.params.id}' no encontrado` });
    }

    const liveState = processRunner.getState(instance.id);
    const players = processRunner.getPlayers(instance.id);
    const metrics = liveState && liveState.status !== 'offline' && liveState.status !== 'crashed'
      ? await processRunner.getMetrics(instance.id)
      : null;

    return reply.status(200).send({
      ...instance,
      status: liveState ? liveState.status : instance.status,
      pid: liveState?.pid,
      players,
      metrics
    });
  });

  // Delete server instance (ADMIN only)
  fastify.delete<{
    Params: { id: string };
  }>('/:id', { preHandler: [requireRole(['ADMIN'])] }, async (request, reply) => {
    const instance = await serverLifecycle.getInstance(request.params.id);
    if (!instance) {
      return reply.status(404).send({ error: 'Servidor no encontrado' });
    }

    // Stop process if running
    if (processRunner.getState(instance.id)?.status === 'online') {
      await processRunner.stopProcess(instance.id);
    }

    await serverLifecycle.deleteInstance(instance.id);
    return reply.status(200).send({ message: `Servidor '${instance.name}' eliminado correctamente` });
  });

  // Start server (OPERATOR, ADMIN)
  fastify.post<{
    Params: { id: string };
  }>('/:id/start', { preHandler: [requireRole(['ADMIN', 'OPERATOR'])] }, async (request, reply) => {
    const instance = await serverLifecycle.getInstance(request.params.id);
    if (!instance) {
      return reply.status(404).send({ error: 'Servidor no encontrado' });
    }

    try {
      const instanceDir = serverLifecycle.getInstanceDir(instance.id);
      const jarPath = path.join(instanceDir, 'server.jar');

      // Auto-download server.jar if missing and loader supports direct resolution
      if (!fs.existsSync(jarPath)) {
        const jarUrl = await minecraftVersionsService.resolveServerJarUrl(instance.gameVersion, instance.loader);
        if (jarUrl) {
          try {
            const res = await fetch(jarUrl);
            if (res.ok) {
              const buffer = Buffer.from(await res.arrayBuffer());
              await fs.promises.writeFile(jarPath, buffer);
            }
          } catch {
            // ignore download error and fall through to check
          }
        }
      }

      if (!fs.existsSync(jarPath)) {
        const errorMsg = `No se encontró el archivo server.jar para el servidor '${instance.name}'. Descárgalo desde el panel de control o sube tu jar mediante SFTP (:2022).`;
        return reply.status(400).send({
          error: errorMsg,
          message: errorMsg
        });
      }

      const executable = await resolveCompatibleJavaExecutable(instance);
      const args = [...(instance.jvmArgs || ['-Xms1G', `-Xmx${instance.memoryMb}M`]), '-jar', jarPath, 'nogui'];

      const state = await processRunner.startProcess(instance, {
        executable,
        args,
        cwd: instanceDir
      });
      return reply.status(200).send(state);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al iniciar servidor';
      return reply.status(500).send({ error: message });
    }
  });

  // Download or update server.jar for an instance (OPERATOR, ADMIN)
  fastify.post<{
    Params: { id: string };
  }>('/:id/download-jar', { preHandler: [requireRole(['ADMIN', 'OPERATOR'])] }, async (request, reply) => {
    const instance = await serverLifecycle.getInstance(request.params.id);
    if (!instance) {
      return reply.status(404).send({ error: 'Servidor no encontrado' });
    }

    try {
      const jarUrl = await minecraftVersionsService.resolveServerJarUrl(instance.gameVersion, instance.loader);
      if (!jarUrl) {
        const errorMsg = `Descarga automática no disponible directamente para loader '${instance.loader}'. Sube tu server.jar vía SFTP (:2022).`;
        return reply.status(400).send({
          error: errorMsg,
          message: errorMsg
        });
      }

      const instanceDir = serverLifecycle.getInstanceDir(instance.id);
      const jarPath = path.join(instanceDir, 'server.jar');
      const res = await fetch(jarUrl);
      if (!res.ok) {
        return reply.status(502).send({
          error: `Fallo al descargar server.jar desde el repositorio remoto (HTTP ${res.status})`
        });
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      await fs.promises.writeFile(jarPath, buffer);

      return reply.status(200).send({
        success: true,
        message: `server.jar descargado correctamente para ${instance.loader} ${instance.gameVersion} (${(buffer.length / (1024 * 1024)).toFixed(1)} MB)`
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al descargar jar';
      return reply.status(500).send({ error: message });
    }
  });

  // List detected host IDEs (Antigravity, VS Code, Cursor, Explorer)
  fastify.get('/ides', async (_request, reply) => {
    const ideBridge = new IdeBridge();
    const ides = await ideBridge.getAvailableIdes();
    return reply.status(200).send(ides);
  });

  // Open server instance directory in host IDE (ADMIN, OPERATOR)
  fastify.post<{
    Params: { id: string };
    Body?: { ide?: 'antigravity' | 'vscode' | 'cursor' | 'explorer' };
  }>('/:id/open-ide', { preHandler: [requireRole(['ADMIN', 'OPERATOR'])] }, async (request, reply) => {
    const instance = await serverLifecycle.getInstance(request.params.id);
    if (!instance) {
      return reply.status(404).send({ error: 'Servidor no encontrado' });
    }

    try {
      const ideBridge = new IdeBridge();
      const sftpHost = process.env['SINGULARITY_SFTP_HOST'] || '127.0.0.1';
      const sftpPort = parseInt(process.env['SINGULARITY_SFTP_PORT'] || '2022', 10);
      const result = await ideBridge.openInIde(instance.id, request.body?.ide, {
        isRemote: sftpHost !== '127.0.0.1' && sftpHost !== 'localhost',
        sftpHost,
        sftpPort,
        username: 'admin',
        serverName: instance.name
      });
      return reply.status(200).send(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al abrir editor';
      return reply.status(500).send({ success: false, ideUsed: 'none', error: message });
    }
  });

  // Stop server (OPERATOR, ADMIN)
  fastify.post<{
    Params: { id: string };
  }>('/:id/stop', { preHandler: [requireRole(['ADMIN', 'OPERATOR'])] }, async (request, reply) => {
    const instance = await serverLifecycle.getInstance(request.params.id);
    if (!instance) {
      return reply.status(404).send({ error: 'Servidor no encontrado' });
    }

    try {
      await processRunner.stopProcess(instance.id);
      return reply.status(200).send({ message: 'Señal de detención enviada' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al detener servidor';
      return reply.status(500).send({ error: message });
    }
  });

  // Restart server (OPERATOR, ADMIN)
  fastify.post<{
    Params: { id: string };
  }>('/:id/restart', { preHandler: [requireRole(['ADMIN', 'OPERATOR'])] }, async (request, reply) => {
    const instance = await serverLifecycle.getInstance(request.params.id);
    if (!instance) {
      return reply.status(404).send({ error: 'Servidor no encontrado' });
    }

    try {
      const instanceDir = serverLifecycle.getInstanceDir(instance.id);
      const jarPath = path.join(instanceDir, 'server.jar');

      if (!fs.existsSync(jarPath)) {
        const errorMsg = `No se encontró el archivo server.jar para el servidor '${instance.name}'.`;
        return reply.status(400).send({
          error: errorMsg,
          message: errorMsg
        });
      }

      const executable = await resolveCompatibleJavaExecutable(instance);
      const args = [...(instance.jvmArgs || ['-Xms1G', `-Xmx${instance.memoryMb}M`]), '-jar', jarPath, 'nogui'];

      await processRunner.stopProcess(instance.id);
      const state = await processRunner.startProcess(instance, {
        executable,
        args,
        cwd: instanceDir
      });
      return reply.status(200).send(state);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al reiniciar servidor';
      return reply.status(500).send({ error: message });
    }
  });

  // Send command to server console (OPERATOR, ADMIN)
  fastify.post<{
    Params: { id: string };
    Body: { command: string };
  }>('/:id/command', { preHandler: [requireRole(['ADMIN', 'OPERATOR'])] }, async (request, reply) => {
    const { command } = request.body || {};
    if (!command || typeof command !== 'string') {
      return reply.status(400).send({ error: 'El comando es requerido' });
    }

    const state = processRunner.getState(request.params.id);
    if (!state || state.status !== 'online') {
      return reply.status(400).send({ error: 'No se pueden enviar comandos a un servidor offline' });
    }

    try {
      processRunner.sendCommand(request.params.id, command);
      return reply.status(200).send({ message: 'Comando enviado' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al enviar comando';
      return reply.status(500).send({ error: message });
    }
  });

  // Get server.properties
  fastify.get<{
    Params: { id: string };
  }>('/:id/properties', async (request, reply) => {
    try {
      const config = await serverLifecycle.getProperties(request.params.id);
      return reply.status(200).send(config.properties);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al leer propiedades';
      return reply.status(500).send({ error: message });
    }
  });

  // Update server.properties (OPERATOR, ADMIN)
  fastify.put<{
    Params: { id: string };
    Body: { properties: Record<string, PropertyValue> };
  }>('/:id/properties', { preHandler: [requireRole(['ADMIN', 'OPERATOR'])] }, async (request, reply) => {
    const { properties } = request.body || {};
    if (!properties) {
      return reply.status(400).send({ error: 'Propiedades requeridas' });
    }

    try {
      const current = await serverLifecycle.getProperties(request.params.id);
      await serverLifecycle.saveProperties(request.params.id, {
        headers: current.headers,
        properties
      });
      return reply.status(200).send({ message: 'Propiedades actualizadas exitosamente' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al actualizar propiedades';
      return reply.status(500).send({ error: message });
    }
  });

  // Get real-time process metrics
  fastify.get<{
    Params: { id: string };
  }>('/:id/metrics', async (request, reply) => {
    const state = processRunner.getState(request.params.id);
    if (!state) {
      return reply.status(200).send({
        status: 'offline',
        pid: null,
        cpuPercent: 0,
        memoryBytes: 0,
        uptimeSeconds: 0,
        players: []
      });
    }

    const liveMetrics = await processRunner.getMetrics(request.params.id);
    const players = processRunner.getPlayers(request.params.id);

    return reply.status(200).send({
      status: state.status,
      pid: state.pid,
      startedAt: state.startedAt,
      cpuPercent: liveMetrics?.cpuPercent ?? 0,
      memoryBytes: liveMetrics?.memoryBytes ?? 0,
      uptimeSeconds: liveMetrics?.uptimeSeconds ?? 0,
      players
    });
  });

  // ==================== BACKUPS ENDPOINTS ====================

  // List all backups for server instance (VIEWER, OPERATOR, ADMIN)
  fastify.get<{
    Params: { id: string };
  }>('/:id/backups', async (request, reply) => {
    try {
      const list = await backupService.listBackups(request.params.id);
      return reply.status(200).send(list);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al listar backups';
      return reply.status(500).send({ error: message });
    }
  });

  // Create new backup (OPERATOR, ADMIN)
  fastify.post<{
    Params: { id: string };
    Body: { comment?: string };
  }>('/:id/backups', { preHandler: [requireRole(['ADMIN', 'OPERATOR'])] }, async (request, reply) => {
    try {
      const entry = await backupService.createBackup(request.params.id, {
        comment: request.body?.comment
      });
      return reply.status(201).send(entry);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al crear backup';
      return reply.status(500).send({ error: message });
    }
  });

  // Restore backup (ADMIN only - requires confirmation)
  fastify.post<{
    Params: { id: string; backupId: string };
  }>('/:id/backups/:backupId/restore', { preHandler: [requireRole(['ADMIN'])] }, async (request, reply) => {
    try {
      await backupService.restoreBackup(request.params.id, request.params.backupId);
      return reply.status(200).send({ message: 'Backup restaurado exitosamente' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al restaurar backup';
      return reply.status(400).send({ error: message });
    }
  });

  // Delete backup (ADMIN only)
  fastify.delete<{
    Params: { id: string; backupId: string };
  }>('/:id/backups/:backupId', { preHandler: [requireRole(['ADMIN'])] }, async (request, reply) => {
    try {
      const ok = await backupService.deleteBackup(request.params.id, request.params.backupId);
      return reply.status(200).send({ success: ok });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al eliminar backup';
      return reply.status(500).send({ error: message });
    }
  });

  // Download backup archive file
  fastify.get<{
    Params: { id: string; backupId: string };
  }>('/:id/backups/:backupId/download', async (request, reply) => {
    try {
      const backups = await backupService.listBackups(request.params.id);
      const backup = backups.find((b) => b.id === request.params.backupId || b.filename === request.params.backupId);
      if (!backup) {
        return reply.status(404).send({ error: 'Backup no encontrado' });
      }

      const fullPath = backupService.getBackupFilePath(request.params.id, backup.filename);
      reply.header('Content-Disposition', `attachment; filename="${backup.filename}"`);
      reply.header('Content-Type', 'application/gzip');
      const stream = fs.createReadStream(fullPath);
      return reply.send(stream);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al descargar backup';
      return reply.status(500).send({ error: message });
    }
  });

  // ==================== FILE MANAGER ENDPOINTS ====================

  // List files & folders in instance path
  fastify.get<{
    Params: { id: string };
    Querystring: { path?: string };
  }>('/:id/files', async (request, reply) => {
    try {
      const targetPath = request.query.path || '';
      const items = await fileManagerService.listFiles(request.params.id, targetPath);
      return reply.status(200).send(items);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al listar archivos';
      return reply.status(400).send({ error: message });
    }
  });

  // Read text file content
  fastify.get<{
    Params: { id: string };
    Querystring: { path: string };
  }>('/:id/files/content', async (request, reply) => {
    if (!request.query.path) {
      return reply.status(400).send({ error: 'Ruta de archivo requerida' });
    }
    try {
      const res = await fileManagerService.readFileContent(request.params.id, request.query.path);
      return reply.status(200).send(res);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al leer archivo';
      return reply.status(400).send({ error: message });
    }
  });

  // Write / save text file content (OPERATOR, ADMIN)
  fastify.put<{
    Params: { id: string };
    Body: { path: string; content: string };
  }>('/:id/files/content', { preHandler: [requireRole(['ADMIN', 'OPERATOR'])] }, async (request, reply) => {
    const { path: filePath, content } = request.body || {};
    if (!filePath || content === undefined) {
      return reply.status(400).send({ error: 'Ruta y contenido requeridos' });
    }
    try {
      await fileManagerService.writeFileContent(request.params.id, filePath, content);
      return reply.status(200).send({ message: 'Archivo guardado exitosamente' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al guardar archivo';
      return reply.status(400).send({ error: message });
    }
  });

  // Create directory (OPERATOR, ADMIN)
  fastify.post<{
    Params: { id: string };
    Body: { path: string };
  }>('/:id/files/mkdir', { preHandler: [requireRole(['ADMIN', 'OPERATOR'])] }, async (request, reply) => {
    const { path: dirPath } = request.body || {};
    if (!dirPath) {
      return reply.status(400).send({ error: 'Ruta de carpeta requerida' });
    }
    try {
      await fileManagerService.createDirectory(request.params.id, dirPath);
      return reply.status(201).send({ message: 'Carpeta creada exitosamente' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al crear carpeta';
      return reply.status(400).send({ error: message });
    }
  });

  // Delete file or directory (OPERATOR, ADMIN)
  fastify.delete<{
    Params: { id: string };
    Querystring: { path: string };
  }>('/:id/files', { preHandler: [requireRole(['ADMIN', 'OPERATOR'])] }, async (request, reply) => {
    if (!request.query.path) {
      return reply.status(400).send({ error: 'Ruta requerida' });
    }
    try {
      await fileManagerService.deleteFileOrDirectory(request.params.id, request.query.path);
      return reply.status(200).send({ message: 'Elemento eliminado exitosamente' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al eliminar elemento';
      return reply.status(400).send({ error: message });
    }
  });

  // Rename file or directory (OPERATOR, ADMIN)
  fastify.post<{
    Params: { id: string };
    Body: { oldPath: string; newPath: string };
  }>('/:id/files/rename', { preHandler: [requireRole(['ADMIN', 'OPERATOR'])] }, async (request, reply) => {
    const { oldPath, newPath } = request.body || {};
    if (!oldPath || !newPath) {
      return reply.status(400).send({ error: 'oldPath y newPath son requeridos' });
    }
    try {
      await fileManagerService.rename(request.params.id, oldPath, newPath);
      return reply.status(200).send({ message: 'Elemento renombrado exitosamente' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al renombrar elemento';
      return reply.status(400).send({ error: message });
    }
  });

  // Download raw file
  fastify.get<{
    Params: { id: string };
    Querystring: { path: string };
  }>('/:id/files/download', async (request, reply) => {
    if (!request.query.path) {
      return reply.status(400).send({ error: 'Ruta requerida' });
    }
    try {
      const fullPath = fileManagerService.resolveSafePath(request.params.id, request.query.path);
      const filename = path.basename(fullPath);
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      reply.header('Content-Type', 'application/octet-stream');
      const stream = fs.createReadStream(fullPath);
      return reply.send(stream);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al descargar archivo';
      return reply.status(400).send({ error: message });
    }
  });

  // Upload file(s) via multipart/form-data (OPERATOR, ADMIN)
  fastify.post<{
    Params: { id: string };
    Querystring: { path?: string };
  }>('/:id/files/upload', { preHandler: [requireRole(['ADMIN', 'OPERATOR'])] }, async (request, reply) => {
    const serverId = request.params.id;
    const targetFolder = (request.query.path || '').trim();

    if (!request.isMultipart()) {
      return reply.status(400).send({ error: 'La petición debe ser multipart/form-data' });
    }

    try {
      const parts = request.files();
      const uploaded: Array<{ filename: string; path: string; size: number }> = [];

      for await (const part of parts) {
        const filename = part.filename;
        if (!filename) continue;

        const cleanFilename = path.basename(filename);
        const relativePath = targetFolder ? `${targetFolder}/${cleanFilename}` : cleanFilename;

        const { bytesWritten } = await fileManagerService.saveFileStream(serverId, relativePath, part.file);
        uploaded.push({
          filename: cleanFilename,
          path: relativePath,
          size: bytesWritten
        });
      }

      if (uploaded.length === 0) {
        return reply.status(400).send({ error: 'No se recibieron archivos válidos para subir' });
      }

      return reply.status(201).send({
        message: `Se subieron ${uploaded.length} archivo(s) exitosamente`,
        files: uploaded
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al subir archivo(s)';
      return reply.status(400).send({ error: message });
    }
  });
};
