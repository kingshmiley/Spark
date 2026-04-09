import { ipcMain, BrowserWindow, dialog, shell } from 'electron'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { exec } from 'child_process'
import { IPC } from '../../shared/ipc-channels'
import type { IpcResult, PrintJob } from '../../shared/types'
import { generatePdf } from '../services/pdf.service'
import { getDefaultBackPath } from './cache.handler'

function mapDuplex(duplex: string): 'simplex' | 'shortEdge' | 'longEdge' {
  if (duplex === 'long-edge')  return 'longEdge'
  if (duplex === 'short-edge') return 'shortEdge'
  return 'simplex'
}

// Electron pageSize expects { width, height } in microns, OR a named string.
// Named strings are the safest — Electron maps these to correct driver values.
function mapPaperSize(size: string, orientation: string, customW?: number, customH?: number): string | { width: number; height: number } {
  // For custom sizes, supply microns (1 mm = 1000 microns)
  if (size === 'custom' && customW && customH) {
    const w = Math.round(customW * 1000)
    const h = Math.round(customH * 1000)
    return orientation === 'landscape' ? { width: h, height: w } : { width: w, height: h }
  }
  // Named sizes — Electron/Chromium recognises these directly
  const named: Record<string, string> = {
    letter:  'Letter',
    a4:      'A4',
    legal:   'Legal',
    tabloid: 'Tabloid',
  }
  return named[size] ?? 'Letter'
}

export function registerPrintHandlers(): void {
  // PDF save-path chooser
  ipcMain.handle(IPC.PDF_CHOOSE_PATH, async (): Promise<IpcResult<string>> => {
    const result = await dialog.showSaveDialog({
      title: 'Save PDF',
      defaultPath: `spark-${new Date().toISOString().slice(0, 10)}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (result.canceled || !result.filePath) return { ok: false, error: 'Cancelled' }
    return { ok: true, data: result.filePath }
  })

  // PDF export to file
  ipcMain.handle(IPC.PDF_EXPORT, async (_event, job: PrintJob, registrationOffset?: { x: number; y: number }): Promise<IpcResult<{ outputPath: string }>> => {
    try {
      let outputPath = job.pdfOutputPath
      if (!outputPath) {
        const result = await dialog.showSaveDialog({
          title: 'Save PDF',
          defaultPath: `spark-${new Date().toISOString().slice(0, 10)}.pdf`,
          filters: [{ name: 'PDF', extensions: ['pdf'] }]
        })
        if (result.canceled || !result.filePath) return { ok: false, error: 'Cancelled' }
        outputPath = result.filePath
      }
      const pdfBytes = await generatePdf(job, getDefaultBackPath(), registrationOffset)
      writeFileSync(outputPath, pdfBytes)
      return { ok: true, data: { outputPath } }
    } catch (err: any) {
      return { ok: false, error: err?.message ?? 'PDF export failed' }
    }
  })

  // Direct print — supports three methods:
  //   'viewer'  — write PDF to temp file, open in system default PDF viewer (user prints manually)
  //   'sumatra' — write PDF to temp file, print via SumatraPDF command line
  //   'browser' (default) — write PDF to temp file, load in hidden BrowserWindow, call webContents.print()
  ipcMain.handle(IPC.PRINT_EXECUTE, async (_event, job: PrintJob, method?: string, sumatraPath?: string, registrationOffset?: { x: number; y: number }): Promise<IpcResult> => {
    const tmpPath = join(tmpdir(), `spark-print-${Date.now()}.pdf`)

    try {
      const pdfBytes = await generatePdf(job, getDefaultBackPath(), registrationOffset)
      writeFileSync(tmpPath, pdfBytes)

      // ── Option C: open in system viewer (user prints from viewer) ────────
      if (method === 'viewer') {
        shell.openPath(tmpPath) // temp file persists — OS cleanup handles it
        return { ok: true }
      }

      // ── Option B: SumatraPDF command-line print ──────────────────────────
      if (method === 'sumatra') {
        if (!sumatraPath || !existsSync(sumatraPath)) {
          // Fall back to viewer if path is invalid
          shell.openPath(tmpPath)
          return { ok: true }
        }
        return new Promise((resolve) => {
            const cmd = `"${sumatraPath}" -print-dialog -print-settings "noscale" "${tmpPath}"`
          exec(cmd, (error) => {
            // Delay deletion to let SumatraPDF read the file before the process exits
            setTimeout(() => {
              if (existsSync(tmpPath)) try { unlinkSync(tmpPath) } catch {}
            }, 5000)
            if (error) resolve({ ok: false, error: error.message })
            else resolve({ ok: true })
          })
        })
      }

      // ── Default: hidden BrowserWindow + webContents.print() ─────────────
      return new Promise((resolve) => {
        const printWin = new BrowserWindow({
          show: false,
          webPreferences: { nodeIntegration: false, contextIsolation: true, plugins: true }
        })

        printWin.loadURL(`file:///${tmpPath.replace(/\\/g, '/')}`)

        printWin.webContents.once('did-finish-load', () => {
          // The Chromium PDF viewer renders asynchronously after the file loads.
          // Calling print() immediately captures a blank page — wait for the
          // render to settle before sending to the printer.
          setTimeout(() => {
            const pageSize = mapPaperSize(
              job.settings.paperSize,
              job.settings.orientation,
              job.settings.customPaperWidthMm,
              job.settings.customPaperHeightMm
            )

            const opts: Electron.WebContentsPrintOptions = {
              silent: false,
              printBackground: true,
              deviceName: job.settings.printerName || undefined,
              copies: job.settings.copies,
              duplex: mapDuplex(job.settings.duplex) as any,
              color: job.settings.colorMode === 'color',
              landscape: job.settings.orientation === 'landscape',
              margins: { marginType: 'none' },
              pageSize: pageSize as any,
              scaleFactor: 100,
            }

            printWin.webContents.print(opts, (success, failureReason) => {
              printWin.destroy()
              if (existsSync(tmpPath)) {
                try { unlinkSync(tmpPath) } catch {}
              }
              if (success) resolve({ ok: true })
              else resolve({ ok: false, error: failureReason ?? 'Print failed' })
            })
          }, 1500)
        })

        printWin.webContents.once('did-fail-load', (_e, code, desc) => {
          printWin.destroy()
          if (existsSync(tmpPath)) {
            try { unlinkSync(tmpPath) } catch {}
          }
          resolve({ ok: false, error: `Failed to load PDF for printing: ${desc}` })
        })
      })

    } catch (err: any) {
      if (existsSync(tmpPath)) {
        try { unlinkSync(tmpPath) } catch {}
      }
      return { ok: false, error: err?.message ?? 'Print failed' }
    }
  })
}
