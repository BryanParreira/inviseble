const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 460,
    height: 720,
    alwaysOnTop: true,
    transparent: true,
    frame: false,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.setContentProtection(true); // Prevents others from seeing the app during shares
  win.loadFile('index.html');
}

// Fixed IPC Handler with source verification
ipcMain.handle('get-screen-capture', async () => {
  try {
    const sources = await desktopCapturer.getSources({ 
      types: ['screen'], 
      thumbnailSize: { width: 1920, height: 1080 } 
    });
    
    if (!sources || sources.length === 0) {
      throw new Error("No screen sources found. Check macOS permissions.");
    }
    
    return sources[0].thumbnail.toDataURL(); 
  } catch (error) {
    console.error("Capture Error:", error);
    throw error;
  }
});

app.whenReady().then(createWindow);