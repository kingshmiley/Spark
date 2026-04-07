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

  for (const side of ['FRONT', 'BACK'] as const) {
    const page = pdfDoc.addPage([wPt, hPt])

    // ── Branding ─────────────────────────────────────────────────────────────
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

    // Side label
    const sideText = `— ${side} —`
    const sideSize = 11
    const sideW = fontBold.widthOfTextAtSize(sideText, sideSize)
    page.drawText(sideText, {
      x: (wPt - sideW) / 2,
      y: hPt - mmToPt(28),
      size: sideSize,
      font: fontBold,
      color: side === 'FRONT' ? rgb(0.20, 0.40, 0.80) : dark,
    })

    // ── Crosshair ─────────────────────────────────────────────────────────────
    const rangeM = 15 // ±15mm
    const rangePt = mmToPt(rangeM)

    // Axis lines
    page.drawLine({ start: { x: cx - rangePt, y: cy }, end: { x: cx + rangePt, y: cy }, thickness: 0.6, color: dark })
    page.drawLine({ start: { x: cx, y: cy - rangePt }, end: { x: cx, y: cy + rangePt }, thickness: 0.6, color: dark })

    // Tick marks and labels
    for (let mm = -rangeM; mm <= rangeM; mm++) {
      if (mm === 0) continue
      const isMajor = mm % 5 === 0
      const tickLen = mmToPt(isMajor ? 2.5 : 1.2)
      const tickColor = isMajor ? dark : mid
      const thickness = isMajor ? 0.8 : 0.5

      // Horizontal (X axis) ticks
      const xp = cx + mmToPt(mm)
      page.drawLine({ start: { x: xp, y: cy - tickLen }, end: { x: xp, y: cy + tickLen }, thickness, color: tickColor })

      // Vertical (Y axis) ticks
      const yp = cy + mmToPt(mm)
      page.drawLine({ start: { x: cx - tickLen, y: yp }, end: { x: cx + tickLen, y: yp }, thickness, color: tickColor })

      // Labels at every 5mm
      if (isMajor) {
        const lbl = `${mm}`
        const lblSz = 5.5
        const lblW  = font.widthOfTextAtSize(lbl, lblSz)
        // Below X axis
        page.drawText(lbl, { x: xp - lblW / 2, y: cy - tickLen - mmToPt(3.5), size: lblSz, font, color: dark })
        // Right of Y axis
        page.drawText(lbl, { x: cx + tickLen + mmToPt(1.2), y: yp - lblSz / 2, size: lblSz, font, color: dark })
      }
    }

    // "mm" axis labels
    const mmSz = 5.5
    const mmW  = font.widthOfTextAtSize('mm', mmSz)
    page.drawText('mm', { x: cx + rangePt + mmToPt(2), y: cy - mmSz / 2,        size: mmSz, font, color: dark })
    page.drawText('mm', { x: cx - mmW / 2,              y: cy - rangePt - mmToPt(5), size: mmSz, font, color: dark })

    // Center dot
    page.drawEllipse({ x: cx, y: cy, xScale: 3, yScale: 3, color: orange })

    // ── Instructions ──────────────────────────────────────────────────────────
    const lineH  = 9.5
    const instrSz = 7
    const boldSz  = 7.5

    // Start from bottom margin, build lines upward
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
