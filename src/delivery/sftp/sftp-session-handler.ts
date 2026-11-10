import fs from 'node:fs';
import path from 'node:path';
import ssh2 from 'ssh2';
import type { SftpPathResolver } from './sftp-path-resolver.js';
import type { UserRole } from '../../auth-identity/models/user.js';

const { STATUS_CODE, OPEN_MODE, flagsToString } = (ssh2.utils as any).sftp;

export interface SftpSessionOptions {
  username: string;
  role: UserRole;
  allowedServers?: string[];
  pathResolver: SftpPathResolver;
}

interface OpenFileHandle {
  type: 'file';
  handle: fs.promises.FileHandle;
  path: string;
}

interface OpenDirHandle {
  type: 'dir';
  path: string;
  readDone: boolean;
}

type OpenHandle = OpenFileHandle | OpenDirHandle;

function toSftpAttrs(stats: fs.Stats) {
  return {
    mode: stats.mode,
    uid: stats.uid ?? 0,
    gid: stats.gid ?? 0,
    size: stats.size,
    atime: Math.floor((stats.atimeMs || Date.now()) / 1000),
    mtime: Math.floor((stats.mtimeMs || Date.now()) / 1000)
  };
}

export class SftpSessionHandler {
  private readonly username: string;
  private readonly role: UserRole;
  private readonly allowedServers: string[];
  private readonly pathResolver: SftpPathResolver;
  private readonly openHandles = new Map<string, OpenHandle>();
  private handleCounter = 1;

  constructor(options: SftpSessionOptions) {
    this.username = options.username;
    this.role = options.role;
    this.allowedServers = options.allowedServers || ['*'];
    this.pathResolver = options.pathResolver;
  }

  private isReadOnly(): boolean {
    return this.role === 'VIEWER';
  }

  private hasFullServerAccess(): boolean {
    return this.role === 'ADMIN' || this.allowedServers.includes('*');
  }

  private resolveAllowed(reqPath: string): string | null {
    const resolved = this.pathResolver.resolve(reqPath);
    if (!resolved) return null;
    if (this.hasFullServerAccess()) return resolved;

    const rootDir = this.pathResolver.getRootDir();
    if (resolved === rootDir) return resolved;

    const rel = path.relative(rootDir, resolved);
    const topSegment = rel.split(/[\\/]/)[0];
    if (!topSegment || !this.allowedServers.includes(topSegment)) {
      return null;
    }
    return resolved;
  }

