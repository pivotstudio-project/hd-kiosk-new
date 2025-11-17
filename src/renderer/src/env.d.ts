/// <reference types="vite/client" />

export {}

declare global {
  interface Window {
    api: {
      send: (channel: string, ...args: any[]) => void
      receive?: (channel: string, func: (...args: any[]) => void) => void
      sendUserActivity: (data: any) => void
      onGoHome: (callback: () => void) => void
      clearAllWebviewHistory: () => Promise<void>
      setIdleTimeout: (timeoutMs: number) => void
      showTouchKeyboard: () => void
      hideTouchKeyboard: () => void
      onUpdateAvailable: (callback: () => void) => void
      onUpdateDownloaded: (callback: () => void) => void
    }
  }
}
