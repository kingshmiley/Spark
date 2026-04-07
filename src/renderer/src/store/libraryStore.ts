import { create } from 'zustand'
import type { LibraryCard } from '../../../shared/types'
import { bridge } from '../api/bridge'

interface LibraryState {
  cards: LibraryCard[]
  loaded: boolean
  loadLibrary: () => Promise<void>
  saveCard: (card: LibraryCard) => Promise<void>
  deleteCard: (id: string) => Promise<void>
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  cards: [],
  loaded: false,

  loadLibrary: async () => {
    const result = await bridge.libraryList()
    if (result.ok && result.data) {
      set({ cards: result.data, loaded: true })
    }
  },

  saveCard: async (card) => {
    await bridge.librarySave(card)
    await get().loadLibrary()
  },

  deleteCard: async (id) => {
    await bridge.libraryDelete(id)
    set((s) => ({ cards: s.cards.filter((c) => c.id !== id) }))
  }
}))
