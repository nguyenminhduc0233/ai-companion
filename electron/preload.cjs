// Preload — exposes a minimal, safe bridge to the renderer.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  // Proxy a fetch through the main process (bypasses CORS for AI APIs).
  apiFetch: (url, options) => ipcRenderer.invoke('api-fetch', { url, options })
});
