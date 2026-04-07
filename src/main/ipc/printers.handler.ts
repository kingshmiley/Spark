import { ipcMain, webContents } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import type { IpcResult, PrinterInfo } from '../../shared/types'

export function registerPrinterHandlers(): void {
  ipcMain.handle(IPC.PRINTERS_LIST, async (): Promise<IpcResult<PrinterInfo[]>> => {
    try {
      // Use the first available webContents to query printers
      const wc = webContents.getAllWebContents()[0]
      if (!wc) return { ok: true, data: [] }

      const printers = await wc.getPrintersAsync()
      const result: PrinterInfo[] = printers.map(p => ({
        name: p.name,
        isDefault: p.isDefault,
        description: p.description ?? ''
      }))
      return { ok: true, data: result }
    } catch (err: any) {
      return { ok: false, error: err?.message ?? 'Failed to list printers' }
    }
  })
}
