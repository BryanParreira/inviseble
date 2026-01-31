const { app, BrowserWindow, ipcMain, desktopCapturer, globalShortcut, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

const isDev = !app.isPackaged;
let win;

// Auto-update config
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
  win = new BrowserWindow({
    width: 380,
    height: 650,
    x: 20,
    y: 100,
    alwaysOnTop: true,
    transparent: true,     // Essential for glass look
    frame: false,          // No system borders
    hasShadow: false,      // No system shadow (we use CSS shadow)
    resizable: true,
    vibrancy: 'hud',       // Premium blur
    visualEffectState: 'active',
    skipTaskbar: false,    // Show in Dock/Taskbar
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      devTools: isDev
    }
  });

  // Explicitly show icon in Dock on macOS
  if (process.platform === 'darwin') {
    app.dock.show();
  }

  // Hide from Zoom/Teams screenshare
  win.setContentProtection(true);

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (win.isVisible()) win.hide();
    else win.show();
  });

  win.once('ready-to-show', () => {
    if (!isDev) autoUpdater.checkForUpdatesAndNotify();
  });
}

// --- IPC HANDLERS ---

// 1. Quit App Handler
ipcMain.handle('quit-app', () => {
  app.quit();
});

// 2. Ghost Capture Handler
ipcMain.handle('get-screen-capture', async () => {
  try {
    win.setOpacity(0);
    await new Promise(r => setTimeout(r, 200)); 
    
    const sources = await desktopCapturer.getSources({ 
      types: ['screen'], 
      thumbnailSize: { width: 1920, height: 1080 } 
    });

    win.setOpacity(1);
    
    if (!sources || sources.length === 0) throw new Error("No display found");
    return sources[0].thumbnail.toDataURL(); 
  } catch (e) {
    win.setOpacity(1);
    throw e;
  }
});

// Update Events
autoUpdater.on('update-available', () => {
  if (win) win.webContents.send('update-status', '⬇️ Update found');
});
autoUpdater.on('update-downloaded', () => {
  if (win) win.webContents.send('update-status', '✅ Restart to update');
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});