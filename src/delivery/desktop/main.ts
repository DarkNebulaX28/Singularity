import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { app, BrowserWindow, ipcMain, shell, dialog, Menu } from 'electron';
import { buildServer } from '../http/server.js';
import { SftpServer } from '../sftp/index.js';
import { IdeBridge } from './ide-bridge.js';
import { TrayManager } from './tray.js';
import { ConnectionManager, type ServerConnectionProfile } from './connection-manager.js';
import { DesktopServerService } from './desktop-server-service.js';
import { AutoStartManager } from './autostart-manager.js';
import { NativeNotifier, type NotificationOptions, type DesktopNotificationConfig } from './native-notifier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Windows 10/11 Application User Model ID for native Action Center notifications & grouping
if (process.platform === 'win32') {
  app.setAppUserModelId('studio.nebulax.singularity');
}

// Remove default Electron menu bar (File, Edit, View, Window, Help)
Menu.setApplicationMenu(null);

let mainWindow: BrowserWindow | null = null;
let trayManager: TrayManager | null = null;
let sftpServer: SftpServer | null = null;
let fastifyApp: any = null;
let desktopServerService: DesktopServerService | null = null;
let isQuitting = false;
let isEmbeddedRunning = false;

const HTTP_PORT = parseInt(process.env['PORT'] || '3000', 10);
const HTTP_HOST = '127.0.0.1';
const SFTP_PORT = parseInt(process.env['SINGULARITY_SFTP_PORT'] || '2022', 10);

// Base data directory: in packaged app, use Electron's writable userData (AppData/Roaming/Singularity/data)
// In development, keep local project ./data folder
const defaultDataDir = app.isPackaged
  ? path.join(app.getPath('userData'), 'data')
  : path.resolve('data');

const SERVERS_DIR = path.resolve(process.env['SINGULARITY_SERVERS_DIR'] || path.join(defaultDataDir, 'servers'));
const JAVA_DIR = path.resolve(process.env['SINGULARITY_DATA_JAVA_DIR'] || path.join(defaultDataDir, 'java'));
const DB_PATH = path.resolve(process.env['SINGULARITY_DB_PATH'] || path.join(defaultDataDir, 'singularity.db'));

process.env['SINGULARITY_DATA_JAVA_DIR'] = JAVA_DIR;
process.env['SINGULARITY_SERVERS_DIR'] = SERVERS_DIR;
process.env['SINGULARITY_DB_PATH'] = DB_PATH;

const ideBridge = new IdeBridge(SERVERS_DIR);
const connectionManager = new ConnectionManager();
const autoStartManager = new AutoStartManager();
const nativeNotifier = new NativeNotifier();

// Register all IPC handlers immediately before window creation or any async task
registerIpcHandlers();

// Single instance lock to prevent duplicate servers
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function resolveAppIcon(): string | undefined {
  const iconCandidates = [
    ...(process.platform === 'win32'
      ? [
          path.join(__dirname, 'assets', 'icon.ico'),
          path.join(process.cwd(), 'src', 'delivery', 'desktop', 'assets', 'icon.ico')
        ]
      : []),
    path.join(__dirname, 'assets', 'icon.png'),
    path.join(process.cwd(), 'src', 'delivery', 'desktop', 'assets', 'icon.png'),
    path.join(process.cwd(), 'resources', 'icon.png')
  ];
  return iconCandidates.find((p) => fs.existsSync(p));
}

async function startEmbeddedServices(): Promise<void> {
  if (isEmbeddedRunning) return;

  try {
    // Start Fastify HTTP & WebSocket server
    fastifyApp = await buildServer({
      serversDir: SERVERS_DIR,
      dbPath: DB_PATH,
      dataJavaDir: JAVA_DIR
    });

    try {
      await fastifyApp.listen({ port: HTTP_PORT, host: HTTP_HOST });
    } catch (err: any) {
      if (err.code !== 'EADDRINUSE') {
        throw err;
      }
      // Port already in use (e.g. background dev server running), connect to existing
    }

    // Start SFTP micro-server
    const authService = fastifyApp.authService;
    if (authService) {
      sftpServer = new SftpServer({
        authService,
        port: SFTP_PORT,
        host: '127.0.0.1',
        rootDir: SERVERS_DIR
      });
      try {
        await sftpServer.start();
      } catch {
        // Suppress port conflict if background instance is running
      }
    }

    // Initialize Desktop Server Service for real-time tray & notifications
    const serverLifecycle = fastifyApp.serverLifecycle;
    const processRunner = fastifyApp.processRunner;
    if (serverLifecycle && processRunner) {
      desktopServerService = new DesktopServerService(serverLifecycle, processRunner);
    }

    isEmbeddedRunning = true;
  } catch (err) {
    console.error('[Desktop Main] Error iniciando servicios embebidos:', err);
  }
}

