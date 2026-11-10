import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import AdmZip from 'adm-zip';
import type { FileItem, FileContentResult } from '../models/file-item.js';
import type { ServerLifecycleService } from '../../servers/services/server-lifecycle.js';

const EDITABLE_EXTENSIONS = new Set([
  'yml', 'yaml', 'json', 'properties', 'toml', 'txt', 'cfg', 'conf', 'ini',
  'sh', 'bat', 'cmd', 'md', 'sk', 'js', 'ts', 'lua', 'xml', 'csv', 'env'
]);

const IGNORED_SYNC_DIRS = new Set([
  'world', 'world_nether', 'world_the_end', 'libraries', 'versions',
  'cache', 'logs', 'crash-reports', 'backups', '.git', '.vscode', 'node_modules'
]);

export class FileManagerService {
  constructor(private readonly serverLifecycle: ServerLifecycleService) {}

  /**
   * Resolves a relative path to an absolute path inside the server instance folder.
   * Throws an error if path traversal outside the server directory is attempted.
   */
  resolveSafePath(serverId: string, relativePath: string = ''): string {
    if (relativePath.includes('\0')) {
      throw new Error('Acceso denegado: Carácter nulo no permitido en la ruta.');
    }

    const instanceDir = path.resolve(this.serverLifecycle.getInstanceDir(serverId));
    // Normalize and remove leading slashes
    const cleanRelative = relativePath.trim().replace(/^(\/|\\)+/, '');
    const resolved = path.resolve(instanceDir, cleanRelative);

    // Enforce jail boundary strictly (prevent prefix collision e.g. /server1 vs /server10)
    const isExact = resolved === instanceDir;
    const isInside = resolved.startsWith(instanceDir + path.sep);

    if (!isExact && !isInside) {
      throw new Error('Acceso denegado: Intento de escape del directorio del servidor.');
    }

    return resolved;
  }

  async listFiles(serverId: string, relativePath: string = ''): Promise<FileItem[]> {
    const targetDir = this.resolveSafePath(serverId, relativePath);

    if (!existsSync(targetDir)) {
      throw new Error(`El directorio especificado no existe: ${relativePath}`);
    }

    const stat = await fs.stat(targetDir);
    if (!stat.isDirectory()) {
      throw new Error(`La ruta solicitada no es un directorio: ${relativePath}`);
    }

    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    const items: FileItem[] = [];

    const instanceDir = path.resolve(this.serverLifecycle.getInstanceDir(serverId));

    for (const entry of entries) {
      const fullPath = path.join(targetDir, entry.name);
      try {
        const itemStat = await fs.stat(fullPath);
        const itemRelPath = path.relative(instanceDir, fullPath).replace(/\\/g, '/');
        const ext = entry.isDirectory() ? '' : path.extname(entry.name).toLowerCase().replace(/^\./, '');

        items.push({
          name: entry.name,
          relativePath: itemRelPath,
          isDirectory: entry.isDirectory(),
          sizeBytes: itemStat.size,
          modifiedAt: itemStat.mtime.toISOString(),
          extension: ext
        });
      } catch {
        // Skip unreadable files or broken links
      }
    }

    // Sort directories first, then alphabetical
    return items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  async readFileContent(
    serverId: string,
    relativePath: string,
    maxBytes: number = 2 * 1024 * 1024
  ): Promise<FileContentResult> {
    const filePath = this.resolveSafePath(serverId, relativePath);

    if (!existsSync(filePath)) {
      throw new Error(`El archivo solicitado no existe: ${relativePath}`);
    }

    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      throw new Error(`No se puede leer el contenido de un directorio como texto: ${relativePath}`);
    }

    const isTruncated = stat.size > maxBytes;
    const fileHandle = await fs.open(filePath, 'r');

    try {
      const bytesToRead = Math.min(stat.size, maxBytes);
      const buffer = Buffer.alloc(bytesToRead);
      await fileHandle.read(buffer, 0, bytesToRead, 0);

      const content = buffer.toString('utf8');
      return {
        path: relativePath.replace(/\\/g, '/'),
        content,
        sizeBytes: stat.size,
        isTruncated
      };
    } finally {
      await fileHandle.close();
    }
  }

