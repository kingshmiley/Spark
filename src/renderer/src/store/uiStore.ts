import { create } from 'zustand'

export type ActivePanel = 'cards' | 'document'
export type CardTab = 'search' | 'custom' | 'importexport'

interface UiState {
  activePanel: ActivePanel
  cardTab: CardTab
  previewPageIndex: number
  isExporting: boolean
  exportMessage: string
  exportError: string | null
  appSettingsOpen: boolean
  appSettingsTab: string | null
  hoveredCardId: string | null

  setActivePanel: (panel: ActivePanel) => void
  setCardTab: (tab: CardTab) => void
  setPreviewPage: (index: number) => void
  setExporting: (active: boolean, message?: string) => void
  setExportError: (error: string | null) => void
  setAppSettingsOpen: (open: boolean) => void
  openAppSettingsTab: (tab: string) => void
  setHoveredCardId: (id: string | null) => void
}

export const useUiStore = create<UiState>((set) => ({
  activePanel: 'cards',
  cardTab: 'search',
  previewPageIndex: 0,
  isExporting: false,
  exportMessage: '',
  exportError: null,
  appSettingsOpen: false,
  appSettingsTab: null,
  hoveredCardId: null,

  setActivePanel: (panel) => set({ activePanel: panel, previewPageIndex: 0 }),
  setCardTab: (tab) => set({ cardTab: tab }),
  setPreviewPage: (index) => set({ previewPageIndex: index }),
  setExporting: (active, message = '') => set({ isExporting: active, exportMessage: message, exportError: null }),
  setExportError: (error) => set({ exportError: error, isExporting: false }),
  setAppSettingsOpen: (open) => set({ appSettingsOpen: open, appSettingsTab: open ? null : null }),
  openAppSettingsTab: (tab) => set({ appSettingsOpen: true, appSettingsTab: tab }),
  setHoveredCardId: (id) => set({ hoveredCardId: id })
}))
