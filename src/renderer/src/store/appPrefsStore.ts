import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppPrefs {
  confirmClearAll: boolean
  defaultZoomIndex: number // 0–4, maps to ZOOM_STEPS in PrintPreview
  showSplash: boolean
  defaultPresetName: string | null
  printMethod: 'viewer' | 'sumatra' | 'browser'
  sumatraPath: string
  theme: string
  searchMode: 'select-printing' | 'direct-add'
  registrationOffsetX: number
  registrationOffsetY: number
  tourCompleted: boolean

  setConfirmClearAll: (v: boolean) => void
  setDefaultZoomIndex: (v: number) => void
  setShowSplash: (v: boolean) => void
  setDefaultPresetName: (v: string | null) => void
  setPrintMethod: (v: 'viewer' | 'sumatra' | 'browser') => void
  setSumatraPath: (v: string) => void
  setTheme: (v: string) => void
  setSearchMode: (v: 'select-printing' | 'direct-add') => void
  setRegistrationOffset: (x: number, y: number) => void
  setTourCompleted: (v: boolean) => void
}

export const useAppPrefsStore = create<AppPrefs>()(
  persist(
    (set) => ({
      confirmClearAll: true,
      defaultZoomIndex: 2, // 70% — matches original default
      showSplash: true,
      defaultPresetName: null,
      printMethod: 'viewer',
      sumatraPath: '',
      theme: 'spark',
      searchMode: 'select-printing',
      registrationOffsetX: 0,
      registrationOffsetY: 0,
      tourCompleted: false,

      setConfirmClearAll: (v) => set({ confirmClearAll: v }),
      setDefaultZoomIndex: (v) => set({ defaultZoomIndex: v }),
      setShowSplash: (v) => set({ showSplash: v }),
      setDefaultPresetName: (v) => set({ defaultPresetName: v }),
      setPrintMethod: (v) => set({ printMethod: v }),
      setSumatraPath: (v) => set({ sumatraPath: v }),
      setTheme: (v) => set({ theme: v }),
      setSearchMode: (v) => set({ searchMode: v }),
      setRegistrationOffset: (x, y) => set({ registrationOffsetX: x, registrationOffsetY: y }),
      setTourCompleted: (v) => set({ tourCompleted: v }),
    }),
    { name: 'spark-app-prefs' }
  )
)
