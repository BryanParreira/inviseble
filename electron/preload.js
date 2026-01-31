const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  captureScreen: () => ipcRenderer.invoke('get-screen-capture'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  
  // VITAL: Allows the UI to ask for resize
  setWindowSize: (width, height) => ipcRenderer.invoke('set-window-size', width, height),
  setIgnoreMouse: (ignore, options) => ipcRenderer.invoke('set-ignore-mouse', ignore, options),

  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  onUpdateMsg: (callback) => ipcRenderer.on('update-msg', (_event, value) => callback(value)),
  onAppWokeUp: (callback) => ipcRenderer.on('app-woke-up', () => callback())
});