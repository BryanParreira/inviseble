const { contextBridge, ipcRenderer } = require('electron');

// Safe bridge to expose capture only, keeping Node.js hidden from the UI
contextBridge.exposeInMainWorld('electronAPI', {
  captureScreen: () => ipcRenderer.invoke('get-screen-capture')
});
