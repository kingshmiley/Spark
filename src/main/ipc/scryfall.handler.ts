import { ipcMain } from 'electron'
import axios from 'axios'
import { IPC } from '../../shared/ipc-channels'
import type { IpcResult, ScryfallCard } from '../../shared/types'
import { fetchAndCacheScryfallImage } from '../services/cache.service'

export function registerScryfallHandlers(): void {
  // Search for cards by name
  ipcMain.handle(IPC.SCRYFALL_SEARCH, async (_event, query: string): Promise<IpcResult<ScryfallCard[]>> => {
    try {
      if (!query || query.trim().length < 2) return { ok: true, data: [] }

      const response = await axios.get('https://api.scryfall.com/cards/search', {
        params: {
          q: query,
          unique: 'prints',
          order: 'released',
          dir: 'desc'
        },
        timeout: 15000
      })

      const cards: ScryfallCard[] = response.data.data ?? []
      return { ok: true, data: cards.slice(0, 30) } // limit results
    } catch (err: any) {
      if (err?.response?.status === 404) return { ok: true, data: [] }
      if (err?.code === 'ENOTFOUND' || err?.code === 'ECONNREFUSED') return { ok: false, error: 'Could not connect to Scryfall. Check your internet connection.' }
      if (err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT') return { ok: false, error: 'Scryfall request timed out.' }
      return { ok: false, error: err?.message ?? 'Scryfall search failed' }
    }
  })

  // Exact name lookup via /cards/named — used for decklist import
  ipcMain.handle(IPC.SCRYFALL_NAMED, async (_event, name: string): Promise<IpcResult<ScryfallCard>> => {
    try {
      const response = await axios.get('https://api.scryfall.com/cards/named', {
        params: { exact: name },
        timeout: 15000
      })
      return { ok: true, data: response.data as ScryfallCard }
    } catch (err: any) {
      if (err?.response?.status === 404) return { ok: false, error: `Card not found: ${name}` }
      if (err?.code === 'ENOTFOUND' || err?.code === 'ECONNREFUSED') return { ok: false, error: 'Could not connect to Scryfall. Check your internet connection.' }
      if (err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT') return { ok: false, error: 'Scryfall request timed out.' }
      return { ok: false, error: err?.message ?? 'Scryfall lookup failed' }
    }
  })

  // Fetch and cache an image by URI
  ipcMain.handle(
    IPC.SCRYFALL_FETCH_IMAGE,
    async (_event, imageUri: string, id: string, size: string): Promise<IpcResult<string>> => {
      try {
        const cachedPath = await fetchAndCacheScryfallImage(imageUri, id, size)
        return { ok: true, data: cachedPath }
      } catch (err: any) {
        return { ok: false, error: err?.message ?? 'Failed to fetch image' }
      }
    }
  )
}
