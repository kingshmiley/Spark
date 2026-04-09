import { PDFDocument, rgb, pushGraphicsState, popGraphicsState, clip, endPath, rectangle } from 'pdf-lib'
import { existsSync } from 'fs'
import { extendEdges, trimCardImage } from './imageBleed.service'
import { join } from 'path'
import { app } from 'electron'
import type { PrintJob, PrintCard, CardSlot, PrintSettings, CardFace, PageLayout } from '../../shared/types'
import { PAPER_SIZES_MM } from '../../shared/types'

// ─── Unit conversions ─────────────────────────────────────────────────────────
const mmToPt  = (mm: number): number => (mm / 25.4) * 72
const mmToPx  = (mm: number, dpi: number): number => Math.round((mm / 25.4) * dpi)

// ─── Resolve which image to draw for a slot ──────────────────────────────────
function resolveCardFace(
  slot: CardSlot,
  cards: PrintCard[],
  settings: PrintSettings,
  defaultBackPath: string
): string | null {
  if (slot.isEmpty || !slot.printCardId) return null

  const card = cards.find(c => c.id === slot.printCardId)
  if (!card) return null

  if (slot.face === 'front') {
    return card.front.cachedPath ?? null
  } else {
    // back face
    if (card.back === 'default') {
      return settings.defaultBack.cachedPath ?? defaultBackPath
    }
    return (card.back as CardFace).cachedPath ?? defaultBackPath
  }
}

// ─── Get paper dimensions in points ─────────────────────────────────────────
function getPaperPt(settings: PrintSettings): { w: number; h: number } {
  let wMm: number, hMm: number
  if (settings.paperSize === 'custom') {
    wMm = settings.customPaperWidthMm
    hMm = settings.customPaperHeightMm
  } else {
    const size = PAPER_SIZES_MM[settings.paperSize]
    wMm = size.w
    hMm = size.h
  }
  if (settings.orientation === 'landscape') [wMm, hMm] = [hMm, wMm]
  return { w: mmToPt(wMm), h: mmToPt(hMm) }
}

// ─── Determine if a page is a back page ──────────────────────────────────────
function isBackPage(page: PageLayout): boolean {
  const first = page.slots.find((s) => !s.isEmpty)
  return first?.face === 'back'
}

