import { ipcMain, dialog, app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { IPC } from '../../shared/ipc-channels'
import type { IpcResult, PrintFile } from '../../shared/types'

let lastProjectPath: string | null = null

export function registerFileHandlers(): void {
  // Read any local file as a base64 data URL (used by the renderer for image display)
  ipcMain.handle(IPC.FILE_READ_DATA_URL, async (_event, filePath: string): Promise<IpcResult<string>> => {
    try {
      if (!existsSync(filePath)) return { ok: false, error: 'File not found: ' + filePath }
      const bytes = readFileSync(filePath)
      const ext = filePath.split('.').pop()?.toLowerCase() ?? 'jpg'
      const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg'
      return { ok: true, data: `data:${mime};base64,${bytes.toString('base64')}` }
    } catch (err: any) {
      return { ok: false, error: err?.message ?? 'Failed to read file' }
    }
  })

  // Open a local image file
  ipcMain.handle(IPC.FILE_OPEN_IMAGE, async (): Promise<IpcResult<{ filePath: string }>> => {
    const result = await dialog.showOpenDialog({
      title: 'Select Card Image',
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }
      ],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, error: 'Cancelled' }
    }
    return { ok: true, data: { filePath: result.filePaths[0] } }
  })

  // Open an .exe file (for SumatraPDF path selection)
  ipcMain.handle(IPC.FILE_OPEN_EXE, async (): Promise<IpcResult<{ filePath: string }>> => {
    const result = await dialog.showOpenDialog({
      title: 'Select Executable',
      filters: [{ name: 'Executable', extensions: ['exe'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, error: 'Cancelled' }
    }
    return { ok: true, data: { filePath: result.filePaths[0] } }
  })

  // Open a project file
  ipcMain.handle(IPC.FILE_OPEN_PROJECT, async (): Promise<IpcResult<PrintFile>> => {
    const result = await dialog.showOpenDialog({
      title: 'Open Print Project',
      filters: [{ name: 'Spark Project', extensions: ['spark'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, error: 'Cancelled' }
    }
    try {
      const raw = readFileSync(result.filePaths[0], 'utf-8')
      const data = JSON.parse(raw) as PrintFile
      lastProjectPath = result.filePaths[0]
      return { ok: true, data }
    } catch (err: any) {
      return { ok: false, error: err?.message ?? 'Failed to read project file' }
    }
  })

  // Save project to existing path or prompt for new
  ipcMain.handle(IPC.FILE_SAVE_PROJECT, async (_event, data: PrintFile): Promise<IpcResult> => {
    if (!lastProjectPath) return saveAs(data)
    try {
      writeFileSync(lastProjectPath, JSON.stringify(data, null, 2), 'utf-8')
      return { ok: true }
    } catch (err: any) {
      return { ok: false, error: err?.message ?? 'Failed to save' }
    }
  })

  // Save project as new file
  ipcMain.handle(IPC.FILE_SAVE_PROJECT_AS, async (_event, data: PrintFile): Promise<IpcResult> => {
    return saveAs(data)
  })
}

async function saveAs(data: PrintFile): Promise<IpcResult> {
  const result = await dialog.showSaveDialog({
    title: 'Save Print Project',
    defaultPath: `spark-${new Date().toISOString().slice(0,10)}.spark`,
    filters: [{ name: 'Spark Project', extensions: ['spark'] }]
  })
  if (result.canceled || !result.filePath) return { ok: false, error: 'Cancelled' }
  try {
    writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8')
    lastProjectPath = result.filePath
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Failed to save' }
  }
}
