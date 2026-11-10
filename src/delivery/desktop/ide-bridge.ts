import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

export interface IdeInfo {
  id: 'antigravity' | 'vscode' | 'cursor' | 'explorer';
  name: string;
  command: string;
  isAvailable: boolean;
}

export interface RemoteWorkspaceOptions {
  isRemote?: boolean;
  sftpHost?: string;
  sftpPort?: number;
  username?: string;
  serverName?: string;
}

export class IdeBridge {
  private readonly defaultServersDir: string;

  constructor(serversDir?: string) {
    this.defaultServersDir = path.resolve(serversDir || process.env['SINGULARITY_SERVERS_DIR'] || 'data/servers');
  }

  /**
   * Resolves the target directory for a given server instance ID or relative path.
   * Confines resolution strictly within the servers directory to prevent arbitrary directory opening.
   */
  resolveInstancePath(serverIdOrPath: string): string {
    if (!serverIdOrPath || typeof serverIdOrPath !== 'string') {
      return this.defaultServersDir;
    }

    if (serverIdOrPath.includes('\0') || /[&|;`$<>"]/g.test(serverIdOrPath)) {
      throw new Error('Acceso denegado: Caracteres no permitidos en la ruta.');
    }

    const cleanRelative = serverIdOrPath.trim().replace(/^(\/|\\)+/, '');
    const resolved = path.isAbsolute(serverIdOrPath)
      ? path.resolve(serverIdOrPath)
      : path.resolve(this.defaultServersDir, cleanRelative);

    const isExact = resolved === this.defaultServersDir;
    const isInside = resolved.startsWith(this.defaultServersDir + path.sep);

    if (!isExact && !isInside) {
      throw new Error('Acceso denegado: Intento de escape del directorio de servidores.');
    }

    return resolved;
  }

  /**
   * Checks if a command executable exists in system PATH with a non-blocking timeout.
   */
  async checkCommandExists(command: string, timeoutMs: number = 1500): Promise<boolean> {
    const isWindows = process.platform === 'win32';
    const checkTool = isWindows ? 'where.exe' : 'which';

    return new Promise((resolve) => {
      try {
        const proc = spawn(checkTool, [command], { stdio: 'ignore' });
        const timer = setTimeout(() => {
          try {
            proc.kill();
          } catch {
            // Ignore kill error
          }
          resolve(false);
        }, timeoutMs);

        proc.on('close', (code) => {
          clearTimeout(timer);
          resolve(code === 0);
        });

        proc.on('error', () => {
          clearTimeout(timer);
          resolve(false);
        });
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * Returns list of detected IDEs on the host machine.
   * Runs checks concurrently via Promise.all for high performance.
   */
  async getAvailableIdes(): Promise<IdeInfo[]> {
    const [hasAgyIde, hasAntigravity, hasAgy, hasCode, hasCursor] = await Promise.all([
      this.checkCommandExists('antigravity-ide'),
      this.checkCommandExists('antigravity'),
      this.checkCommandExists('agy'),
      this.checkCommandExists('code'),
      this.checkCommandExists('cursor')
    ]);

    const isAntigravityAvailable = hasAgyIde || hasAntigravity || hasAgy;
    const antigravityCmd = hasAgyIde ? 'antigravity-ide' : hasAntigravity ? 'antigravity' : hasAgy ? 'agy' : 'antigravity-ide';

    return [
      {
        id: 'antigravity',
        name: 'Antigravity IDE',
        command: antigravityCmd,
        isAvailable: isAntigravityAvailable
      },
      {
        id: 'vscode',
        name: 'Visual Studio Code',
        command: 'code',
        isAvailable: hasCode
      },
      {
        id: 'cursor',
        name: 'Cursor',
        command: 'cursor',
        isAvailable: hasCursor
      },
      {
        id: 'explorer',
        name: process.platform === 'darwin' ? 'Finder' : 'Explorador de Archivos',
        command: 'explorer',
        isAvailable: true
      }
    ];
  }

  /**
   * Scaffolds remote SFTP workspace configuration (.vscode/sftp.json) and README guide
   * to enable instant live file synchronization between local IDE and cloud VPS.
   */
  provisionRemoteWorkspace(
    targetDir: string,
    serverIdOrName: string,
    options?: RemoteWorkspaceOptions
  ): void {
    const sftpHost = options?.sftpHost || '157.137.223.54';
    const sftpPort = options?.sftpPort || 2022;
    const username = options?.username || 'admin';
    const serverName = options?.serverName || serverIdOrName;
    const cleanId = path.basename(serverIdOrName);

    const vscodeDir = path.join(targetDir, '.vscode');
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }

    const sftpConfigPath = path.join(vscodeDir, 'sftp.json');
    if (!fs.existsSync(sftpConfigPath)) {
      const sftpConfig = {
        name: `Singularity VPS (${serverName})`,
        host: sftpHost,
        protocol: 'sftp',
        port: sftpPort,
        username,
        remotePath: `/${cleanId}`,
        uploadOnSave: true,
        useTempFile: false,
        openSftpForFirstTime: true,
        ignore: ['**/.vscode/**', '**/.git/**', '**/.DS_Store']
      };
      fs.writeFileSync(sftpConfigPath, JSON.stringify(sftpConfig, null, 2), 'utf8');
    }

    const infoPath = path.join(targetDir, 'REMOTE_SERVER_INFO.md');
    if (!fs.existsSync(infoPath)) {
      const infoContent = `# 🌌 Servidor Remoto: ${serverName} (${cleanId})
**Conectado a NebulaX Cloud VPS vía Singularity**

Este servidor de Minecraft está alojado y corriendo en tu VPS en la nube:
- **Host SFTP:** \`${sftpHost}\`
- **Puerto SFTP:** \`${sftpPort}\`
- **Usuario:** \`${username}\`
- **Ruta Remota:** \`/${cleanId}\`

---

### 🚀 Cómo sincronizar y editar tus archivos en vivo:

#### 1. Con VS Code / Antigravity IDE / Cursor:
- Ya se ha autogenerado la configuración en \`.vscode/sftp.json\`.
- Si tienes instalada la extensión **SFTP** (por ejemplo *SFTP by Natizyskunk* o *liximomo*):
  1. Presiona \`Ctrl + Shift + P\` (o \`Cmd + Shift + P\`).
  2. Escribe y ejecuta: **\`SFTP: Download Project\`** para descargar los archivos del servidor a esta carpeta local.
  3. Cada vez que edites y guardes un archivo con \`Ctrl + S\`, se subirá automáticamente al VPS al instante.

#### 2. Desde el Panel Web de Singularity:
- Puedes explorar, editar con sintaxis resaltada y subir/descargar archivos directamente en tiempo real desde la pestaña **"Archivos"** (*File Manager*) en la aplicación Singularity.

---
*Generado automáticamente por el puente IDE de Singularity — NebulaX Studio*
`;
      fs.writeFileSync(infoPath, infoContent, 'utf8');
    }
  }

  /**
   * Opens the Minecraft server directory in the chosen or best-available IDE.
   */
  async openInIde(
    serverIdOrPath: string,
    preferredIde: 'antigravity' | 'vscode' | 'cursor' | 'explorer' = 'antigravity',
    options?: RemoteWorkspaceOptions
  ): Promise<{ success: boolean; ideUsed: string; isRemote?: boolean; error?: string }> {
    const targetDir = this.resolveInstancePath(serverIdOrPath);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const hasLocalServerMetadata =
      fs.existsSync(path.join(targetDir, 'singularity-instance.json')) ||
      fs.existsSync(path.join(targetDir, 'server.properties'));

    const isRemote = Boolean(options?.isRemote || !hasLocalServerMetadata);
    if (isRemote) {
      this.provisionRemoteWorkspace(targetDir, path.basename(serverIdOrPath), options);
    }

    // Direct Explorer Request
    if (preferredIde === 'explorer') {
      const res = await this.openFolderInExplorer(targetDir);
      return { ...res, isRemote };
    }

    const ides = await this.getAvailableIdes();
    const antigravity = ides.find((i) => i.id === 'antigravity');
    const vscode = ides.find((i) => i.id === 'vscode');
    const cursor = ides.find((i) => i.id === 'cursor');

    // 1. Explicit preference match
    if (preferredIde === 'antigravity' && antigravity?.isAvailable) {
      const opened = await this.spawnIdeProcess(antigravity.command, [targetDir]);
      if (opened) return { success: true, ideUsed: 'Antigravity IDE', isRemote };
    }

    if (preferredIde === 'vscode' && vscode?.isAvailable) {
      const opened = await this.spawnIdeProcess(vscode.command, [targetDir]);
      if (opened) return { success: true, ideUsed: 'Visual Studio Code', isRemote };
    }

    if (preferredIde === 'cursor' && cursor?.isAvailable) {
      const opened = await this.spawnIdeProcess(cursor.command, [targetDir]);
      if (opened) return { success: true, ideUsed: 'Cursor', isRemote };
    }

    // 2. Fallback to any detected code editor
    if (antigravity?.isAvailable) {
      const opened = await this.spawnIdeProcess(antigravity.command, [targetDir]);
      if (opened) return { success: true, ideUsed: 'Antigravity IDE', isRemote };
    }

    if (vscode?.isAvailable) {
      const opened = await this.spawnIdeProcess(vscode.command, [targetDir]);
      if (opened) return { success: true, ideUsed: 'Visual Studio Code', isRemote };
    }

    if (cursor?.isAvailable) {
      const opened = await this.spawnIdeProcess(cursor.command, [targetDir]);
      if (opened) return { success: true, ideUsed: 'Cursor', isRemote };
    }

    // 3. Fallback: OS Native Explorer/Finder
    const fallbackRes = await this.openFolderInExplorer(targetDir);
    return { ...fallbackRes, isRemote };
  }

  async openFolderInExplorer(targetDir: string): Promise<{ success: boolean; ideUsed: string; error?: string }> {
    try {
      const isWin = process.platform === 'win32';
      const isMac = process.platform === 'darwin';
      if (isWin) {
        const winPath = path.win32.normalize(targetDir);
        spawn('explorer.exe', [winPath], { detached: true, stdio: 'ignore' }).unref();
        return { success: true, ideUsed: 'Explorador de Archivos' };
      } else if (isMac) {
        spawn('open', [targetDir], { detached: true, stdio: 'ignore' }).unref();
        return { success: true, ideUsed: 'Finder' };
      } else {
        spawn('xdg-open', [targetDir], { detached: true, stdio: 'ignore' }).unref();
        return { success: true, ideUsed: 'Explorador de Archivos' };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido al abrir explorador';
      return { success: false, ideUsed: 'none', error: message };
    }
  }

  private async spawnIdeProcess(command: string, args: string[]): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const isWindows = process.platform === 'win32';
        const safeArgs = isWindows
          ? args.map((a) => `"${a.replace(/"/g, '')}"`)
          : args;
        const proc = spawn(command, safeArgs, {
          detached: true,
          stdio: 'ignore',
          shell: isWindows,
          windowsHide: false
        });

        proc.unref();

        proc.on('error', () => {
          resolve(false);
        });

        // If it hasn't errored immediately, consider spawned
        setTimeout(() => {
          resolve(true);
        }, 500);
      } catch {
        resolve(false);
      }
    });
  }
}
