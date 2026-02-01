/// <reference types="vite/client" />

interface ElectronAPI {
  captureScreen: () => Promise<string>;
  quitApp: () => Promise<void>;
  setIgnoreMouse: (ignore: boolean, options?: any) => Promise<void>;
  setWindowSize: (width: number, height: number) => Promise<void>;
  setUndetectable: (state: boolean) => Promise<void>;
  proxyRequest: (options: any) => Promise<any>;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  quitAndInstall: () => Promise<void>;
  onUpdateMsg: (callback: (msg: any) => void) => void;
  onAppWokeUp: (callback: () => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// --- FIX FOR GITHUB BUILD ERRORS ---
declare module 'react-syntax-highlighter' {
  export const Prism: any;
  export const Light: any;
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism' {
  export const vscDarkPlus: any;
  const style: any;
  export default style;
}