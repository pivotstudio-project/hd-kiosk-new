import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // renderer에서 직접 호출할 수 있는 이벤트 전송 함수
  sendUserActivity: (data: { type: string }) => {
    ipcRenderer.send('user-activity', data)
  },
  onGoHome: (callback: () => void): void => {
    ipcRenderer.on('go-to-home', callback)
  },
  setIdleTimeout: (timeoutMs: number): void => ipcRenderer.send('set-idle-timeout', timeoutMs),
  showTouchKeyboard: () => ipcRenderer.send('show-touch-keyboard'),
  hideTouchKeyboard: () => ipcRenderer.send('hide-touch-keyboard'),
  onUpdateAvailable: (callback: () => void) => {
    ipcRenderer.on('update_available', callback)
  },
  onUpdateDownloaded: (callback: () => void) => {
    ipcRenderer.on('update_downloaded', callback)
  },
  send: (channel: string, data?: any) => ipcRenderer.send(channel, data),
}

// DOM 이벤트를 잡아서 Main Process로 보내기
const registerActivityListeners = (): void => {
  window.addEventListener('mousemove', () => {
    api.sendUserActivity({ type: 'mousemove' })
  })

  window.addEventListener('mousedown', () => {
    api.sendUserActivity({ type: 'mousedown' })
  })

  window.addEventListener('touchstart', () => {
    api.sendUserActivity({ type: 'touchstart' })
  })

  window.addEventListener('keydown', () => {
    api.sendUserActivity({ type: 'keydown' })
  })
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    // 이벤트 리스너 등록
    registerActivityListeners()
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
  registerActivityListeners()
}
