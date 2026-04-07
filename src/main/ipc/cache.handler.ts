import { ipcMain, app } from 'electron'
import { join } from 'path'
import { existsSync, copyFileSync } from 'fs'
import { IPC } from '../../shared/ipc-channels'
import type { IpcResult } from '../../shared/types'
import { clearCache, ensureCacheDirs, getScryfallCachePath } from '../services/cache.service'
import { clearExtendCache } from '../services/imageBleed.service'

const CARD_BACK_ID = 'default-card-back'

// Resolve the bundled card back image from the app's resources folder.
// In production: process.resourcesPath. In dev: project root /resources/.
function getBundledCardBackPath(): string {
  const file = 'default-card-back.jpg'
  if (app.isPackaged) {
    return join(process.resourcesPath, file)
  }
  // Dev: two levels up from out/main → project root
  return join(app.getAppPath(), 'resources', file)
}

export function getDefaultBackPath(): string {
  return getScryfallCachePath(CARD_BACK_ID, 'large')
}

// Copy the bundled card back into the image cache so it can be read as a data URL.
function ensureDefaultBack(): string {
  ensureCacheDirs()
  const dest = getScryfallCachePath(CARD_BACK_ID, 'large')
  if (existsSync(dest)) return dest
  const src = getBundledCardBackPath()
  if (!existsSync(src)) throw new Error('Bundled card back not found: ' + src)
  copyFileSync(src, dest)
  return dest
}

export { ensureDefaultBack }

export function registerCacheHandlers(): void {
  ipcMain.handle(IPC.CACHE_CLEAR, async (): Promise<IpcResult> => {
    try {
      clearCache()
      clearExtendCache()
      ensureDefaultBack()
      return { ok: true }
    } catch (err: any) {
      return { ok: false, error: err?.message ?? 'Failed to clear cache' }
    }
  })

  ipcMain.handle(IPC.CACHE_GET_DEFAULT_BACK, async (): Promise<IpcResult<string>> => {
    try {
      const path = ensureDefaultBack()
      return { ok: true, data: path }
    } catch (err: any) {
      return { ok: false, error: 'Could not load default card back: ' + (err?.message ?? 'unknown error') }
    }
  })
}
