/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    captureScreen: () => Promise<string>;
    quitApp: () => Promise<void>;
    onUpdateStatus: (callback: (text: string) => void) => void;
  };
}