import React, { Suspense, useLayoutEffect, useEffect, useState, useCallback } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { PrintActionBar } from './components/layout/PrintActionBar'
import { PrintPreview } from './components/preview/PrintPreview'
import { CardList } from './components/cards/CardList'
import { SplashScreen } from './components/layout/SplashScreen'
import { TourOverlay } from './components/layout/TourOverlay'
import { useSettingsStore } from './store/settingsStore'
import { useAppPrefsStore } from './store/appPrefsStore'
import { useTourStore } from './store/tourStore'
import { bridge } from './api/bridge'

export default function App(): React.ReactElement {
  const { updateSettings, setSettings, settings } = useSettingsStore()
  const theme = useAppPrefsStore((s) => s.theme)
  const splashEnabled = useAppPrefsStore((s) => s.showSplash)
  const tourCompleted = useAppPrefsStore((s) => s.tourCompleted)
  const startTour = useTourStore((s) => s.startTour)
  const [showSplash, setShowSplash] = useState(splashEnabled)

  const handleSplashDone = useCallback(() => {
    setShowSplash(false)
    // Start guided tour for first-time users after splash clears
    if (!tourCompleted) {
      setTimeout(() => startTour(), 400)
    }
  }, [tourCompleted, startTour])

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    ;(async () => {
      // Load app defaults first (user-saved defaults, or built-in defaults)
      const defaultsResult = await bridge.loadAppDefaults()
      if (defaultsResult.ok && defaultsResult.data) {
        setSettings(defaultsResult.data)
      }
    })()
  }, [])

  // Auto-reload the built-in card back image whenever it loses its dataUrl.
  // This can happen on startup, after applying a preset, or after resetting
  // the default back in settings — any time settings are replaced without
  // including the runtime dataUrl.
  const builtinBackMissing =
    settings.defaultBack.imageSource.kind === 'builtin' && !settings.defaultBack.dataUrl

  useEffect(() => {
    if (!builtinBackMissing) return
    ;(async () => {
      const pathResult = await bridge.getDefaultBackPath()
      if (!pathResult.ok || !pathResult.data) return
      const duResult = await bridge.readFileAsDataUrl(pathResult.data)
      if (!duResult.ok || !duResult.data) return
      updateSettings({
        defaultBack: {
          imageSource: { kind: 'builtin', name: 'MTG Card Back' },
          cachedPath: pathResult.data,
          dataUrl: duResult.data
        }
      })
    })()
  }, [builtinBackMissing])

  // When splash is disabled, start tour on first paint instead
  useEffect(() => {
    if (!splashEnabled && !tourCompleted) {
      setTimeout(() => startTour(), 600)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-screen bg-surface text-ink overflow-hidden">
      {showSplash && <SplashScreen onDone={handleSplashDone} />}
      <TourOverlay />
      <PrintActionBar />

      <div className="flex flex-1 min-h-0">
        <Suspense fallback={<div className="w-72 bg-surface-card" />}>
          <Sidebar />
        </Suspense>

        <main className="flex-1 min-w-0 flex flex-col">
          <Suspense fallback={<div className="flex-1 flex items-center justify-center text-ink/20">Loading...</div>}>
            <PrintPreview />
          </Suspense>
        </main>

        {/* Right panel — card list */}
        <div data-tour="card-list" className="w-72 flex-shrink-0 bg-surface-card border-l border-surface-border flex flex-col shadow-panel">
          <CardList />
        </div>
      </div>
    </div>
  )
}
