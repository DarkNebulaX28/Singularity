import path from 'node:path';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import cors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import { DbClient } from '../../auth-identity/database/db-client.js';
import { SqliteUserRepository } from '../../auth-identity/repositories/sqlite-user-repository.js';
import { AuthService } from '../../auth-identity/services/auth-service.js';
import { ServerLifecycleService } from '../../servers/services/server-lifecycle.js';
import { ProcessRunner } from '../../process-supervisor/services/process-runner.js';
import { ModrinthProvider } from '../../content-catalog/providers/modrinth-provider.js';
import { PaperMcProvider } from '../../content-catalog/providers/papermc-provider.js';
import { CurseForgeProvider } from '../../content-catalog/providers/curseforge-provider.js';
import { ContentInstallerService } from '../../content-catalog/services/content-installer.js';
import type { IContentProvider } from '../../content-catalog/providers/content-provider.interface.js';
import { authRoutes } from './routes/auth-routes.js';
import { serverRoutes } from './routes/server-routes.js';
import { catalogRoutes } from './routes/catalog-routes.js';
import { javaRoutes } from './routes/java-routes.js';
import { consoleSocketPlugin } from '../websocket/console-socket.js';

import { SftpServer } from '../sftp/index.js';
import { BackupService } from '../../backups/index.js';
import { FileManagerService } from '../../file-manager/index.js';
import { SqliteTaskRepository, TaskSchedulerService } from '../../task-scheduler/index.js';
import { schedulerRoutes } from './routes/scheduler-routes.js';

export interface ServerOptions {
  dbPath?: string;
  serversDir?: string;
  jwtSecret?: string;
  skipDefaultAdmin?: boolean;
  dataJavaDir?: string;
}

