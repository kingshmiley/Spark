import { create } from 'zustand'
import type { PrintCard, CardFace } from '../../../shared/types'

interface DeckState {
  cards: PrintCard[]
  isDirty: boolean
  addCard: (card: PrintCard) => void
  removeCard: (id: string) => void
  updateCard: (id: string, patch: Partial<PrintCard>) => void
  setCardBack: (id: string, back: CardFace | 'default') => void
  setCardQuantity: (id: string, qty: number) => void
  reorderCards: (fromIndex: number, toIndex: number) => void
  clearAll: () => void
  setCards: (cards: PrintCard[]) => void
  markClean: () => void
}

export const useDeckStore = create<DeckState>((set) => ({
  cards: [],
  isDirty: false,

  addCard: (card) =>
    set((s) => ({ cards: [...s.cards, card], isDirty: true })),

  removeCard: (id) =>
    set((s) => ({ cards: s.cards.filter((c) => c.id !== id), isDirty: true })),

  updateCard: (id, patch) =>
    set((s) => ({
      cards: s.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      isDirty: true
    })),

  setCardBack: (id, back) =>
    set((s) => ({
      cards: s.cards.map((c) => (c.id === id ? { ...c, back } : c)),
      isDirty: true
    })),

  setCardQuantity: (id, qty) =>
    set((s) => ({
      cards: s.cards.map((c) => (c.id === id ? { ...c, quantity: Math.max(1, qty) } : c)),
      isDirty: true
    })),

  reorderCards: (fromIndex, toIndex) =>
    set((s) => {
      const cards = [...s.cards]
      const [moved] = cards.splice(fromIndex, 1)
      cards.splice(toIndex, 0, moved)
      return { cards, isDirty: true }
    }),

  clearAll: () => set({ cards: [], isDirty: true }),

  setCards: (cards) => set({ cards }),

  markClean: () => set({ isDirty: false })
}))
