import { ipcMain, app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { IPC } from '../../shared/ipc-channels'
import type { IpcResult, PrintSettings, Preset } from '../../shared/types'
import { DEFAULT_SETTINGS } from '../../shared/types'

function settingsDir(): string {
  const dir = join(app.getPath('userData'), 'settings')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function defaultsPath(): string { return join(settingsDir(), 'app-defaults.json') }
function presetsPath():  string { return join(settingsDir(), 'presets.json') }

function readDefaults(): PrintSettings {
  try {
    if (!existsSync(defaultsPath())) return DEFAULT_SETTINGS
    const saved = JSON.parse(readFileSync(defaultsPath(), 'utf-8')) as Partial<PrintSettings>
    return { ...DEFAULT_SETTINGS, ...saved }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function readPresets(): Preset[] {
  try {
    if (!existsSync(presetsPath())) return []
    return JSON.parse(readFileSync(presetsPath(), 'utf-8')) as Preset[]
  } catch {
    return []
  }
}

export function registerAppSettingsHandlers(): void {
  // App defaults
  ipcMain.handle(IPC.APP_DEFAULTS_LOAD, async (): Promise<IpcResult<PrintSettings>> => {
    return { ok: true, data: readDefaults() }
  })

  ipcMain.handle(IPC.APP_DEFAULTS_SAVE, async (_e, settings: PrintSettings): Promise<IpcResult> => {
    try {
      // Strip dataUrl before saving — it's runtime-only
      const toSave = { ...settings, defaultBack: { ...settings.defaultBack, dataUrl: undefined } }
      writeFileSync(defaultsPath(), JSON.stringify(toSave, null, 2), 'utf-8')
      return { ok: true }
    } catch (err: any) {
      return { ok: false, error: err?.message ?? 'Failed to save defaults' }
    }
  })

  // Presets
  ipcMain.handle(IPC.PRESETS_LIST, async (): Promise<IpcResult<Preset[]>> => {
    return { ok: true, data: readPresets() }
  })

  ipcMain.handle(IPC.PRESETS_SAVE, async (_e, preset: Preset): Promise<IpcResult> => {
    try {
      const presets = readPresets()
      const idx = presets.findIndex((p) => p.name === preset.name)
      const toSave = {
        ...preset,
        settings: { ...preset.settings, defaultBack: { ...preset.settings.defaultBack, dataUrl: undefined } }
      }
      if (idx >= 0) presets[idx] = toSave
      else presets.push(toSave)
      writeFileSync(presetsPath(), JSON.stringify(presets, null, 2), 'utf-8')
      return { ok: true }
    } catch (err: any) {
      return { ok: false, error: err?.message ?? 'Failed to save preset' }
    }
  })

  ipcMain.handle(IPC.PRESETS_DELETE, async (_e, name: string): Promise<IpcResult> => {
    try {
      const presets = readPresets().filter((p) => p.name !== name)
      writeFileSync(presetsPath(), JSON.stringify(presets, null, 2), 'utf-8')
      return { ok: true }
    } catch (err: any) {
      return { ok: false, error: err?.message ?? 'Failed to delete preset' }
    }
  })
}