export async function buildServer(options: ServerOptions = {}): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: false,
    trustProxy: true
  });

  // Tolerate empty bodies when Content-Type is application/json (e.g. POST/DELETE without payload)
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body: string | Buffer, done) => {
    const str = typeof body === 'string' ? body : body?.toString('utf8');
    if (!str || str.trim() === '') {
      done(null, {});
      return;
    }
    try {
      const json = JSON.parse(str);
      done(null, json);
    } catch (err: unknown) {
      const parseErr = err instanceof Error ? err : new Error('Invalid JSON');
      (parseErr as { statusCode?: number }).statusCode = 400;
      done(parseErr, undefined);
    }
  });

  await fastify.register(cors, {
    origin: true,
    credentials: true
  });

  await fastify.register(fastifyMultipart, {
    limits: {
      fileSize: 1024 * 1024 * 1024, // 1 GB max file upload
      files: 20
    }
  });

  await fastify.register(fastifyWebsocket);

  // Initialize Auth & Database
  const db = DbClient.getDatabase(options.dbPath);
  const userRepo = new SqliteUserRepository(db);
  userRepo.initSchema();

  const jwtSecret =
    options.jwtSecret ||
    process.env['SINGULARITY_JWT_SECRET'] ||
    (process.env['NODE_ENV'] === 'test'
      ? 'singularity-secret-key-change-me'
      : randomBytes(32).toString('hex'));
  const authService = new AuthService(userRepo, jwtSecret);

  if (!options.skipDefaultAdmin) {
    const adminUser = process.env['SINGULARITY_ADMIN_USER'] || 'admin';
    const adminPass = process.env['SINGULARITY_ADMIN_PASSWORD'] || 'singularity';
    await authService.ensureDefaultAdmin(adminUser, adminPass);
  }

  // Initialize Domain Services
  const serversDir = options.serversDir || path.join(process.cwd(), 'data', 'servers');
  const serverLifecycle = new ServerLifecycleService(serversDir);
  const processRunner = new ProcessRunner();

  // Initialize Content Catalog
  const providers = new Map<string, IContentProvider>();
  providers.set('modrinth', new ModrinthProvider());
  providers.set('papermc', new PaperMcProvider());
  const curseforgeProvider = new CurseForgeProvider(process.env['CURSEFORGE_API_KEY'], path.dirname(serversDir));
  providers.set('curseforge', curseforgeProvider);
  const contentInstaller = new ContentInstallerService(serversDir, curseforgeProvider);

  // Register REST API Routes
  await fastify.register(authRoutes, { prefix: '/api/auth', authService });
  const backupService = new BackupService(serverLifecycle, processRunner);
  const fileManagerService = new FileManagerService(serverLifecycle);

  const taskRepo = new SqliteTaskRepository(db);
  taskRepo.initSchema();

  const taskScheduler = new TaskSchedulerService({
    taskRepo,
    backupService,
    processRunner,
    serverLifecycle,
    serverLauncher: async (serverId: string) => {
      const instance = await serverLifecycle.getInstance(serverId);
      if (!instance) throw new Error(`Servidor '${serverId}' no encontrado.`);
      const instanceDir = serverLifecycle.getInstanceDir(instance.id);
      const jarPath = path.join(instanceDir, 'server.jar');
      const executable = instance.javaPath || 'java';
      const args = [...(instance.jvmArgs || ['-Xms1G', `-Xmx${instance.memoryMb}M`]), '-jar', jarPath, 'nogui'];
      return processRunner.startProcess(instance, {
        executable,
        args,
        cwd: instanceDir
      });
    }
  });

  taskScheduler.start();
  fastify.addHook('onClose', async () => {
    taskScheduler.stop();
  });
  await fastify.register(serverRoutes, {
    prefix: '/api/servers',
    serverLifecycle,
    processRunner,
    authService,
    backupService,
    fileManagerService
  });
  const dataJavaDir = options.dataJavaDir || process.env['SINGULARITY_DATA_JAVA_DIR'] || path.join(process.cwd(), 'data', 'java');
  await fastify.register(catalogRoutes, { prefix: '/api/catalog', providers, installer: contentInstaller, authService });
  await fastify.register(javaRoutes, { prefix: '/api/java', authService, dataJavaDir });
  await fastify.register(schedulerRoutes, { prefix: '/api/tasks', taskScheduler, authService });

  // Register WebSocket plugin
  await fastify.register(consoleSocketPlugin, { processRunner, authService });

  // Public Healthcheck endpoint for Docker, Coolify, and CasaOS
  fastify.get('/api/health', async () => {
    return {
      status: 'ok',
      service: 'singularity',
      version: '0.1.0-alpha',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    };
  });

  // Serve Web Dashboard Static Files if present
  const staticCandidates = [
    path.join(process.cwd(), 'dist', 'web-dashboard'),
    path.join(__dirname, '..', '..', 'web-dashboard'),
    path.join(__dirname, '..', '..', 'dist', 'web-dashboard'),
    path.join((process as any).resourcesPath || '', 'web-dashboard'),
    path.join((process as any).resourcesPath || '', 'dist', 'web-dashboard')
  ];
  const staticPath = staticCandidates.find((p): p is string => Boolean(p && fs.existsSync(p)));
  if (staticPath) {
    await fastify.register(fastifyStatic, {
      root: staticPath,
      prefix: '/'
    });
    fastify.setNotFoundHandler((_req, reply) => {
      reply.sendFile('index.html');
    });
  }

  fastify.decorate('authService', authService);
  fastify.decorate('serversDir', serversDir);
  fastify.decorate('serverLifecycle', serverLifecycle);
  fastify.decorate('processRunner', processRunner);
  fastify.decorate('backupService', backupService);
  fastify.decorate('fileManagerService', fileManagerService);
  fastify.decorate('taskScheduler', taskScheduler);

  return fastify;
}

// Start server when executed directly
if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  const port = parseInt(process.env['PORT'] || '3000', 10);
  const host = process.env['HOST'] || '0.0.0.0';

  buildServer()
    .then(async (app) => {
      await app.listen({ port, host });
      console.log(`🌌 Singularity API Server escuchando en http://${host}:${port}`);

      const sftpPort = parseInt(process.env['SINGULARITY_SFTP_PORT'] || '2022', 10);
      const sftpHost = process.env['SINGULARITY_SFTP_HOST'] || '0.0.0.0';
      const authService = (app as any).authService;
      const serversDir = (app as any).serversDir;

      if (authService) {
        const sftpServer = new SftpServer({
          authService,
          port: sftpPort,
          host: sftpHost,
          rootDir: serversDir
        });
        await sftpServer.start();
        console.log(`🔒 Micro-Servidor SFTP activo en sftp://${sftpHost}:${sftpPort} (Antigravity IDE & VS Code)`);
      }
    })
    .catch((err) => {
      console.error('Error al iniciar Singularity Server:', err);
      process.exit(1);
    });
}
