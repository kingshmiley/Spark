import { ipcMain, shell } from 'electron'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { IPC } from '../../shared/ipc-channels'
import { PAPER_SIZES_MM } from '../../shared/types'
import type { IpcResult } from '../../shared/types'

const mmToPt = (mm: number): number => (mm / 25.4) * 72

interface CalibPayload {
  paperSize: string
  orientation: 'portrait' | 'landscape'
  customPaperWidthMm?: number
  customPaperHeightMm?: number
  offsetX?: number
  offsetY?: number
}

async function generateCalibrationPdf(payload: CalibPayload): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Paper size
  let wMm: number, hMm: number
  if (payload.paperSize === 'custom' && payload.customPaperWidthMm && payload.customPaperHeightMm) {
    wMm = payload.customPaperWidthMm
    hMm = payload.customPaperHeightMm
  } else {
    const size = PAPER_SIZES_MM[payload.paperSize as keyof typeof PAPER_SIZES_MM] ?? PAPER_SIZES_MM['letter']
    wMm = size.w
    hMm = size.h
  }
  if (payload.orientation === 'landscape') [wMm, hMm] = [hMm, wMm]

  const wPt = mmToPt(wMm)
  const hPt = mmToPt(hMm)
  const cx  = wPt / 2
  const cy  = hPt / 2

  const orange  = rgb(0.910, 0.251, 0.063) // #e84010
  const dark    = rgb(0.20,  0.20,  0.20)
  const mid     = rgb(0.45,  0.45,  0.45)
  const light   = rgb(0.70,  0.70,  0.70)

  const offsetX = payload.offsetX ?? 0
  const offsetY = payload.offsetY ?? 0
  const fmt = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(1) + 'mm'

  for (const side of ['FRONT', 'BACK'] as const) {
    const page = pdfDoc.addPage([wPt, hPt])

    // For the back page, shift the crosshair center by the registration offset
    const cxPage = side === 'BACK' ? cx + mmToPt(offsetX) : cx
    const cyPage = side === 'BACK' ? cy - mmToPt(offsetY) : cy

    if (side === 'FRONT') {
      // ── Branding ───────────────────────────────────────────────────────────
      const sparkSize = 22
      const sparkW = fontBold.widthOfTextAtSize('SPARK', sparkSize)
      page.drawText('SPARK', {
        x: (wPt - sparkW) / 2,
        y: hPt - mmToPt(13),
        size: sparkSize,
        font: fontBold,
        color: orange,
      })

      const subText = 'Registration Calibration Sheet'
      const subSize = 8
      const subW = font.widthOfTextAtSize(subText, subSize)
      page.drawText(subText, {
        x: (wPt - subW) / 2,
        y: hPt - mmToPt(20),
        size: subSize,
        font,
        color: mid,
      })

      const frontText = '— FRONT —'
      const frontSize = 11
      const frontW = fontBold.widthOfTextAtSize(frontText, frontSize)
      page.drawText(frontText, {
        x: (wPt - frontW) / 2,
        y: hPt - mmToPt(28),
        size: frontSize,
        font: fontBold,
        color: rgb(0.20, 0.40, 0.80),
      })

      const offText = `Offset applied: X ${fmt(offsetX)}  Y ${fmt(offsetY)}`
      const offSz = 7
      const offW = font.widthOfTextAtSize(offText, offSz)
      page.drawText(offText, {
        x: (wPt - offW) / 2,
        y: hPt - mmToPt(36),
        size: offSz,
        font,
        color: mid,
      })
    } else {
      // ── Back label ─────────────────────────────────────────────────────────
      const backText = 'BACK'
      const backSize = 11
      const backW = fontBold.widthOfTextAtSize(backText, backSize)
      page.drawText(backText, {
        x: (wPt - backW) / 2,
        y: hPt - mmToPt(20),
        size: backSize,
        font: fontBold,
        color: dark,
      })
    }

    // ── Crosshair ─────────────────────────────────────────────────────────────
    const rangeM = 15 // ±15mm
    const rangePt = mmToPt(rangeM)

    // Axis lines (both pages)
    page.drawLine({ start: { x: cxPage - rangePt, y: cyPage }, end: { x: cxPage + rangePt, y: cyPage }, thickness: 0.6, color: dark })
    page.drawLine({ start: { x: cxPage, y: cyPage - rangePt }, end: { x: cxPage, y: cyPage + rangePt }, thickness: 0.6, color: dark })

    if (side === 'FRONT') {
      // Tick marks and labels
      for (let mm = -rangeM; mm <= rangeM; mm++) {
        if (mm === 0) continue
        const isMajor = mm % 5 === 0
        const tickLen = mmToPt(isMajor ? 2.5 : 1.2)
        const tickColor = isMajor ? dark : mid
        const thickness = isMajor ? 0.8 : 0.5

        // Horizontal (X axis) ticks
        const xp = cxPage + mmToPt(mm)
        page.drawLine({ start: { x: xp, y: cyPage - tickLen }, end: { x: xp, y: cyPage + tickLen }, thickness, color: tickColor })

        // Vertical (Y axis) ticks
        const yp = cyPage + mmToPt(mm)
        page.drawLine({ start: { x: cxPage - tickLen, y: yp }, end: { x: cxPage + tickLen, y: yp }, thickness, color: tickColor })

        // Labels at every 5mm
        if (isMajor) {
          const lbl = `${mm}`
          const lblSz = 5.5
          const lblW  = font.widthOfTextAtSize(lbl, lblSz)
          // Below X axis
          page.drawText(lbl, { x: xp - lblW / 2, y: cyPage - tickLen - mmToPt(3.5), size: lblSz, font, color: dark })
          // Right of Y axis
          page.drawText(lbl, { x: cxPage + tickLen + mmToPt(1.2), y: yp - lblSz / 2, size: lblSz, font, color: dark })
        }
      }

      // "mm" axis labels
      const mmSz = 5.5
      const mmW  = font.widthOfTextAtSize('mm', mmSz)
      page.drawText('mm', { x: cxPage + rangePt + mmToPt(2), y: cyPage - mmSz / 2,        size: mmSz, font, color: dark })
      page.drawText('mm', { x: cxPage - mmW / 2,              y: cyPage - rangePt - mmToPt(5), size: mmSz, font, color: dark })
    }

    // Center dot (both pages)
    page.drawEllipse({ x: cxPage, y: cyPage, xScale: 3, yScale: 3, color: orange })

    if (side === 'FRONT') {
      // ── Instructions ────────────────────────────────────────────────────────
      const lineH  = 9.5
      const instrSz = 7
      const boldSz  = 7.5

      const lines: [string, 'bold' | 'normal' | 'note'][] = [
        ['How to use this sheet:', 'bold'],
        ['1. Print this page duplex (two-sided) on your printer.', 'normal'],
        ['2. Hold the sheet with the FRONT side facing you up to a light source.', 'normal'],
        ['3. The ghosted crosshair visible through the paper is the BACK.', 'normal'],
        ['4. Measure the gap between the two center dots in millimeters.', 'normal'],
        ['', 'normal'],
        ['Direction guide:', 'bold'],
        ['Back dot to the RIGHT  ->  enter negative X  (e.g. -2)', 'normal'],
        ['Back dot to the LEFT   ->  enter positive X  (e.g. +2)', 'normal'],
        ['Back dot BELOW Front dot  ->  enter negative Y  (e.g. -2)', 'normal'],
        ['Back dot ABOVE Front dot  ->  enter positive Y  (e.g. +2)', 'normal'],
        ['', 'normal'],
        ['Enter measured values in Spark -> App Settings -> Printing -> Registration Offset', 'note'],
      ]

      let lineY = mmToPt(8) + lineH * lines.length
      for (const [text, style] of lines) {
        if (text) {
          const sz  = style === 'normal' ? instrSz : boldSz
          const f   = style === 'bold' ? fontBold : font
          const col = style === 'note' ? light : style === 'bold' ? dark : mid
          const tw  = f.widthOfTextAtSize(text, sz)
          page.drawText(text, { x: (wPt - tw) / 2, y: lineY, size: sz, font: f, color: col })
        }
        lineY -= lineH
      }
    }
  }

  return pdfDoc.save()
}

export function registerCalibrationHandlers(): void {
  ipcMain.handle(IPC.CALIBRATION_PRINT, async (_event, payload: CalibPayload): Promise<IpcResult> => {
    try {
      const pdfBytes = await generateCalibrationPdf(payload)
      const tmpPath  = join(tmpdir(), `spark-calibration-${Date.now()}.pdf`)
      writeFileSync(tmpPath, pdfBytes)
      shell.openPath(tmpPath)
      return { ok: true }
    } catch (err: any) {
      return { ok: false, error: err?.message ?? 'Failed to generate calibration sheet' }
    }
  })
}
