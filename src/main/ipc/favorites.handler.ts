import { ipcMain, app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { IPC } from '../../shared/ipc-channels'
import type { IpcResult } from '../../shared/types'

// Stored as { [cardName]: scryfallId[] }
type FavoritesStore = Record<string, string[]>

function getFavoritesPath(): string {
  const dir = join(app.getPath('userData'), 'settings')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'favorites.json')
}

function readFavorites(): FavoritesStore {
  const p = getFavoritesPath()
  if (!existsSync(p)) return {}
  try { return JSON.parse(readFileSync(p, 'utf-8')) } catch { return {} }
}

function writeFavorites(data: FavoritesStore): void {
  writeFileSync(getFavoritesPath(), JSON.stringify(data, null, 2), 'utf-8')
}

export function registerFavoritesHandlers(): void {
  ipcMain.handle(IPC.FAVORITES_GET, (_event, cardName: string): IpcResult<string[]> => {
    const store = readFavorites()
    return { ok: true, data: store[cardName] ?? [] }
  })

  ipcMain.handle(IPC.FAVORITES_GET_ALL, (): IpcResult<Record<string, string[]>> => {
    return { ok: true, data: readFavorites() }
  })

  ipcMain.handle(IPC.FAVORITES_TOGGLE, (_event, cardName: string, scryfallId: string): IpcResult<string[]> => {
    try {
      const store = readFavorites()
      const current = store[cardName] ?? []
      const next = current.includes(scryfallId)
        ? current.filter((id) => id !== scryfallId)
        : [scryfallId, ...current]
      if (next.length === 0) {
        delete store[cardName]
      } else {
        store[cardName] = next
      }
      writeFavorites(store)
      return { ok: true, data: next }
    } catch (err: any) {
      return { ok: false, error: err?.message ?? 'Failed to update favorites' }
    }
  })
}