function createMainWindow(startHidden: boolean = false): BrowserWindow {
  const appIcon = resolveAppIcon();

  const preloadPath = fs.existsSync(path.join(__dirname, 'preload.cjs'))
    ? path.join(__dirname, 'preload.cjs')
    : path.join(__dirname, 'preload.js');

  const win = new BrowserWindow({
    icon: appIcon,
    width: 1320,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    show: !startHidden,
    backgroundColor: '#090d16',
    title: 'Singularity - Minecraft Server Mission Control',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  // Completely remove menu bar from this window
  win.removeMenu();

  // Sandbox external navigation & links to prevent remote code execution in webview
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsed = new URL(navigationUrl);
      const activeUrl = new URL(activeProfile.url);
      const isAllowedOrigin =
        parsed.origin === activeUrl.origin ||
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1';

      if (!isAllowedOrigin) {
        event.preventDefault();
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          shell.openExternal(navigationUrl);
        }
      }
    } catch {
      event.preventDefault();
    }
  });

  // Load URL based on active profile
  const activeProfile = connectionManager.getActiveProfile();
  win.loadURL(activeProfile.url);

  // Fallback if remote VPS is temporarily unreachable
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    // Ignore aborts (e.g. during manual redirect or navigation cancel)
    if (errorCode === -3) return;

    console.warn(`[Desktop Main] Error al cargar URL (${errorCode}: ${errorDescription}): ${validatedURL}`);

    // If remote connection failed, offer to switch to local or retry
    if (activeProfile.type === 'remote') {
      const response = dialog.showMessageBoxSync(win, {
        type: 'warning',
        title: 'Servidor Remoto No Disponible',
        message: `No se pudo conectar a "${activeProfile.name}" (${activeProfile.url}).\n\n¿Deseas cambiar a tu Servidor Local en este equipo?`,
        buttons: ['Cambiar a Local (PC)', 'Reintentar', 'Cerrar'],
        defaultId: 0,
        cancelId: 2
      });

      if (response === 0) {
        connectionManager.setActiveProfile('local-embedded').then((localProfile) => {
          startEmbeddedServices().then(() => {
            win.loadURL(localProfile.url);
            trayManager?.updateMenu();
          });
        });
      } else if (response === 1) {
        win.loadURL(activeProfile.url);
      }
    }
  });

  // Close to tray behavior
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
      nativeNotifier.notify({
        title: '🌌 Singularity en Segundo Plano',
        body: 'Singularity sigue activo en la bandeja del sistema para mantener tus servidores Minecraft en línea 24/7.',
        category: 'general'
      });
    }
  });

  return win;
}

