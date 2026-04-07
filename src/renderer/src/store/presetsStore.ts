import { create } from 'zustand'
import type { Preset, PrintSettings } from '../../../shared/types'
import { bridge } from '../api/bridge'

interface PresetsState {
  presets: Preset[]
  loaded: boolean

  loadPresets: () => Promise<void>
  savePreset: (name: string, settings: PrintSettings) => Promise<void>
  deletePreset: (name: string) => Promise<void>
}

export const usePresetsStore = create<PresetsState>((set, get) => ({
  presets: [],
  loaded: false,

  loadPresets: async () => {
    if (get().loaded) return
    const result = await bridge.listPresets()
    if (result.ok && result.data) set({ presets: result.data, loaded: true })
  },

  savePreset: async (name: string, settings: PrintSettings) => {
    const preset: Preset = { name, settings, createdAt: new Date().toISOString() }
    await bridge.savePreset(preset)
    // Refresh list from disk to get latest state
    const result = await bridge.listPresets()
    if (result.ok && result.data) set({ presets: result.data })
  },

  deletePreset: async (name: string) => {
    await bridge.deletePreset(name)
    set((s) => ({ presets: s.presets.filter((p) => p.name !== name) }))
  },
}))
