const { app, BrowserWindow, ipcMain, desktopCapturer, globalShortcut, shell, Tray, Menu, nativeImage, screen, session } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

const isDev = !app.isPackaged;
let win;
let tray;
let pythonProcess = null;

// --- PYTHON SIDECAR MANAGEMENT ---
function startPythonServer() {
  const scriptPath = path.join(__dirname, '../backend/server.py');
  
  // In production, you would bundle the python executable. 
  // For dev, we assume 'python' or 'python3' is in PATH.
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  
  pythonProcess = spawn(pythonCmd, [scriptPath]);

  pythonProcess.stdout.on('data', (data) => {
    console.log(`[Python Brain]: ${data}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`[Python Error]: ${data}`);
  });

  pythonProcess.on('close', (code) => {
    console.log(`Python process exited with code ${code}`);
  });
}

function stopPythonServer() {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
}

// --- WINDOW MANAGEMENT ---
function createWindow() {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: 800,
    height: 600,
    minHeight: 60, // For HUD
    x: 100, y: 100,
    alwaysOnTop: true,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: true,
    vibrancy: 'fullscreen-ui',
    visualEffectState: 'active',
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: isDev,
      webSecurity: false // Often needed for local media/server fetch in dev
    }
  });

  win.setContentProtection(true);

  if (isDev) win.loadURL('http://localhost:5173');
  else win.loadFile(path.join(__dirname, '../dist/index.html'));

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Global Toggle
  globalShortcut.register('CommandOrControl+Shift+G', () => {
    if (win.isVisible() && win.isFocused()) {
      win.hide();
    } else {
      win.show();
      win.focus();
      win.webContents.send('app-woke-up');
    }
  });
}

// --- IPC HANDLERS ---
ipcMain.handle('get-screen-capture', async () => {
  const originalOpacity = win.getOpacity();
  win.setOpacity(0);
  await new Promise(r => setTimeout(r, 200));
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } });
    win.setOpacity(originalOpacity);
    return sources[0].thumbnail.toDataURL();
  } catch (e) {
    win.setOpacity(originalOpacity);
    throw e;
  }
});

ipcMain.handle('set-window-size', (event, width, height) => { if (win) win.setSize(width, height, true); });
ipcMain.handle('set-ignore-mouse', (event, ignore, options) => { if (win) win.setIgnoreMouseEvents(ignore, options); });
ipcMain.handle('quit-app', () => app.quit());

// --- LIFECYCLE ---
app.whenReady().then(() => {
  startPythonServer(); // <--- START BRAIN
  createWindow();
  
  // Tray Setup
  const icon = nativeImage.createEmpty(); // Placeholder, use real icon in prod
  tray = new Tray(icon);
  tray.setToolTip('Spectre AI (Local)');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Quit', click: () => app.quit() }
  ]));
});

app.on('will-quit', () => {
  stopPythonServer(); // <--- KILL BRAIN
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });