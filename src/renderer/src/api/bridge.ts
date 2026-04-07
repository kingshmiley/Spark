import type { ElectronAPI } from '../../../main/preload/index'

// Type-safe access to the preload bridge
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export const bridge = window.electronAPI
