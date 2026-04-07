import { create } from 'zustand'
import type { PrintSettings, PrinterInfo } from '../../../shared/types'
import { DEFAULT_SETTINGS } from '../../../shared/types'
import { bridge } from '../api/bridge'

interface SettingsState {
  settings: PrintSettings
  availablePrinters: PrinterInfo[]
  isDirty: boolean

  updateSettings: (patch: Partial<PrintSettings>) => void
  resetToDefaults: () => void
  loadPrinters: () => Promise<void>
  setSettings: (settings: PrintSettings) => void
  markClean: () => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  availablePrinters: [],
  isDirty: false,

  updateSettings: (patch) =>
    set((s) => ({ settings: { ...s.settings, ...patch }, isDirty: true })),

  resetToDefaults: () =>
    set({ settings: { ...DEFAULT_SETTINGS }, isDirty: true }),

  loadPrinters: async () => {
    const result = await bridge.listPrinters()
    if (result.ok && result.data) {
      set({ availablePrinters: result.data })
      // Auto-select default printer if none chosen
      const current = get().settings.printerName
      if (!current) {
        const def = result.data.find((p) => p.isDefault)
        if (def) {
          set((s) => ({ settings: { ...s.settings, printerName: def.name } }))
        }
      }
    }
  },

  setSettings: (settings) => set({ settings }),

  markClean: () => set({ isDirty: false })
}))