function registerIpcHandlers(): void {
  ipcMain.handle(
    'singularity:open-ide',
    async (
      _event,
      args:
        | {
            serverId?: string;
            ide?: string;
            filePath?: string;
            syncFiles?: Array<{ relativePath: string; content: string }>;
            remoteApiUrl?: string;
            authToken?: string;
          }
        | string,
      maybeIde?: string
    ) => {
      let serverId = '';
      let ide = 'antigravity';
      let filePath: string | undefined;
      let syncFiles: Array<{ relativePath: string; content: string }> | undefined;
      let remoteApiUrl: string | undefined;
      let authToken: string | undefined;

      if (typeof args === 'string') {
        serverId = args;
        ide = maybeIde || 'antigravity';
      } else if (args && typeof args === 'object') {
        serverId = args.serverId || '';
        ide = args.ide || 'antigravity';
        filePath = args.filePath;
        syncFiles = args.syncFiles;
        remoteApiUrl = args.remoteApiUrl;
        authToken = args.authToken;
      }
      const pref = (ide || 'antigravity') as 'antigravity' | 'vscode' | 'cursor' | 'explorer';
      const active = connectionManager.getActiveProfile();
      return ideBridge.openInIde(serverId, pref, {
        isRemote: active?.type === 'remote',
        sftpHost: active?.sftpHost || '157.137.223.54',
        sftpPort: active?.sftpPort || SFTP_PORT,
        username: 'admin',
        serverName: serverId,
        filePath,
        syncFiles,
        remoteApiUrl: remoteApiUrl || active?.url,
        authToken
      });
    }
  );

  ipcMain.handle('singularity:open-folder', async (_event, args: { targetPath?: string } | string) => {
    try {
      const target = typeof args === 'string' ? args : args?.targetPath || '';
      const p = ideBridge.resolveInstancePath(target);
      const isWin = process.platform === 'win32';
      const isMac = process.platform === 'darwin';
      if (isWin) {
        spawn('explorer.exe', [p], { detached: true, stdio: 'ignore' }).unref();
      } else if (isMac) {
        spawn('open', [p], { detached: true, stdio: 'ignore' }).unref();
      } else {
        spawn('xdg-open', [p], { detached: true, stdio: 'ignore' }).unref();
      }
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('singularity:get-ides', async () => {
    return ideBridge.getAvailableIdes();
  });

  ipcMain.handle('singularity:get-sftp-info', async () => {
    const active = connectionManager.getActiveProfile();
    return {
      host: active.sftpHost || '127.0.0.1',
      port: active.sftpPort || SFTP_PORT
    };
  });

  ipcMain.on('singularity:minimize-to-tray', () => {
    mainWindow?.hide();
  });

  // Native Notifications IPC Handlers
  ipcMain.handle('singularity:show-notification', async (_event, args: NotificationOptions) => {
    return nativeNotifier.notify(args);
  });

  ipcMain.handle('singularity:get-notification-config', async () => {
    return nativeNotifier.getConfig();
  });

  ipcMain.handle('singularity:set-notification-config', async (_event, args: Partial<DesktopNotificationConfig>) => {
    const updated = await nativeNotifier.updateConfig(args);
    trayManager?.updateMenu();
    return updated;
  });

  // Windows Auto-Start on Boot IPC Handlers
  ipcMain.handle('singularity:get-autostart', async () => {
    return autoStartManager.getSettings();
  });

  ipcMain.handle(
    'singularity:set-autostart',
    async (_event, args: { enabled: boolean; startHidden?: boolean }) => {
      const updated = autoStartManager.setSettings(args.enabled, args.startHidden ?? false);
      trayManager?.updateMenu();
      return updated;
    }
  );

  // Connection Manager IPC Handlers
  ipcMain.handle('singularity:get-connections', async () => {
    return connectionManager.getProfiles();
  });

  ipcMain.handle('singularity:get-active-connection', async () => {
    return connectionManager.getActiveProfile();
  });

  ipcMain.handle(
    'singularity:switch-connection',
    async (_event, args: { id: string }) => {
      try {
        const profile = await connectionManager.setActiveProfile(args.id);
        if (profile.type === 'local') {
          await startEmbeddedServices();
        }
        if (mainWindow) {
          mainWindow.loadURL(profile.url);
        }
        trayManager?.updateMenu();
        return { success: true, profile };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error desconocido al cambiar de servidor';
        return { success: false, profile: connectionManager.getActiveProfile(), error: message };
      }
    }
  );

  ipcMain.handle(
    'singularity:save-connection',
    async (_event, args: { profile: Omit<ServerConnectionProfile, 'id'> & { id?: string } }) => {
      const saved = await connectionManager.saveProfile(args.profile);
      trayManager?.updateMenu();
      return saved;
    }
  );

  ipcMain.handle('singularity:delete-connection', async (_event, args: { id: string }) => {
    const ok = await connectionManager.deleteProfile(args.id);
    trayManager?.updateMenu();
    return ok;
  });

  ipcMain.handle('singularity:test-connection', async (_event, args: { url: string }) => {
    return connectionManager.testConnection(args.url);
  });
}

app.whenReady().then(async () => {
  await connectionManager.init();

  // Always prepare embedded services in background so switching is instant
  await startEmbeddedServices();

  const appIcon = resolveAppIcon();
  await nativeNotifier.init({ iconPath: appIcon });

  const shouldStartHidden = autoStartManager.shouldStartHidden();
  mainWindow = createMainWindow(shouldStartHidden);
  nativeNotifier.setWindow(mainWindow);

  trayManager = new TrayManager({
    mainWindow,
    ideBridge,
    serversDir: SERVERS_DIR,
    connectionManager,
    desktopServerService: desktopServerService || undefined,
    nativeNotifier,
    autoStartManager,
    onSwitchConnection: async (id) => {
      const profile = await connectionManager.setActiveProfile(id);
      if (profile.type === 'local') {
        await startEmbeddedServices();
      }
      if (mainWindow) {
        mainWindow.loadURL(profile.url);
      }
    },
    onQuit: () => {
      isQuitting = true;
      app.quit();
    }
  });
  trayManager.init();

  if (trayManager.getTray()) {
    nativeNotifier.setTray(trayManager.getTray()!);
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow(false);
    nativeNotifier.setWindow(mainWindow);
  } else {
    mainWindow?.show();
    mainWindow?.focus();
  }
});

app.on('before-quit', async () => {
  isQuitting = true;
  if (trayManager) {
    trayManager.destroy();
  }
  if (sftpServer) {
    await sftpServer.stop();
  }
  if (fastifyApp) {
    await fastifyApp.close();
  }
});