  async writeFileContent(serverId: string, relativePath: string, content: string): Promise<void> {
    const filePath = this.resolveSafePath(serverId, relativePath);
    // Ensure parent directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
  }

  /**
   * Streams a binary file directly to disk, ensuring memory efficiency for large mods,
   * plugins, modpacks, and world saves while enforcing path safety boundaries.
   */
  async saveFileStream(serverId: string, relativePath: string, stream: NodeJS.ReadableStream | Readable): Promise<{ bytesWritten: number }> {
    const filePath = this.resolveSafePath(serverId, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const writeStream = createWriteStream(filePath);
    await pipeline(stream as any, writeStream);
    const stat = await fs.stat(filePath);
    return { bytesWritten: stat.size };
  }

  /**
   * Saves a binary Buffer safely to disk.
   */
  async saveFileBuffer(serverId: string, relativePath: string, buffer: Buffer): Promise<{ bytesWritten: number }> {
    const filePath = this.resolveSafePath(serverId, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    return { bytesWritten: buffer.length };
  }

  async createDirectory(serverId: string, relativePath: string): Promise<void> {
    const dirPath = this.resolveSafePath(serverId, relativePath);
    await fs.mkdir(dirPath, { recursive: true });
  }

  async deleteFileOrDirectory(serverId: string, relativePath: string): Promise<void> {
    const targetPath = this.resolveSafePath(serverId, relativePath);
    const instanceDir = path.resolve(this.serverLifecycle.getInstanceDir(serverId));

    // Never delete the instance root directory itself via this endpoint
    if (targetPath === instanceDir) {
      throw new Error('No se puede eliminar la raíz del servidor mediante este endpoint.');
    }

    if (!existsSync(targetPath)) {
      return;
    }

    const stat = await fs.stat(targetPath);
    if (stat.isDirectory()) {
      await fs.rm(targetPath, { recursive: true, force: true });
    } else {
      await fs.unlink(targetPath);
    }
  }

  async rename(serverId: string, oldRelativePath: string, newRelativePath: string): Promise<void> {
    const oldPath = this.resolveSafePath(serverId, oldRelativePath);
    const newPath = this.resolveSafePath(serverId, newRelativePath);

    if (!existsSync(oldPath)) {
      throw new Error(`El archivo o carpeta origen no existe: ${oldRelativePath}`);
    }

    await fs.mkdir(path.dirname(newPath), { recursive: true });
    await fs.rename(oldPath, newPath);
  }

  async copyFileOrDirectory(serverId: string, sourceRelativePath: string, destinationRelativePath: string): Promise<void> {
    const srcPath = this.resolveSafePath(serverId, sourceRelativePath);
    const destPath = this.resolveSafePath(serverId, destinationRelativePath);

    if (!existsSync(srcPath)) {
      throw new Error(`El archivo o carpeta origen no existe: ${sourceRelativePath}`);
    }

    if (srcPath === destPath) {
      throw new Error('La ruta de origen y destino no pueden ser idénticas.');
    }

    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.cp(srcPath, destPath, { recursive: true });
  }

  async compressToZip(
    serverId: string,
    relativePaths: string[],
    outputZipRelativePath: string
  ): Promise<{ zipPath: string; sizeBytes: number }> {
    if (!Array.isArray(relativePaths) || relativePaths.length === 0) {
      throw new Error('Debes seleccionar al menos un archivo o carpeta para comprimir.');
    }

    const finalZipRel = outputZipRelativePath.toLowerCase().endsWith('.zip')
      ? outputZipRelativePath
      : `${outputZipRelativePath}.zip`;
    const outputFullPath = this.resolveSafePath(serverId, finalZipRel);

    const zip = new AdmZip();

    for (const rel of relativePaths) {
      const targetFull = this.resolveSafePath(serverId, rel);
      if (!existsSync(targetFull)) {
        continue;
      }
      const stat = await fs.stat(targetFull);
      const baseName = path.basename(targetFull);
      if (stat.isDirectory()) {
        zip.addLocalFolder(targetFull, baseName);
      } else {
        zip.addLocalFile(targetFull);
      }
    }

    await fs.mkdir(path.dirname(outputFullPath), { recursive: true });
    zip.writeZip(outputFullPath);

    const outStat = await fs.stat(outputFullPath);
    return {
      zipPath: finalZipRel.replace(/\\/g, '/'),
      sizeBytes: outStat.size
    };
  }

  async extractZip(
    serverId: string,
    zipRelativePath: string,
    targetDirRelativePath: string = ''
  ): Promise<{ extractedCount: number }> {
    const zipFullPath = this.resolveSafePath(serverId, zipRelativePath);
    if (!existsSync(zipFullPath)) {
      throw new Error(`El archivo ZIP no existe: ${zipRelativePath}`);
    }

    const destBaseDir = this.resolveSafePath(serverId, targetDirRelativePath);
    await fs.mkdir(destBaseDir, { recursive: true });

    const zip = new AdmZip(zipFullPath);
    const entries = zip.getEntries();
    let extractedCount = 0;

    for (const entry of entries) {
      const entryName = entry.entryName.replace(/\\/g, '/');
      if (!entryName || entryName.includes('\0')) continue;

      // Prevent Zip-Slip path traversal by resolving relative to destBaseDir and checking jail
      const candidateFullPath = path.resolve(destBaseDir, entryName);
      const isExact = candidateFullPath === destBaseDir;
      const isInside = candidateFullPath.startsWith(destBaseDir + path.sep);

      if (!isExact && !isInside) {
        throw new Error(`Archivo ZIP bloqueado por seguridad (Zip-Slip detectado): ${entryName}`);
      }

      if (entry.isDirectory) {
        await fs.mkdir(candidateFullPath, { recursive: true });
      } else {
        await fs.mkdir(path.dirname(candidateFullPath), { recursive: true });
        const data = entry.getData();
        await fs.writeFile(candidateFullPath, data);
        extractedCount++;
      }
    }

    return { extractedCount };
  }

  /**
   * Exports editable configuration and script files from the server directory
   * so the Desktop IDE Bridge can mirror remote server configs locally for native
   * Antigravity IDE / VS Code / Cursor editing with live auto-sync.
   */
  async exportEditableWorkspace(
    serverId: string,
    maxFileSizeBytes: number = 512 * 1024,
    maxFiles: number = 200
  ): Promise<Array<{ relativePath: string; content: string }>> {
    const instanceDir = path.resolve(this.serverLifecycle.getInstanceDir(serverId));
    if (!existsSync(instanceDir)) {
      return [];
    }

    const results: Array<{ relativePath: string; content: string }> = [];

    const walk = async (currentDir: string, depth: number) => {
      if (depth > 5 || results.length >= maxFiles) return;

      let entries;
      try {
        entries = await fs.readdir(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (results.length >= maxFiles) break;
        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.relative(instanceDir, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          if (IGNORED_SYNC_DIRS.has(entry.name.toLowerCase())) continue;
          await walk(fullPath, depth + 1);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase().replace(/^\./, '');
          if (!EDITABLE_EXTENSIONS.has(ext)) continue;

          try {
            const stat = await fs.stat(fullPath);
            if (stat.size <= maxFileSizeBytes) {
              const content = await fs.readFile(fullPath, 'utf8');
              results.push({ relativePath: relPath, content });
            }
          } catch {
            // Ignore unreadable file
          }
        }
      }
    };

    await walk(instanceDir, 0);
    return results;
  }
}
