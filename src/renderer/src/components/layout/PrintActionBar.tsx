import React, { useState, useEffect, useCallback } from 'react'
import { useDeckStore } from '../../store/deckStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useUiStore } from '../../store/uiStore'
import { useAppPrefsStore } from '../../store/appPrefsStore'
import { useLayoutEngine } from '../../hooks/useLayoutEngine'
import { bridge } from '../../api/bridge'
import type { PrintCard, CardFace } from '../../../../shared/types'
import { AppSettingsModal } from './AppSettingsModal'
import { SparkLogo } from './SparkLogo'

// Applied to all interactive elements inside the titlebar drag region
const NO_DRAG: React.CSSProperties = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

function stripDataUrls(cards: PrintCard[]): PrintCard[] {
  return cards.map(c => ({
    ...c,
    front: { ...c.front, dataUrl: undefined },
    back: c.back === 'default' ? 'default' : { ...(c.back as CardFace), dataUrl: undefined }
  }))
}

async function rehydrateCards(cards: PrintCard[]): Promise<PrintCard[]> {
  return Promise.all(cards.map(async (card) => {
    const newCard = { ...card }
    if (card.front.cachedPath) {
      const du = await bridge.readFileAsDataUrl(card.front.cachedPath)
      if (du.ok && du.data) newCard.front = { ...newCard.front, dataUrl: du.data }
    }
    if (card.back !== 'default') {
      const back = card.back as CardFace
      if (back.cachedPath) {
        const du = await bridge.readFileAsDataUrl(back.cachedPath)
        if (du.ok && du.data) newCard.back = { ...back, dataUrl: du.data }
      }
    }
    return newCard
  }))
}

