/// <reference types="vite/client" />

interface ElectronAPI {
  captureScreen: () => Promise<string>;
  quitApp: () => Promise<void>;
  setIgnoreMouse: (ignore: boolean, options?: any) => Promise<void>;
  setUndetectable: (state: boolean) => Promise<void>;
  
  // NEW: Toggle Pin Definition
  toggleAlwaysOnTop: (flag: boolean) => Promise<void>;

  proxyRequest: (options: any) => Promise<any>;
  streamRequest: (options: any) => void;
  onStreamResponse: (callback: (response: any) => void) => void;
  removeStreamListener: () => void;

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