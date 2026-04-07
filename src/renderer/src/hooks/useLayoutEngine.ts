import { useMemo } from 'react'
import type { PrintCard, PrintSettings, PageLayout, CardSlot } from '../../../shared/types'
import { PAPER_SIZES_MM } from '../../../shared/types'

function getPaperMm(settings: PrintSettings): { w: number; h: number } {
  let w: number, h: number
  if (settings.paperSize === 'custom') {
    w = settings.customPaperWidthMm
    h = settings.customPaperHeightMm
  } else {
    const size = PAPER_SIZES_MM[settings.paperSize]
    w = size.w
    h = size.h
  }
  return settings.orientation === 'landscape' ? { w: h, h: w } : { w, h }
}

// Mirror slots horizontally (long-edge duplex)
function longEdgeFlip(slots: CardSlot[], cols: number): CardSlot[] {
  const result: CardSlot[] = []
  const rows = Math.ceil(slots.length / cols)
  for (let r = 0; r < rows; r++) {
    const row = slots.slice(r * cols, (r + 1) * cols)
    result.push(...[...row].reverse())
  }
  return result
}

// Mirror slots vertically (short-edge duplex)
function shortEdgeFlip(slots: CardSlot[], cols: number): CardSlot[] {
  const rows = Math.ceil(slots.length / cols)
  const result: CardSlot[] = []
  for (let r = rows - 1; r >= 0; r--) {
    result.push(...slots.slice(r * cols, (r + 1) * cols))
  }
  return result
}

export interface LayoutResult {
  pages: PageLayout[]
  cols: number
  rows: number
  cardSlotWidthMm: number
  cardSlotHeightMm: number
  paperWidthMm: number
  paperHeightMm: number
  // Effective top-left origin of the card grid on the page (always centered)
  effectiveMarginLeftMm: number
  effectiveMarginTopMm: number
}

export function useLayoutEngine(cards: PrintCard[], settings: PrintSettings): LayoutResult {
  return useMemo(() => {
    const paper = getPaperMm(settings)
    const bleedMm = settings.bleed.enabled ? settings.bleed.amountMm : 0
    const slotW = settings.cardWidthMm  + bleedMm * 2
    const slotH = settings.cardHeightMm + bleedMm * 2
    const gap   = settings.cardSpacingMm

    const cols = Math.max(1, settings.gridCols)
    const rows = Math.max(1, settings.gridRows)

    // Grid is always centered on the page
    const gridW = cols * slotW + (cols - 1) * gap
    const gridH = rows * slotH + (rows - 1) * gap
    const effectiveMarginLeftMm = (paper.w - gridW) / 2
    const effectiveMarginTopMm  = (paper.h - gridH) / 2
    const slotsPerPage = cols * rows

    // Expand cards by quantity into ordered slot references
    const allFrontSlots: CardSlot[] = []
    for (const card of cards) {
      for (let q = 0; q < card.quantity; q++) {
        allFrontSlots.push({ printCardId: card.id, face: 'front', isEmpty: false })
      }
    }

    const totalCards = allFrontSlots.length
    if (totalCards === 0) {
      return {
        pages: [],
        cols,
        rows,
        cardSlotWidthMm: slotW,
        cardSlotHeightMm: slotH,
        paperWidthMm: paper.w,
        paperHeightMm: paper.h,
        effectiveMarginLeftMm,
        effectiveMarginTopMm
      }
    }

    const pages: PageLayout[] = []
    const numFrontPages = Math.ceil(totalCards / slotsPerPage)
    let pageIndex = 0

    for (let fp = 0; fp < numFrontPages; fp++) {
      const start = fp * slotsPerPage
      const frontSlice = allFrontSlots.slice(start, start + slotsPerPage)

      // Pad to fill page
      while (frontSlice.length < slotsPerPage) {
        frontSlice.push({ printCardId: null, face: 'front', isEmpty: true })
      }

      const frontPage: PageLayout = {
        slots: frontSlice,
        rows,
        cols,
        isFrontPage: true,
        pageIndex,
        pairedPageIndex: settings.duplex !== 'none' ? pageIndex + 1 : null
      }
      pages.push(frontPage)
      pageIndex++

      // Generate corresponding back page if duplex is on
      if (settings.duplex !== 'none') {
        const backSlots: CardSlot[] = frontSlice.map((s) => ({
          ...s,
          face: 'back' as const
        }))

        const flipped =
          settings.duplex === 'long-edge'
            ? longEdgeFlip(backSlots, cols)
            : shortEdgeFlip(backSlots, cols)

        pages.push({
          slots: flipped,
          rows,
          cols,
          isFrontPage: false,
          pageIndex,
          pairedPageIndex: pageIndex - 1
        })
        pageIndex++
      }
    }

    return {
      pages,
      cols,
      rows,
      cardSlotWidthMm: slotW,
      cardSlotHeightMm: slotH,
      paperWidthMm: paper.w,
      paperHeightMm: paper.h,
      effectiveMarginLeftMm,
      effectiveMarginTopMm
    }
  }, [cards, settings])
}
