import path from 'node:path';
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import type {
  InstallContentRequest,
  InstalledItem,
  InstanceManifest,
  ProjectType
} from '../models/catalog-item.js';
import type { CurseForgeProvider } from '../providers/curseforge-provider.js';
import { isClientOnlyMod, pruneClientOnlyMods } from './client-mod-filter.js';
import { extractZip } from './zip-extractor.js';

const PLUGIN_LOADERS = new Set(['paper', 'purpur', 'spigot', 'bukkit']);

function validateSafeDownloadUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`URL de descarga inválida: ${rawUrl}`);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Protocolo no permitido en URL de descarga: ${parsed.protocol}`);
  }

  const host = parsed.hostname.toLowerCase();
  const isPrivateOrLoopback =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '[::1]' ||
    host === '169.254.169.254' ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

  if (isPrivateOrLoopback) {
    throw new Error('Acceso denegado: No se permiten descargas desde direcciones locales o redes privadas (SSRF).');
  }

  return parsed.toString();
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const safeUrl = validateSafeDownloadUrl(url);
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  const tempPath = `${destPath}.tmp-${Date.now()}`;

  const res = await fetch(safeUrl, {
    headers: {
      'User-Agent': 'NebulaX-Singularity/0.1.0 (contact@nebulaxstudio.top)'
    }
  });

  if (!res.ok || !res.body) {
    throw new Error(`Error HTTP ${res.status} al descargar archivo desde ${url}`);
  }

  const fileStream = createWriteStream(tempPath);
  await pipeline(Readable.fromWeb(res.body as WebReadableStream), fileStream);
  await fs.rename(tempPath, destPath);
}

async function downloadInBatches(tasks: (() => Promise<void>)[], concurrency = 5): Promise<void> {
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      const taskIndex = index++;
      const task = tasks[taskIndex];
      if (task) {
        try {
          await task();
        } catch (err) {
          console.warn(`[ContentInstaller] Advertencia al descargar archivo de modpack:`, err);
        }
      }
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, tasks.length));
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);
}

export class ContentInstallerService {
  constructor(
    private readonly dataDir: string = path.join(process.cwd(), 'data', 'servers'),
    private readonly curseforgeProvider?: CurseForgeProvider
  ) {}

  private getInstanceDir(instanceId: string): string {
    const safeId = path.basename(instanceId).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeId) {
      throw new Error(`ID de instancia inválido: ${instanceId}`);
    }
    return path.join(this.dataDir, safeId);
  }

  private getManifestPath(instanceId: string): string {
    return path.join(this.getInstanceDir(instanceId), 'singularity-manifest.json');
  }

  private async getInstanceLoader(instanceId: string): Promise<string | null> {
    try {
      const metaPath = path.join(this.getInstanceDir(instanceId), 'singularity-instance.json');
      const raw = await fs.readFile(metaPath, 'utf8');
      const data = JSON.parse(raw) as { loader?: string };
      return data.loader ? data.loader.toLowerCase() : null;
    } catch {
      return null;
    }
  }

  /**
   * Computes the target subfolder considering both projectType and the server instance engine.
   * On Paper/Purpur/Spigot servers, mods do not exist; all executable jars belong in plugins/.
   */
  getSubfolder(projectType: ProjectType, serverLoader?: string | null): string {
    if (serverLoader && PLUGIN_LOADERS.has(serverLoader.toLowerCase())) {
      if (projectType === 'datapack') {
        return 'datapacks';
      }
      // Any mod or plugin JAR installed on a Paper/Purpur/Spigot server must go to plugins/
      return 'plugins';
    }

    switch (projectType) {
      case 'mod':
        return 'mods';
      case 'plugin':
        return 'plugins';
      case 'datapack':
        return 'datapacks';
      case 'modpack':
        return '';
      default:
        return 'mods';
    }
  }

  async getStoredManifest(instanceId: string): Promise<InstanceManifest> {
    const manifestPath = this.getManifestPath(instanceId);
    try {
      const raw = await fs.readFile(manifestPath, 'utf8');
      return JSON.parse(raw) as InstanceManifest;
    } catch {
      return {
        instanceId,
        installedItems: [],
        updatedAt: new Date().toISOString()
      };
    }
  }

  async getManifest(instanceId: string): Promise<InstanceManifest> {
    const baseManifest = await this.getStoredManifest(instanceId);

    // Scan actual files on disk in mods/, plugins/, and datapacks/
    // to discover any custom user-uploaded .jar or .zip files
    const instanceDir = this.getInstanceDir(instanceId);
    const trackedFiles = new Set(baseManifest.installedItems.map((item) => item.fileName.toLowerCase()));
    const customItems: InstalledItem[] = [];

    const foldersToScan: Array<{ folder: string; type: ProjectType }> = [
      { folder: 'plugins', type: 'plugin' },
      { folder: 'mods', type: 'mod' },
      { folder: 'datapacks', type: 'datapack' }
    ];

    for (const { folder, type } of foldersToScan) {
      const folderPath = path.join(instanceDir, folder);
      try {
        const entries = await fs.readdir(folderPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile()) {
            const lowerName = entry.name.toLowerCase();
            const isValidExt = type === 'datapack' ? lowerName.endsWith('.zip') : lowerName.endsWith('.jar');
            if (isValidExt && !trackedFiles.has(lowerName)) {
              let mtime = new Date().toISOString();
              try {
                const stat = await fs.stat(path.join(folderPath, entry.name));
                mtime = stat.mtime.toISOString();
              } catch {
                // Ignore stat error
              }

              customItems.push({
                id: `custom_${entry.name}`,
                projectId: `custom_${entry.name}`,
                providerId: 'custom',
                projectType: type,
                versionId: 'local',
                versionNumber: 'Personalizado',
                fileName: entry.name,
                destinationFolder: folder,
                installedAt: mtime
              });
              trackedFiles.add(lowerName);
            }
          }
        }
      } catch {
        // Folder might not exist yet, ignore
      }
    }

    return {
      ...baseManifest,
      installedItems: [...baseManifest.installedItems, ...customItems]
    };
  }

  async saveManifest(manifest: InstanceManifest): Promise<void> {
    const manifestPath = this.getManifestPath(manifest.instanceId);
    await fs.mkdir(path.dirname(manifestPath), { recursive: true });
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  }

  async install(request: InstallContentRequest): Promise<InstalledItem> {
    const safeFileName = path.basename(request.fileName.trim());
    if (!safeFileName || safeFileName === '.' || safeFileName === '..') {
      throw new Error('Nombre de archivo inválido para instalación.');
    }
    const safeDownloadUrl = validateSafeDownloadUrl(request.downloadUrl);
    let sanitizedRequest: InstallContentRequest = {
      ...request,
      fileName: safeFileName,
      downloadUrl: safeDownloadUrl
    };

    const instanceDir = this.getInstanceDir(sanitizedRequest.instanceId);
    const serverLoader = await this.getInstanceLoader(sanitizedRequest.instanceId);
    const isPluginEngine = Boolean(serverLoader && PLUGIN_LOADERS.has(serverLoader));

    // 1.5 Self-healing guard: if target server is Paper/Purpur/Spigot (Plugin engine)
    // but the requested fileName is explicitly a Mod loader build (e.g. Chunky-Fabric or Chunky-NeoForge),
    // automatically resolve the Bukkit/Paper/Spigot plugin build from Modrinth or reject incompatible mod JARs.
    const fnLower = sanitizedRequest.fileName.toLowerCase();
    const isExplicitModJar =
      /(?:^|[-_.])(fabric|neoforge|forge|quilt)(?:[-_.]|\.jar$)/i.test(fnLower) &&
      !/(bukkit|spigot|paper|purpur|folia)/i.test(fnLower);

    if (isPluginEngine && isExplicitModJar && sanitizedRequest.providerId === 'modrinth') {
      try {
        const pluginLoaders = JSON.stringify(['paper', 'purpur', 'spigot', 'bukkit', 'folia']);
        const resolveUrl = `https://api.modrinth.com/v2/project/${encodeURIComponent(sanitizedRequest.projectId)}/version?loaders=${encodeURIComponent(pluginLoaders)}`;
        const verRes = await fetch(resolveUrl, {
          headers: { 'User-Agent': 'NebulaX-Singularity/0.1.0 (contact@nebulaxstudio.top)' }
        });
        if (verRes.ok) {
          const pluginVersions = (await verRes.json()) as Array<{
            id: string;
            version_number: string;
            files: Array<{ url: string; filename: string; primary?: boolean }>;
          }>;
          const bestPluginVer = pluginVersions[0];
          const primaryFile = bestPluginVer?.files?.find((f) => f.primary) ?? bestPluginVer?.files?.[0];
          if (bestPluginVer && primaryFile?.url && primaryFile?.filename) {
            sanitizedRequest = {
              ...sanitizedRequest,
              versionId: bestPluginVer.id,
              versionNumber: bestPluginVer.version_number,
              fileName: path.basename(primaryFile.filename),
              downloadUrl: validateSafeDownloadUrl(primaryFile.url),
              projectType: 'plugin'
            };
          } else {
            throw new Error(
              `El archivo '${sanitizedRequest.fileName}' es un Mod (Fabric/Forge/NeoForge) y este proyecto no dispone de una versión de Plugin compatible con ${serverLoader?.toUpperCase()}.`
            );
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('no dispone de una versión de Plugin')) {
          throw err;
        }
      }
    } else if (isPluginEngine && isExplicitModJar && !sanitizedRequest.force) {
      throw new Error(
        `El archivo '${sanitizedRequest.fileName}' es una versión de Mod (Fabric/Forge/NeoForge) y no puede ejecutarse como Plugin en un servidor ${serverLoader?.toUpperCase()}. Selecciona la edición Bukkit/Paper/Spigot.`
      );
    }

    // 1. Client-only mod prevention for dedicated servers
    const isModOnModEngine = !isPluginEngine && (sanitizedRequest.projectType === 'mod' || !sanitizedRequest.projectType);
    if (!sanitizedRequest.force && isModOnModEngine) {
      if (isClientOnlyMod(sanitizedRequest.fileName) || isClientOnlyMod(sanitizedRequest.projectId)) {
        throw new Error(
          `El mod '${sanitizedRequest.fileName}' es exclusivo de cliente (gráficos, sonido o interfaz) y no puede ejecutarse en un servidor dedicado porque causaría un crash al iniciar.`
        );
      }
    }

    // 2. Modpack / ZIP Archive extraction workflow (.zip or .mrpack)
    const isModpack =
      sanitizedRequest.projectType === 'modpack' ||
      sanitizedRequest.fileName.toLowerCase().endsWith('.zip') ||
      sanitizedRequest.fileName.toLowerCase().endsWith('.mrpack');

    if (isModpack) {
      return this.installModpack(instanceDir, sanitizedRequest);
    }

    // 3. Single JAR / Datapack file installation workflow
    const subfolder = this.getSubfolder(sanitizedRequest.projectType, serverLoader);
    const destinationDir = path.join(instanceDir, subfolder);
    await fs.mkdir(destinationDir, { recursive: true });

    const finalPath = path.join(destinationDir, sanitizedRequest.fileName);
    const tempPath = path.join(destinationDir, `temp-${Date.now()}-${sanitizedRequest.fileName}`);

    // Download content stream
    const res = await fetch(sanitizedRequest.downloadUrl, {
      headers: {
        'User-Agent': 'NebulaX-Singularity/0.1.0 (contact@nebulaxstudio.top)'
      }
    });

    if (!res.ok || !res.body) {
      throw new Error(
        `Error al descargar ${sanitizedRequest.fileName} desde ${sanitizedRequest.downloadUrl} (HTTP ${res.status})`
      );
    }

    // Write file atomically
    const fileStream = createWriteStream(tempPath);
    await pipeline(Readable.fromWeb(res.body as WebReadableStream), fileStream);
    await fs.rename(tempPath, finalPath);

    // If destination was forced to plugins/ due to Paper engine, record effective type
    const effectiveProjectType = subfolder === 'plugins' ? 'plugin' : sanitizedRequest.projectType;

    const installedItem: InstalledItem = {
      id: `${sanitizedRequest.providerId}-${sanitizedRequest.projectId}`,
      projectId: sanitizedRequest.projectId,
      providerId: sanitizedRequest.providerId,
      projectType: effectiveProjectType,
      versionId: sanitizedRequest.versionId,
      versionNumber: sanitizedRequest.versionNumber,
      fileName: sanitizedRequest.fileName,
      destinationFolder: subfolder,
      installedAt: new Date().toISOString()
    };

    // Update manifest
    const manifest = await this.getStoredManifest(sanitizedRequest.instanceId);
    const filtered = manifest.installedItems.filter(
      (item) => item.projectId !== sanitizedRequest.projectId
    );
    filtered.push(installedItem);

    await this.saveManifest({
      instanceId: sanitizedRequest.instanceId,
      installedItems: filtered,
      updatedAt: new Date().toISOString()
    });

    return installedItem;
  }

  private async installModpack(
    instanceDir: string,
    request: InstallContentRequest
  ): Promise<InstalledItem> {
    await fs.mkdir(instanceDir, { recursive: true });
    await fs.mkdir(path.join(instanceDir, 'mods'), { recursive: true });

    const tempArchive = path.join(instanceDir, `temp-modpack-${Date.now()}.zip`);
    const tempExtractDir = path.join(instanceDir, `temp-unpack-${Date.now()}`);

    // Download modpack archive
    const res = await fetch(request.downloadUrl, {
      headers: {
        'User-Agent': 'NebulaX-Singularity/0.1.0 (contact@nebulaxstudio.top)'
      }
    });

    if (!res.ok || !res.body) {
      throw new Error(
        `Error al descargar modpack ${request.fileName} desde ${request.downloadUrl} (HTTP ${res.status})`
      );
    }

    const fileStream = createWriteStream(tempArchive);
    await pipeline(Readable.fromWeb(res.body as WebReadableStream), fileStream);

    try {
      // Extract ZIP / mrpack using system extractor
      await extractZip(tempArchive, tempExtractDir);

      let downloadedCount = 0;

      // 1. Modrinth Pack (modrinth.index.json)
      const modrinthIndexPath = path.join(tempExtractDir, 'modrinth.index.json');
      const hasModrinthIndex = await fs.access(modrinthIndexPath).then(() => true).catch(() => false);

      if (hasModrinthIndex) {
        const rawIndex = await fs.readFile(modrinthIndexPath, 'utf8');
        interface ModrinthFileEntry {
          path: string;
          hashes?: { sha1?: string; sha512?: string };
          env?: { client?: string; server?: string };
          downloads?: string[];
        }
        interface ModrinthPackData {
          files?: ModrinthFileEntry[];
        }

        const packData = JSON.parse(rawIndex) as ModrinthPackData;
        const downloadTasks: (() => Promise<void>)[] = [];

        for (const file of packData.files || []) {
          // Skip client-only mods
          if (file.env?.server === 'unsupported') continue;
          if (isClientOnlyMod(file.path)) continue;

          const downloadUrl = file.downloads?.[0];
          if (!downloadUrl) continue;

          const resolvedInstanceDir = path.resolve(instanceDir);
          const targetFile = path.resolve(resolvedInstanceDir, file.path);
          if (!targetFile.startsWith(resolvedInstanceDir + path.sep)) {
            continue;
          }
          downloadTasks.push(async () => {
            await downloadFile(downloadUrl, targetFile);
            downloadedCount++;
          });
        }

        await downloadInBatches(downloadTasks, 5);
      }

      // 2. CurseForge Pack (manifest.json)
      const curseforgeManifestPath = path.join(tempExtractDir, 'manifest.json');
      const hasCurseforgeManifest = await fs.access(curseforgeManifestPath).then(() => true).catch(() => false);

      if (hasCurseforgeManifest) {
        const rawManifest = await fs.readFile(curseforgeManifestPath, 'utf8');
        interface CurseForgePackData {
          files?: { projectID: number; fileID: number; required?: boolean }[];
        }

        const cfData = JSON.parse(rawManifest) as CurseForgePackData;
        const fileIds = (cfData.files || []).map((f) => f.fileID);

        if (fileIds.length > 0 && this.curseforgeProvider) {
          const filesMeta = await this.curseforgeProvider.getFilesByIds(fileIds);
          const downloadTasks: (() => Promise<void>)[] = [];

          for (const f of filesMeta) {
            if (isClientOnlyMod(f.fileName)) continue;

            const targetFile = path.join(instanceDir, 'mods', f.fileName);
            downloadTasks.push(async () => {
              await downloadFile(f.downloadUrl, targetFile);
              downloadedCount++;
            });
          }

          await downloadInBatches(downloadTasks, 5);
        }
      }

      // 3. Copy overrides directory (configs, scripts, defaultconfigs)
      const overridesDir = path.join(tempExtractDir, 'overrides');
      const hasOverrides = await fs.access(overridesDir).then(() => true).catch(() => false);
      if (hasOverrides) {
        await fs.cp(overridesDir, instanceDir, { recursive: true, force: true });
      }

      // 4. Copy server-overrides directory (Modrinth format)
      const serverOverridesDir = path.join(tempExtractDir, 'server-overrides');
      const hasServerOverrides = await fs.access(serverOverridesDir).then(() => true).catch(() => false);
      if (hasServerOverrides) {
        await fs.cp(serverOverridesDir, instanceDir, { recursive: true, force: true });
      }

      // 5. If pre-bundled mods exist in tempExtractDir/mods, copy them directly
      const extractedModsDir = path.join(tempExtractDir, 'mods');
      const hasExtractedMods = await fs.access(extractedModsDir).then(() => true).catch(() => false);
      if (hasExtractedMods) {
        await fs.cp(extractedModsDir, path.join(instanceDir, 'mods'), { recursive: true, force: true });
      }

      // 6. Prune any remaining client-only mods from mods/ folder
      const modsDir = path.join(instanceDir, 'mods');
      const prunedMods = await pruneClientOnlyMods(modsDir);

      const installedItem: InstalledItem = {
        id: `${request.providerId}-${request.projectId}`,
        projectId: request.projectId,
        providerId: request.providerId,
        projectType: 'modpack',
        versionId: request.versionId,
        versionNumber: request.versionNumber,
        fileName: request.fileName,
        destinationFolder: '',
        prunedClientMods: prunedMods,
        installedAt: new Date().toISOString()
      };

      // Update manifest
      const manifest = await this.getStoredManifest(request.instanceId);
      const filtered = manifest.installedItems.filter(
        (item) => item.projectId !== request.projectId
      );
      filtered.push(installedItem);

      await this.saveManifest({
        instanceId: request.instanceId,
        installedItems: filtered,
        updatedAt: new Date().toISOString()
      });

      return installedItem;
    } finally {
      // Cleanup temp files
      await fs.rm(tempArchive, { force: true }).catch(() => {});
      await fs.rm(tempExtractDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  async uninstall(instanceId: string, projectId: string): Promise<void> {
    const manifest = await this.getManifest(instanceId);
    const itemToUninstall = manifest.installedItems.find((item) => item.projectId === projectId);

    if (!itemToUninstall) {
      return;
    }

    const serverLoader = await this.getInstanceLoader(instanceId);
    const subfolder = itemToUninstall.destinationFolder ?? this.getSubfolder(itemToUninstall.projectType, serverLoader);
    const filePath = path.join(this.getInstanceDir(instanceId), subfolder, itemToUninstall.fileName);

    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore if already deleted from disk
    }

    const updatedItems = manifest.installedItems.filter(
      (item) => item.projectId !== projectId && item.providerId !== 'custom'
    );
    await this.saveManifest({
      instanceId,
      installedItems: updatedItems,
      updatedAt: new Date().toISOString()
    });
  }
}
