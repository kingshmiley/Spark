import { useCallback } from 'react'
import { useDeckStore } from '../store/deckStore'
import { useSettingsStore } from '../store/settingsStore'
import { useUiStore } from '../store/uiStore'
import type { PrintCard } from '../../../shared/types'

/**
 * Wraps addCard with automatic preview navigation — after adding a card the
 * preview jumps to the front page that the new card lands on.
 */
export function useAddCard(): (card: PrintCard) => void {
  const addCard      = useDeckStore((s) => s.addCard)
  const cards        = useDeckStore((s) => s.cards)
  const settings     = useSettingsStore((s) => s.settings)
  const setPreviewPage = useUiStore((s) => s.setPreviewPage)

  return useCallback((card: PrintCard) => {
    const slotsPerPage = settings.gridCols * settings.gridRows
    const totalSlotsBefore = cards.reduce((sum, c) => sum + c.quantity, 0)
    // Which front-page index (0-based) will this card land on?
    const frontPageNumber = Math.floor(totalSlotsBefore / slotsPerPage)
    // In duplex mode front pages sit at even indices (0, 2, 4…)
    const previewIndex = settings.duplex !== 'none' ? frontPageNumber * 2 : frontPageNumber

    addCard(card)
    setPreviewPage(previewIndex)
  }, [addCard, cards, settings, setPreviewPage])
}