export function PrintActionBar(): React.ReactElement {
  const cards = useDeckStore((s) => s.cards)
  const deckDirty = useDeckStore((s) => s.isDirty)
  const settingsDirty = useSettingsStore((s) => s.isDirty)
  const { settings } = useSettingsStore()
  const { isExporting, exportMessage, exportError, setExporting, setExportError, appSettingsOpen, setAppSettingsOpen } = useUiStore()
  const theme = useAppPrefsStore((s) => s.theme)
  const layout = useLayoutEngine(cards, settings)
  const [isMaximized, setIsMaximized] = useState(false)

  const isDirty = deckDirty || settingsDirty

  useEffect(() => {
    bridge.windowIsMaximized().then((v: boolean) => setIsMaximized(v))
  }, [])

  const handlePrint = useCallback(async () => {
    if (cards.length === 0) return
    setExporting(true, 'Preparing print...')
    const { printMethod, sumatraPath, registrationOffsetX: ox, registrationOffsetY: oy } = useAppPrefsStore.getState()
    const offset = (ox !== 0 || oy !== 0) ? { x: ox, y: oy } : undefined
    const result = await bridge.executePrint({ pages: layout.pages, cards, settings, outputMode: 'print' }, printMethod, sumatraPath, offset)
    if (result.ok) setExporting(false)
    else setExportError(result.error ?? 'Print failed')
  }, [cards, layout, settings, setExporting, setExportError])

  const handleExportPdf = useCallback(async () => {
    if (cards.length === 0) return
    setExporting(true, 'Generating PDF...')
    const { registrationOffsetX: ox, registrationOffsetY: oy } = useAppPrefsStore.getState()
    const offset = (ox !== 0 || oy !== 0) ? { x: ox, y: oy } : undefined
    const result = await bridge.exportPdf({ pages: layout.pages, cards, settings, outputMode: 'pdf' }, offset)
    if (result.ok) setExporting(false)
    else setExportError(result.error ?? 'PDF export failed')
  }, [cards, layout, settings, setExporting, setExportError])

  const handleSave = useCallback(async () => {
    const { settings: s } = useSettingsStore.getState()
    const { cards: c } = useDeckStore.getState()
    const result = await bridge.saveProject({
      version: 1,
      cards: stripDataUrls(c),
      settings: { ...s, defaultBack: { ...s.defaultBack, dataUrl: undefined } },
      savedAt: new Date().toISOString()
    })
    if (result.ok) {
      useDeckStore.getState().markClean()
      useSettingsStore.getState().markClean()
    }
  }, [])

  const handleOpen = useCallback(async () => {
    const result = await bridge.openProject()
    if (!result.ok || !result.data) return
    if (result.data.version !== 1) {
      setExportError(`This project was saved with a newer version of Spark and cannot be opened.`)
      return
    }
    const rehydrated = await rehydrateCards(result.data.cards)
    useDeckStore.getState().setCards(rehydrated)
    const loadedSettings = result.data.settings
    if (loadedSettings.defaultBack.imageSource.kind === 'builtin') {
      const pathResult = await bridge.getDefaultBackPath()
      if (pathResult.ok && pathResult.data) {
        const du = await bridge.readFileAsDataUrl(pathResult.data)
        if (du.ok && du.data) {
          loadedSettings.defaultBack = { ...loadedSettings.defaultBack, cachedPath: pathResult.data, dataUrl: du.data }
        }
      }
    } else if (loadedSettings.defaultBack.cachedPath) {
      const du = await bridge.readFileAsDataUrl(loadedSettings.defaultBack.cachedPath)
      if (du.ok && du.data) loadedSettings.defaultBack = { ...loadedSettings.defaultBack, dataUrl: du.data }
    }
    useSettingsStore.getState().setSettings(loadedSettings)
    useDeckStore.getState().markClean()
    useSettingsStore.getState().markClean()
  }, [])

  const disabled = cards.length === 0 || isExporting

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return
      if (e.key === 's') { e.preventDefault(); handleSave() }
      else if (e.key === 'o') { e.preventDefault(); handleOpen() }
      else if (e.key === 'p') { e.preventDefault(); if (!disabled) handlePrint() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleSave, handleOpen, handlePrint, disabled])

  const handleMaximize = async () => {
    await bridge.windowMaximize()
    bridge.windowIsMaximized().then((v: boolean) => setIsMaximized(v))
  }

  return (
    <>
      <AppSettingsModal />

      {/* The bar itself is the drag region */}
      <div
        className="flex items-center h-11 bg-surface-card border-b border-surface-border flex-shrink-0 select-none"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Left: app identity */}
        <div className="flex items-center gap-2 pl-4 pr-3">
          <SparkLogo className="h-5 w-5 text-accent-secondary/70" />
          <span className="text-accent-secondary/70 text-xs font-bold tracking-widest uppercase">Spark</span>
        </div>

        {/* File actions */}
        <div className="flex items-center gap-0.5" style={NO_DRAG}>
          <button
            onClick={handleOpen}
            className="h-7 px-3 text-xs text-ink/35 hover:text-ink/80 hover:bg-surface-elevated rounded transition-colors"
          >
            Open
          </button>
          <div className="relative">
            <button
              onClick={handleSave}
              className="h-7 px-3 text-xs text-ink/35 hover:text-ink/80 hover:bg-surface-elevated rounded transition-colors"
            >
              Save
            </button>
            {/* Unsaved changes dot */}
            {isDirty && (
              <span
                className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent/80 pointer-events-none"
                title="Unsaved changes"
              />
            )}
          </div>
        </div>

        {/* Drag spacer — takes up all remaining space */}
        <div className="flex-1 flex items-center justify-center gap-3 pointer-events-none">
          {isExporting && (
            <span className="flex items-center gap-1.5 text-ink/30 text-xs pointer-events-none">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping inline-block" />
              {exportMessage}
            </span>
          )}
          {exportError && (
            <span className="text-red-400/80 text-xs pointer-events-none">{exportError}</span>
          )}
        </div>

        {/* Right: output actions */}
        <div data-tour="output-buttons" className="flex items-center gap-2 pr-3" style={NO_DRAG}>
          <button
            onClick={handleExportPdf}
            disabled={disabled}
            className="h-7 px-3 text-xs border border-accent-secondary/40 text-accent-secondary/70 hover:text-accent-secondary/90 hover:border-accent-secondary/70 rounded hover:bg-accent-secondary/8 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
          >
            Export PDF
          </button>
          <button
            onClick={handlePrint}
            disabled={disabled}
            className={`h-7 px-4 text-xs bg-accent-secondary hover:bg-accent-secondary/85 font-semibold rounded disabled:opacity-25 disabled:cursor-not-allowed transition-colors shadow-sm ${theme === 'order' ? 'text-white' : 'text-ink'}`}
          >
            Print
          </button>

          {/* Settings */}
          <div className="w-px h-4 bg-surface-border mx-1" />
          <button
            onClick={() => setAppSettingsOpen(!appSettingsOpen)}
            title="App settings"
            className={`h-7 w-7 flex items-center justify-center rounded text-sm transition-all ${
              appSettingsOpen
                ? 'bg-surface-elevated text-ink/60 border border-surface-border'
                : 'text-ink/25 hover:text-ink/65 hover:bg-surface-elevated'
            }`}
          >
            ⚙
          </button>
        </div>

        {/* Window controls — rightmost, no-drag */}
        <div className="flex items-stretch h-full" style={NO_DRAG}>
          <div className="w-px bg-surface-border self-stretch my-0" />
          <button
            onClick={() => bridge.windowMinimize()}
            className="w-11 flex items-center justify-center text-ink/25 hover:text-ink/70 hover:bg-surface-elevated transition-colors"
            title="Minimize"
          >
            <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
              <rect width="10" height="1" />
            </svg>
          </button>
          <button
            onClick={handleMaximize}
            className="w-11 flex items-center justify-center text-ink/25 hover:text-ink/70 hover:bg-surface-elevated transition-colors"
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized
              ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
                  <rect x="2" y="0" width="8" height="8" />
                  <polyline points="0,2 0,10 8,10" />
                </svg>
              : <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
                  <rect x="0" y="0" width="10" height="10" />
                </svg>
            }
          </button>
          <button
            onClick={() => bridge.windowClose()}
            className="w-11 flex items-center justify-center text-ink/25 hover:text-ink hover:bg-red-500/80 transition-colors"
            title="Close"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2">
              <line x1="0" y1="0" x2="10" y2="10" />
              <line x1="10" y1="0" x2="0" y2="10" />
            </svg>
          </button>
        </div>
      </div>
    </>
  )
}
