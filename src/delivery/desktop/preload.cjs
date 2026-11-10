const { contextBridge, ipcRenderer } = require('electron');

const desktopApi = {
  isElectron: true,
  openInIde: (serverId, ide, extraOptions) =>
    ipcRenderer.invoke('singularity:open-ide', {
      serverId,
      ide,
      ...(extraOptions && typeof extraOptions === 'object' ? extraOptions : {})
    }),
  openFolder: (targetPath) => ipcRenderer.invoke('singularity:open-folder', { targetPath }),
  getAvailableIdes: () => ipcRenderer.invoke('singularity:get-ides'),
  getSftpConnectionInfo: () => ipcRenderer.invoke('singularity:get-sftp-info'),
  minimizeToTray: () => ipcRenderer.send('singularity:minimize-to-tray'),
  showNotification: (options) => ipcRenderer.invoke('singularity:show-notification', options),
  // Windows Native Notifications Configuration
  getNotificationConfig: () => ipcRenderer.invoke('singularity:get-notification-config'),
  setNotificationConfig: (config) => ipcRenderer.invoke('singularity:set-notification-config', config),
  // Windows Auto-Start Configuration
  getAutoStartSettings: () => ipcRenderer.invoke('singularity:get-autostart'),
  setAutoStartSettings: (settings) => ipcRenderer.invoke('singularity:set-autostart', settings),
  // Multi-Host Remote Connection Manager
  getConnections: () => ipcRenderer.invoke('singularity:get-connections'),
  getActiveConnection: () => ipcRenderer.invoke('singularity:get-active-connection'),
  switchConnection: (id) => ipcRenderer.invoke('singularity:switch-connection', { id }),
  saveConnection: (profile) => ipcRenderer.invoke('singularity:save-connection', { profile }),
  deleteConnection: (id) => ipcRenderer.invoke('singularity:delete-connection', { id }),
  testConnection: (url) => ipcRenderer.invoke('singularity:test-connection', { url })
};

try {
  contextBridge.exposeInMainWorld('singularityDesktop', desktopApi);
} catch {
  window.singularityDesktop = desktopApi;
}
