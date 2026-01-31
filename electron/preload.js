const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  captureScreen: () => ipcRenderer.invoke('get-screen-capture'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (event, text) => callback(text))
});