  attach(sftpStream: any): void {
    // REALPATH: Canonicalize path
    sftpStream.on('REALPATH', (reqid: number, reqPath: string) => {
      const resolved = this.resolveAllowed(reqPath || '/');
      if (!resolved) {
        return sftpStream.status(reqid, STATUS_CODE.PERMISSION_DENIED);
      }
      const virtual = this.pathResolver.toVirtual(resolved);
      sftpStream.name(reqid, [{ filename: virtual }]);
    });

    // STAT
    sftpStream.on('STAT', async (reqid: number, reqPath: string) => {
      const resolved = this.resolveAllowed(reqPath);
      if (!resolved) {
        return sftpStream.status(reqid, STATUS_CODE.PERMISSION_DENIED);
      }
      try {
        const stats = await fs.promises.stat(resolved);
        sftpStream.attrs(reqid, toSftpAttrs(stats));
      } catch (err: any) {
        if (err.code === 'ENOENT') {
          sftpStream.status(reqid, STATUS_CODE.NO_SUCH_FILE);
        } else {
          sftpStream.status(reqid, STATUS_CODE.FAILURE);
        }
      }
    });

    // LSTAT
    sftpStream.on('LSTAT', async (reqid: number, reqPath: string) => {
      const resolved = this.resolveAllowed(reqPath);
      if (!resolved) {
        return sftpStream.status(reqid, STATUS_CODE.PERMISSION_DENIED);
      }
      try {
        const stats = await fs.promises.lstat(resolved);
        sftpStream.attrs(reqid, toSftpAttrs(stats));
      } catch (err: any) {
        if (err.code === 'ENOENT') {
          sftpStream.status(reqid, STATUS_CODE.NO_SUCH_FILE);
        } else {
          sftpStream.status(reqid, STATUS_CODE.FAILURE);
        }
      }
    });

    // OPENDIR
    sftpStream.on('OPENDIR', async (reqid: number, reqPath: string) => {
      const resolved = this.resolveAllowed(reqPath);
      if (!resolved) {
        return sftpStream.status(reqid, STATUS_CODE.PERMISSION_DENIED);
      }
      try {
        const stats = await fs.promises.stat(resolved);
        if (!stats.isDirectory()) {
          return sftpStream.status(reqid, STATUS_CODE.NO_SUCH_FILE);
        }
        const handle = Buffer.alloc(4);
        handle.writeUInt32BE(this.handleCounter++);
        this.openHandles.set(handle.toString('hex'), {
          type: 'dir',
          path: resolved,
          readDone: false
        });
        sftpStream.handle(reqid, handle);
      } catch (err: any) {
        if (err.code === 'ENOENT') {
          sftpStream.status(reqid, STATUS_CODE.NO_SUCH_FILE);
        } else {
          sftpStream.status(reqid, STATUS_CODE.FAILURE);
        }
      }
    });

    // READDIR
    sftpStream.on('READDIR', async (reqid: number, handle: Buffer) => {
      const key = handle.toString('hex');
      const item = this.openHandles.get(key);
      if (!item || item.type !== 'dir') {
        return sftpStream.status(reqid, STATUS_CODE.FAILURE);
      }
      if (item.readDone) {
        return sftpStream.status(reqid, STATUS_CODE.EOF);
      }

      try {
        const isRootDir = item.path === this.pathResolver.getRootDir();
        const entries = await fs.promises.readdir(item.path, { withFileTypes: true });
        const list = [];
        for (const entry of entries) {
          if (isRootDir && !this.hasFullServerAccess() && !this.allowedServers.includes(entry.name)) {
            continue;
          }
          const fullPath = path.join(item.path, entry.name);
          let stats: fs.Stats;
          try {
            stats = await fs.promises.stat(fullPath);
          } catch {
            continue;
          }
          list.push({
            filename: entry.name,
            longname: `${entry.isDirectory() ? 'd' : '-'}rwxr-xr-x 1 singularity singularity ${stats.size} Jan 01 00:00 ${entry.name}`,
            attrs: toSftpAttrs(stats)
          });
        }
        item.readDone = true;
        sftpStream.name(reqid, list);
      } catch {
        sftpStream.status(reqid, STATUS_CODE.FAILURE);
      }
    });

    // OPEN
    sftpStream.on('OPEN', async (reqid: number, filename: string, flags: number) => {
      const isWrite = (flags & (OPEN_MODE.WRITE | OPEN_MODE.APPEND | OPEN_MODE.CREAT | OPEN_MODE.TRUNC)) !== 0;
      if (isWrite && this.isReadOnly()) {
        return sftpStream.status(reqid, STATUS_CODE.PERMISSION_DENIED);
      }

      const resolved = this.resolveAllowed(filename);
      if (!resolved) {
        return sftpStream.status(reqid, STATUS_CODE.PERMISSION_DENIED);
      }

      try {
        const mode = flagsToString(flags) || 'r';
        const fileHandle = await fs.promises.open(resolved, mode);
        const handle = Buffer.alloc(4);
        handle.writeUInt32BE(this.handleCounter++);
        this.openHandles.set(handle.toString('hex'), {
          type: 'file',
          handle: fileHandle,
          path: resolved
        });
        sftpStream.handle(reqid, handle);
      } catch (err: any) {
        if (err.code === 'ENOENT') {
          sftpStream.status(reqid, STATUS_CODE.NO_SUCH_FILE);
        } else if (err.code === 'EACCES') {
          sftpStream.status(reqid, STATUS_CODE.PERMISSION_DENIED);
        } else {
          sftpStream.status(reqid, STATUS_CODE.FAILURE);
        }
      }
    });

    // READ
    sftpStream.on('READ', async (reqid: number, handle: Buffer, offset: number, length: number) => {
      const key = handle.toString('hex');
      const item = this.openHandles.get(key);
      if (!item || item.type !== 'file') {
        return sftpStream.status(reqid, STATUS_CODE.FAILURE);
      }

      try {
        const buf = Buffer.alloc(length);
        const { bytesRead } = await item.handle.read(buf, 0, length, offset);
        if (bytesRead === 0) {
          sftpStream.status(reqid, STATUS_CODE.EOF);
        } else {
          sftpStream.data(reqid, buf.subarray(0, bytesRead));
        }
      } catch {
        sftpStream.status(reqid, STATUS_CODE.FAILURE);
      }
    });

    // WRITE
    sftpStream.on('WRITE', async (reqid: number, handle: Buffer, offset: number, data: Buffer) => {
      if (this.isReadOnly()) {
        return sftpStream.status(reqid, STATUS_CODE.PERMISSION_DENIED);
      }

      const key = handle.toString('hex');
      const item = this.openHandles.get(key);
      if (!item || item.type !== 'file') {
        return sftpStream.status(reqid, STATUS_CODE.FAILURE);
      }

      try {
        await item.handle.write(data, 0, data.length, offset);
        sftpStream.status(reqid, STATUS_CODE.OK);
      } catch {
        sftpStream.status(reqid, STATUS_CODE.FAILURE);
      }
    });

    // FSTAT
    sftpStream.on('FSTAT', async (reqid: number, handle: Buffer) => {
      const key = handle.toString('hex');
      const item = this.openHandles.get(key);
      if (!item || item.type !== 'file') {
        return sftpStream.status(reqid, STATUS_CODE.FAILURE);
      }

      try {
        const stats = await item.handle.stat();
        sftpStream.attrs(reqid, toSftpAttrs(stats));
      } catch {
        sftpStream.status(reqid, STATUS_CODE.FAILURE);
      }
    });

    // CLOSE
    sftpStream.on('CLOSE', async (reqid: number, handle: Buffer) => {
      const key = handle.toString('hex');
      const item = this.openHandles.get(key);
      if (item) {
        if (item.type === 'file') {
          try {
            await item.handle.close();
          } catch {
            // Ignore close error on exit
          }
        }
        this.openHandles.delete(key);
      }
      sftpStream.status(reqid, STATUS_CODE.OK);
    });

    // MKDIR
    sftpStream.on('MKDIR', async (reqid: number, reqPath: string) => {
      if (this.isReadOnly()) {
        return sftpStream.status(reqid, STATUS_CODE.PERMISSION_DENIED);
      }
      const resolved = this.resolveAllowed(reqPath);
      if (!resolved) {
        return sftpStream.status(reqid, STATUS_CODE.PERMISSION_DENIED);
      }
      try {
        await fs.promises.mkdir(resolved, { recursive: true });
        sftpStream.status(reqid, STATUS_CODE.OK);
      } catch {
        sftpStream.status(reqid, STATUS_CODE.FAILURE);
      }
    });

    // REMOVE
    sftpStream.on('REMOVE', async (reqid: number, reqPath: string) => {
      if (this.isReadOnly()) {
        return sftpStream.status(reqid, STATUS_CODE.PERMISSION_DENIED);
      }
      const resolved = this.resolveAllowed(reqPath);
      if (!resolved) {
        return sftpStream.status(reqid, STATUS_CODE.PERMISSION_DENIED);
      }
      try {
        await fs.promises.unlink(resolved);
        sftpStream.status(reqid, STATUS_CODE.OK);
      } catch (err: any) {
        if (err.code === 'ENOENT') {
          sftpStream.status(reqid, STATUS_CODE.NO_SUCH_FILE);
        } else {
          sftpStream.status(reqid, STATUS_CODE.FAILURE);
        }
      }
    });

    // RMDIR
    sftpStream.on('RMDIR', async (reqid: number, reqPath: string) => {
      if (this.isReadOnly()) {
        return sftpStream.status(reqid, STATUS_CODE.PERMISSION_DENIED);
      }
      const resolved = this.resolveAllowed(reqPath);
      if (!resolved) {
        return sftpStream.status(reqid, STATUS_CODE.PERMISSION_DENIED);
      }
      try {
        await fs.promises.rmdir(resolved);
        sftpStream.status(reqid, STATUS_CODE.OK);
      } catch {
        sftpStream.status(reqid, STATUS_CODE.FAILURE);
      }
    });

    // RENAME
    sftpStream.on('RENAME', async (reqid: number, oldPath: string, newPath: string) => {
      if (this.isReadOnly()) {
        return sftpStream.status(reqid, STATUS_CODE.PERMISSION_DENIED);
      }
      const resolvedOld = this.resolveAllowed(oldPath);
      const resolvedNew = this.resolveAllowed(newPath);
      if (!resolvedOld || !resolvedNew) {
        return sftpStream.status(reqid, STATUS_CODE.PERMISSION_DENIED);
      }
      try {
        await fs.promises.rename(resolvedOld, resolvedNew);
        sftpStream.status(reqid, STATUS_CODE.OK);
      } catch {
        sftpStream.status(reqid, STATUS_CODE.FAILURE);
      }
    });

    // SETSTAT
    sftpStream.on('SETSTAT', (reqid: number) => {
      sftpStream.status(reqid, STATUS_CODE.OK);
    });

    // Clean up all handles on stream close
    sftpStream.on('close', async () => {
      for (const item of this.openHandles.values()) {
        if (item.type === 'file') {
          try {
            await item.handle.close();
          } catch {
            // Ignore
          }
        }
      }
      this.openHandles.clear();
    });
  }
}
