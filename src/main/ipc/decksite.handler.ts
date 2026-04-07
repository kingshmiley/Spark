import { ipcMain } from 'electron'
import axios from 'axios'
import { IPC } from '../../shared/ipc-channels'
import type { IpcResult } from '../../shared/types'

export interface DeckCard {
  name: string
  quantity: number
  categories: string[]
}

export interface DeckResult {
  deckName: string
  cards: DeckCard[]
}

async function fetchArchidekt(id: string): Promise<DeckResult> {
  const response = await axios.get(`https://archidekt.com/api/decks/${id}/`, {
    timeout: 15000,
    headers: { 'User-Agent': 'Spark/1.0 (MTG proxy printer)' }
  })
  const data = response.data
  const cards: DeckCard[] = (data.cards ?? []).map((entry: any) => ({
    name: entry.card?.oracleCard?.name ?? '',
    quantity: entry.quantity ?? 1,
    categories: Array.isArray(entry.categories) ? entry.categories : []
  })).filter((c: DeckCard) => c.name)

  return { deckName: data.name ?? 'Untitled', cards }
}

export function registerDecksiteHandlers(): void {
  ipcMain.handle(IPC.DECK_FETCH, async (_event, payload: { site: string; id: string }): Promise<IpcResult<DeckResult>> => {
    try {
      if (payload.site === 'archidekt') {
        const result = await fetchArchidekt(payload.id)
        return { ok: true, data: result }
      }
      return { ok: false, error: `Unsupported site: ${payload.site}` }
    } catch (err: any) {
      if (err?.response?.status === 404) return { ok: false, error: 'Deck not found. Check the URL and make sure the deck is public.' }
      if (err?.response?.status === 403) return { ok: false, error: 'This deck is private.' }
      if (err?.response?.status === 429) return { ok: false, error: 'Too many requests. Please wait a moment and try again.' }
      if (err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT') return { ok: false, error: 'Request timed out. Check your internet connection.' }
      if (err?.code === 'ENOTFOUND' || err?.code === 'ECONNREFUSED') return { ok: false, error: 'Could not connect to Archidekt. Check your internet connection.' }
      return { ok: false, error: err?.message ?? 'Failed to fetch deck' }
    }
  })
}