// ─── Main PDF generation ─────────────────────────────────────────────────────
export async function generatePdf(job: PrintJob, defaultBackPath: string, registrationOffset?: { x: number; y: number }): Promise<Uint8Array> {
  const { pages, cards, settings } = job
  const pdfDoc = await PDFDocument.create()

  const paper = getPaperPt(settings)

  // Card slot dimensions in points (includes bleed)
  const bleedMm = settings.bleed.enabled ? settings.bleed.amountMm : 0
  const baseSlotWPt = mmToPt(settings.cardWidthMm  + bleedMm * 2)
  const baseSlotHPt = mmToPt(settings.cardHeightMm + bleedMm * 2)
  const baseSpacePt = mmToPt(settings.cardSpacingMm)

  // Use the first page's col/row count to compute the grid footprint
  // (all pages share the same grid dimensions)
  const firstPage = pages[0]
  const gridCols = firstPage?.cols ?? 1
  const gridRows = firstPage?.rows ?? 1
  const baseGridWPt = gridCols * baseSlotWPt + (gridCols - 1) * baseSpacePt
  const baseGridHPt = gridRows * baseSlotHPt + (gridRows - 1) * baseSpacePt

  // Scale factor based on scale mode
  let scaleFactor = 1
  if (settings.scale === 'fit-page') {
    scaleFactor = Math.min(paper.w / baseGridWPt, paper.h / baseGridHPt, 1)
  } else if (settings.scale === 'fill-page') {
    scaleFactor = Math.min(paper.w / baseGridWPt, paper.h / baseGridHPt)
  }
  // 'actual-size' keeps scaleFactor = 1

  const slotWPt = baseSlotWPt * scaleFactor
  const slotHPt = baseSlotHPt * scaleFactor
  const spacePt = baseSpacePt * scaleFactor
  const gridWPt = baseGridWPt * scaleFactor
  const gridHPt = baseGridHPt * scaleFactor

  const marginLPt = (paper.w - gridWPt) / 2
  const marginTPt = (paper.h - gridHPt) / 2

  // Image cache to avoid re-embedding the same image bytes multiple times
  const embeddedImages = new Map<string, { width: number; height: number; embed: (doc: PDFDocument) => Promise<any> }>()

  async function getOrEmbedImage(doc: PDFDocument, filePath: string) {
    if (!existsSync(filePath)) return null
    try {
      const bytes = await trimCardImage(filePath)
      const ext   = filePath.toLowerCase().split('.').pop()
      if (ext === 'png') return doc.embedPng(bytes)
      return doc.embedJpg(bytes)
    } catch {
      return null
    }
  }

  // Registration offset in points (applied to back pages only)
  const regOffXPt = mmToPt(registrationOffset?.x ?? 0)
  const regOffYPt = mmToPt(registrationOffset?.y ?? 0)

  for (const pageLayout of pages) {
    const page = pdfDoc.addPage([paper.w, paper.h])
    // pdf-lib origin is bottom-left; we work top-down
    const pageH = paper.h

    // Apply registration offset to back pages:
    // positive x = shift right, positive y = shift down (screen coords) = subtract in pdf-lib
    const back = isBackPage(pageLayout)
    const dxPt = back ? regOffXPt : 0
    const dyPt = back ? regOffYPt : 0

    for (let i = 0; i < pageLayout.slots.length; i++) {
      const slot = pageLayout.slots[i]
      if (slot.isEmpty) continue

      const col = i % pageLayout.cols
      const row = Math.floor(i / pageLayout.cols)

      // x from left, y from top → convert to pdf-lib bottom-left y
      const x = marginLPt + col * (slotWPt + spacePt) + dxPt
      const yFromTop = marginTPt + row * (slotHPt + spacePt)
      const y = pageH - yFromTop - slotHPt - dyPt // pdf-lib bottom-left

      const imagePath = resolveCardFace(slot, cards, settings, defaultBackPath)

      // Clip all drawing to this slot's rectangle so bleed never overflows into adjacent cards
      page.pushOperators(pushGraphicsState())
      page.pushOperators(rectangle(x, y, slotWPt, slotHPt), clip(), endPath())

      if (settings.bleed.enabled) {
        const bleedPt = mmToPt(bleedMm) * scaleFactor
        const bleedMethod = settings.bleed.method ?? 'black'

        if (bleedMethod === 'extend') {
          // Edge extension: smear outermost pixels into bleed area
          if (!imagePath) {
            page.drawRectangle({ x, y, width: slotWPt, height: slotHPt, color: rgb(0.12, 0.12, 0.12) })
          } else {
            try {
              const buf = await extendEdges(imagePath, bleedMm, settings.cardWidthMm, settings.cardHeightMm)
              const ext = imagePath.toLowerCase().split('.').pop()
              const img = await (ext === 'png' ? pdfDoc.embedPng(buf) : pdfDoc.embedJpg(buf))
              page.drawImage(img, { x, y, width: slotWPt, height: slotHPt })
            } catch {
              page.drawRectangle({ x, y, width: slotWPt, height: slotHPt, color: rgb(0.15, 0.15, 0.15) })
            }
          }
          // Trim line marks the cut boundary
          if (settings.showCutLines !== false) {
            page.drawRectangle({ x: x + bleedPt, y: y + bleedPt, width: slotWPt - bleedPt * 2, height: slotHPt - bleedPt * 2, borderColor: rgb(0.55, 0.55, 0.55), borderWidth: 0.35 })
          }

        } else if (bleedMethod === 'scale') {
          // Art fills the full slot — image extends into bleed area
          if (!imagePath) {
            page.drawRectangle({ x, y, width: slotWPt, height: slotHPt, color: rgb(0.12, 0.12, 0.12) })
          } else {
            const img = await getOrEmbedImage(pdfDoc, imagePath)
            if (!img) {
              page.drawRectangle({ x, y, width: slotWPt, height: slotHPt, color: rgb(0.15, 0.15, 0.15) })
            } else {
              page.drawImage(img, { x, y, width: slotWPt, height: slotHPt })
            }
          }
          // Trim line marks the cut boundary
          if (settings.showCutLines !== false) {
            page.drawRectangle({ x: x + bleedPt, y: y + bleedPt, width: slotWPt - bleedPt * 2, height: slotHPt - bleedPt * 2, borderColor: rgb(0.55, 0.55, 0.55), borderWidth: 0.35 })
          }
        } else {
          // 'black' method: full slot filled with black, art inset at card dimensions
          page.drawRectangle({ x, y, width: slotWPt, height: slotHPt, color: rgb(0, 0, 0) })
          if (!imagePath) {
            page.drawRectangle({ x: x + bleedPt, y: y + bleedPt, width: slotWPt - bleedPt * 2, height: slotHPt - bleedPt * 2, color: rgb(0.12, 0.12, 0.12) })
          } else {
            const img = await getOrEmbedImage(pdfDoc, imagePath)
            if (!img) {
              page.drawRectangle({ x: x + bleedPt, y: y + bleedPt, width: slotWPt - bleedPt * 2, height: slotHPt - bleedPt * 2, color: rgb(0.15, 0.15, 0.15) })
            } else {
              page.drawImage(img, { x: x + bleedPt, y: y + bleedPt, width: slotWPt - bleedPt * 2, height: slotHPt - bleedPt * 2 })
            }
          }
          // Trim line marks the cut boundary
          if (settings.showCutLines !== false) {
            page.drawRectangle({ x: x + bleedPt, y: y + bleedPt, width: slotWPt - bleedPt * 2, height: slotHPt - bleedPt * 2, borderColor: rgb(0.55, 0.55, 0.55), borderWidth: 0.35 })
          }
        }
      } else {
        if (!imagePath) {
          page.drawRectangle({ x, y, width: slotWPt, height: slotHPt, color: rgb(0.12, 0.12, 0.12) })
        } else {
          const img = await getOrEmbedImage(pdfDoc, imagePath)
          if (!img) {
            page.drawRectangle({ x, y, width: slotWPt, height: slotHPt, color: rgb(0.15, 0.15, 0.15) })
          } else {
            page.drawImage(img, { x, y, width: slotWPt, height: slotHPt })
          }
        }
      }

      page.pushOperators(popGraphicsState())
    } // end slots loop

    // Cut markers at paper edge
    if (settings.cutMarkersV || settings.cutMarkersH) {
      const tickLenPt = mmToPt(3)
      const tickWidth = 0.5
      const tickColor = rgb(0, 0, 0)
      const bleedPt   = mmToPt(bleedMm) * scaleFactor

      if (settings.cutMarkersV) {
        for (let c = 0; c < gridCols; c++) {
          for (const x of [
            marginLPt + c * (slotWPt + spacePt) + bleedPt,
            marginLPt + c * (slotWPt + spacePt) + slotWPt - bleedPt,
          ]) {
            page.drawLine({ start: { x, y: paper.h }, end: { x, y: paper.h - tickLenPt }, thickness: tickWidth, color: tickColor })
            page.drawLine({ start: { x, y: 0 },       end: { x, y: tickLenPt },           thickness: tickWidth, color: tickColor })
          }
        }
      }

      if (settings.cutMarkersH) {
        for (let r = 0; r < gridRows; r++) {
          for (const y of [
            paper.h - (marginTPt + r * (slotHPt + spacePt) + bleedPt),
            paper.h - (marginTPt + r * (slotHPt + spacePt) + slotHPt - bleedPt),
          ]) {
            page.drawLine({ start: { x: 0,       y }, end: { x: tickLenPt,            y }, thickness: tickWidth, color: tickColor })
            page.drawLine({ start: { x: paper.w, y }, end: { x: paper.w - tickLenPt, y }, thickness: tickWidth, color: tickColor })
          }
        }
      }
    }
  }

  return pdfDoc.save()
}
