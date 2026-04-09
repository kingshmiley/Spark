import { ipcMain } from 'electron'
import axios from 'axios'
import { IPC } from '../../shared/ipc-channels'
import type { IpcResult, ScryfallCard } from '../../shared/types'
import { fetchAndCacheScryfallImage } from '../services/cache.service'

export function registerScryfallHandlers(): void {
  // Search for cards by name
  ipcMain.handle(IPC.SCRYFALL_SEARCH, async (_event, query: string, allPrints?: boolean): Promise<IpcResult<ScryfallCard[]>> => {
    try {
      if (!query || query.trim().length < 2) return { ok: true, data: [] }

      const params = {
        q: query,
        unique: allPrints ? 'prints' : 'cards',
        order: 'released',
        dir: 'desc'
      }

      const first = await axios.get('https://api.scryfall.com/cards/search', { params, timeout: 15000 })
      const cards: ScryfallCard[] = first.data.data ?? []

      // For printing picker queries, follow pagination to get all results
      if (allPrints) {
        let hasMore: boolean = first.data.has_more
        let nextPage: string | null = first.data.next_page ?? null
        while (hasMore && nextPage) {
          const page = await axios.get(nextPage, { timeout: 15000 })
          cards.push(...(page.data.data ?? []))
          hasMore = page.data.has_more
          nextPage = page.data.next_page ?? null
        }
        return { ok: true, data: cards }
      }

      return { ok: true, data: cards.slice(0, 175) }
    } catch (err: any) {
      if (err?.response?.status === 404) return { ok: true, data: [] }
      if (err?.code === 'ENOTFOUND' || err?.code === 'ECONNREFUSED') return { ok: false, error: 'Could not connect to Scryfall. Check your internet connection.' }
      if (err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT') return { ok: false, error: 'Scryfall request timed out.' }
      return { ok: false, error: err?.message ?? 'Scryfall search failed' }
    }
  })

  // Batch fetch cards by Scryfall ID — used for favorites view
  ipcMain.handle(IPC.SCRYFALL_COLLECTION, async (_event, ids: string[]): Promise<IpcResult<ScryfallCard[]>> => {
    try {
      if (!ids || ids.length === 0) return { ok: true, data: [] }
      const cards: ScryfallCard[] = []
      // Scryfall collection endpoint accepts max 75 identifiers per request
      for (let i = 0; i < ids.length; i += 75) {
        const chunk = ids.slice(i, i + 75).map((id) => ({ id }))
        const response = await axios.post('https://api.scryfall.com/cards/collection',
          { identifiers: chunk },
          { timeout: 15000 }
        )
        cards.push(...(response.data.data ?? []))
      }
      return { ok: true, data: cards }
    } catch (err: any) {
      if (err?.code === 'ENOTFOUND' || err?.code === 'ECONNREFUSED') return { ok: false, error: 'Could not connect to Scryfall.' }
      return { ok: false, error: err?.message ?? 'Collection fetch failed' }
    }
  })

  // Autocomplete — lightweight name suggestions as the user types
  ipcMain.handle(IPC.SCRYFALL_AUTOCOMPLETE, async (_event, q: string): Promise<IpcResult<string[]>> => {
    try {
      if (!q || q.trim().length < 2) return { ok: true, data: [] }
      const response = await axios.get('https://api.scryfall.com/cards/autocomplete', {
        params: { q: q.trim() },
        timeout: 8000
      })
      return { ok: true, data: response.data.data ?? [] }
    } catch (err: any) {
      if (err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT') return { ok: false, error: 'Request timed out.' }
      return { ok: false, error: err?.message ?? 'Autocomplete failed' }
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
