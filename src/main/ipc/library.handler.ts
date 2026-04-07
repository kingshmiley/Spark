import { ipcMain, app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { IPC } from '../../shared/ipc-channels'
import type { IpcResult, LibraryCard } from '../../shared/types'

function getLibraryPath(): string {
  const dir = join(app.getPath('userData'), 'settings')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'library.json')
}

function readLibrary(): LibraryCard[] {
  const p = getLibraryPath()
  if (!existsSync(p)) return []
  try { return JSON.parse(readFileSync(p, 'utf-8')) } catch { return [] }
}

function writeLibrary(cards: LibraryCard[]): void {
  writeFileSync(getLibraryPath(), JSON.stringify(cards, null, 2), 'utf-8')
}

export function registerLibraryHandlers(): void {
  ipcMain.handle(IPC.LIBRARY_LIST, (): IpcResult<LibraryCard[]> => {
    return { ok: true, data: readLibrary() }
  })

  ipcMain.handle(IPC.LIBRARY_SAVE, (_event, card: LibraryCard): IpcResult => {
    try {
      const cards = readLibrary()
      const idx = cards.findIndex((c) => c.id === card.id)
      if (idx >= 0) cards[idx] = card
      else cards.unshift(card) // newest first
      writeLibrary(cards)
      return { ok: true }
    } catch (err: any) {
      return { ok: false, error: err?.message ?? 'Failed to save library card' }
    }
  })

  ipcMain.handle(IPC.LIBRARY_DELETE, (_event, id: string): IpcResult => {
    try {
      writeLibrary(readLibrary().filter((c) => c.id !== id))
      return { ok: true }
    } catch (err: any) {
      return { ok: false, error: err?.message ?? 'Failed to delete library card' }
    }
  })
}
