import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync, statSync, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import type { FileItem, FileContentResult } from '../models/file-item.js';
import type { ServerLifecycleService } from '../../servers/services/server-lifecycle.js';

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
}
