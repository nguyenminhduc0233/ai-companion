// Electron main process — Windows/desktop wrapper for the shared web core.
const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 940,
    minHeight: 640,
    backgroundColor: '#0b0b16',
    title: 'AI Companion',
    icon: path.join(__dirname, '..', 'public', 'icons', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  // Open external links in the system browser, not inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      require('electron').shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

app.whenReady().then(() => {
  // Grant camera / microphone to the local app automatically.
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, cb) => cb(true));

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// -------------------------------------------------------------------------
// Main-process HTTP proxy. The renderer runs from file:// so direct calls to
// AI provider APIs would hit CORS. Routing them here (Node's global fetch)
// bypasses CORS entirely. Non-streaming so the provider's token `usage`
// object always comes back for the token tracker.
// -------------------------------------------------------------------------
ipcMain.handle('api-fetch', async (_evt, { url, options }) => {
  try {
    const res = await fetch(url, options || {});
    const body = await res.text();
    const headers = {};
    res.headers.forEach((v, k) => { headers[k] = v; });
    return { ok: res.ok, status: res.status, statusText: res.statusText, headers, body };
  } catch (err) {
    return { ok: false, status: 0, statusText: String((err && err.message) || err), headers: {}, body: '' };
  }
});
