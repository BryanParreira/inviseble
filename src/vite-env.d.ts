// src/vite-env.d.ts
/// <reference types="vite/client" />

interface ElectronAPI {
  captureScreen: () => Promise<string>;
  quitApp: () => Promise<void>;
  
  // New Methods
  setIgnoreMouse: (ignore: boolean, options?: any) => Promise<void>;
  setWindowSize: (width: number, height: number) => Promise<void>;

  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  quitAndInstall: () => Promise<void>;
  onUpdateMsg: (callback: (msg: any) => void) => void;
  onAppWokeUp: (callback: () => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    // For Speech Recognition
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}