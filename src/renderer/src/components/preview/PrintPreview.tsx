import React, { useState, useRef, useEffect } from 'react'
import { useDeckStore } from '../../store/deckStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useUiStore } from '../../store/uiStore'

import { useLayoutEngine } from '../../hooks/useLayoutEngine'
import { PreviewPage } from './PreviewPage'
import { SparkLogo } from '../layout/SparkLogo'
import { mmToCssPx } from '../../utils/units'

const ZOOM_STEPS = [0.4, 0.55, 0.7, 0.85, 1.0, 1.25, 1.5, 1.75, 2.0]

export function PrintPreview(): React.ReactElement {
  const cards = useDeckStore((s) => s.cards)
  const { settings } = useSettingsStore()
  const { previewPageIndex, setPreviewPage, hoveredCardId } = useUiStore()
  const [zoomIndex, setZoomIndex] = useState(2)
  const [viewMode, setViewMode] = useState<'single' | 'spread'>('single')
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const layout = useLayoutEngine(cards, settings)
  const { pages } = layout
  const isDuplex = settings.duplex !== 'none'

  // In spread mode always land on a front page (even index)
  const frontIndex = viewMode === 'spread' && isDuplex && previewPageIndex % 2 !== 0
    ? previewPageIndex - 1
    : previewPageIndex
  const frontPage = pages[frontIndex] ?? null
  const backPage  = viewMode === 'spread' && isDuplex ? (pages[frontIndex + 1] ?? null) : null
  const currentPage = frontPage  // used for single-mode label logic

  const sheetCount  = isDuplex ? Math.ceil(pages.length / 2) : pages.length
  const sheetIndex  = isDuplex ? Math.floor(frontIndex / 2) : frontIndex  // 0-based

  const paperCssPxW = mmToCssPx(layout.paperWidthMm)
  const paperCssPxH = mmToCssPx(layout.paperHeightMm)
  const scale = ZOOM_STEPS[zoomIndex]

  // Auto-fit to window on initial mount so the preview looks right on any screen size
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const container = scrollContainerRef.current
      if (!container) return
      const availW = container.clientWidth - 64
      const availH = container.clientHeight - 64
      const fitScale = Math.min(availW / paperCssPxW, availH / paperCssPxH)
      let bestIndex = 0
      for (let i = 0; i < ZOOM_STEPS.length; i++) {
        if (ZOOM_STEPS[i] <= fitScale) bestIndex = i
      }
      setZoomIndex(bestIndex)
    })
    return () => cancelAnimationFrame(raf)
  }, []) // intentionally runs once on mount

  const goToPrev = () => {
    const step = viewMode === 'spread' && isDuplex ? 2 : 1
    setPreviewPage(Math.max(0, frontIndex - step))
  }
  const goToNext = () => {
    const step = viewMode === 'spread' && isDuplex ? 2 : 1
    setPreviewPage(Math.min(pages.length - 1, frontIndex + step))
  }

  const toggleViewMode = () => {
    setViewMode((v) => {
      const next = v === 'single' ? 'spread' : 'single'
      // Snap to front page when entering spread
      if (next === 'spread' && isDuplex && previewPageIndex % 2 !== 0) {
        setPreviewPage(previewPageIndex - 1)
      }
      return next
    })
  }

  const handleZoomFit = () => {
    const container = scrollContainerRef.current
    if (!container) return
    const availW = container.clientWidth - 64
    const availH = container.clientHeight - 64
    // Account for two pages + gap in spread mode
    const totalW = viewMode === 'spread' && isDuplex ? paperCssPxW * 2 + 16 : paperCssPxW
    const fitScale = Math.min(availW / totalW, availH / paperCssPxH)
    let bestIndex = 0
    for (let i = 0; i < ZOOM_STEPS.length; i++) {
      if (ZOOM_STEPS[i] <= fitScale) bestIndex = i
    }
    setZoomIndex(bestIndex)
  }

  if (pages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2.5 mb-11">
        <SparkLogo className="w-32 h-32 text-ink select-none opacity-[0.08]" />
        <p className="text-ink/20 text-sm">Add cards to see a print preview.</p>
      </div>
    )
  }

  return (
    <div data-tour="print-preview" className="flex flex-col flex-1 min-h-0">
      {/* Nav bar */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-surface-border flex-shrink-0 bg-surface-card">
        {/* Prev */}
        <button
          onClick={goToPrev}
          disabled={frontIndex === 0}
          className="text-ink/40 hover:text-ink disabled:opacity-20 w-6 h-6 flex items-center justify-center rounded hover:bg-surface-elevated transition-colors text-base"
        >‹</button>

        <div className="flex items-center gap-1.5 px-1">
          {viewMode === 'spread' && isDuplex ? (
            <>
              <span className="text-ink/55 text-xs font-medium tabular-nums">Sheet {sheetIndex + 1}</span>
              <span className="text-ink/20 text-xs">/</span>
              <span className="text-ink/30 text-xs tabular-nums">{sheetCount}</span>
              <span className="text-xs px-1.5 py-0.5 rounded-full border text-ink/25 border-surface-border">front + back</span>
            </>
          ) : (
            <>
              <span className="text-ink/55 text-xs font-medium tabular-nums">{frontIndex + 1}</span>
              <span className="text-ink/20 text-xs">/</span>
              <span className="text-ink/30 text-xs tabular-nums">{pages.length}</span>
              {currentPage && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full border ${
                  currentPage.isFrontPage
                    ? 'text-accent/60 border-accent/30 bg-accent/5'
                    : 'text-ink/25 border-surface-border'
                }`}>
                  {currentPage.isFrontPage ? 'front' : 'back'}
                </span>
              )}
            </>
          )}
        </div>

        {/* Next */}
        <button
          onClick={goToNext}
          disabled={viewMode === 'spread' && isDuplex ? frontIndex + 2 >= pages.length : frontIndex >= pages.length - 1}
          className="text-ink/40 hover:text-ink disabled:opacity-20 w-6 h-6 flex items-center justify-center rounded hover:bg-surface-elevated transition-colors text-base"
        >›</button>

        {/* Page / sheet dots */}
        {(viewMode === 'spread' && isDuplex ? sheetCount : pages.length) <= 12 && (
          <div className="flex gap-1 ml-1">
            {viewMode === 'spread' && isDuplex
              ? Array.from({ length: sheetCount }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setPreviewPage(i * 2)}
                    className={`rounded-full transition-all ${
                      i === sheetIndex
                        ? 'w-3 h-1.5 bg-accent'
                        : 'w-1.5 h-1.5 bg-white/15 hover:bg-white/35'
                    }`}
                  />
                ))
              : pages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPreviewPage(i)}
                    className={`rounded-full transition-all ${
                      i === frontIndex
                        ? 'w-3 h-1.5 bg-accent'
                        : 'w-1.5 h-1.5 bg-white/15 hover:bg-white/35'
                    }`}
                  />
                ))
            }
          </div>
        )}

        <div className="flex-1" />

        {/* Zoom controls */}
        <div className="flex items-center gap-0.5 bg-surface-elevated rounded border border-surface-border px-1">
          <button
            onClick={() => setZoomIndex(Math.max(0, zoomIndex - 1))}
            disabled={zoomIndex === 0}
            className="text-ink/35 hover:text-ink disabled:opacity-20 w-5 h-5 flex items-center justify-center rounded text-sm transition-colors"
          >−</button>
          <span className="text-ink/40 text-xs w-8 text-center tabular-nums">{Math.round(ZOOM_STEPS[zoomIndex] * 100)}%</span>
          <button
            onClick={() => setZoomIndex(Math.min(ZOOM_STEPS.length - 1, zoomIndex + 1))}
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            className="text-ink/35 hover:text-ink disabled:opacity-20 w-5 h-5 flex items-center justify-center rounded text-sm transition-colors"
          >+</button>
        </div>

        {/* Zoom to fit */}
        <button
          onClick={handleZoomFit}
          title="Zoom to fit"
          className="text-ink/25 hover:text-ink/65 hover:bg-surface-elevated w-6 h-6 flex items-center justify-center rounded transition-colors ml-0.5"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="1" y="1" width="10" height="10" rx="1" />
            <path d="M4 1v2M8 1v2M4 9v2M8 9v2M1 4h2M1 8h2M9 4h2M9 8h2" />
          </svg>
        </button>

        {/* Spread toggle — only relevant in duplex */}
        {isDuplex && (
          <button
            onClick={toggleViewMode}
            title={viewMode === 'spread' ? 'Single page view' : 'Spread view (front + back)'}
            className={`w-6 h-6 flex items-center justify-center rounded transition-colors ml-0.5 ${
              viewMode === 'spread'
                ? 'text-accent/70 bg-accent/10'
                : 'text-ink/25 hover:text-ink/65 hover:bg-surface-elevated'
            }`}
          >
            {viewMode === 'spread' ? (
              /* single-page icon */
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x="2.5" y="1" width="7" height="10" rx="1" />
              </svg>
            ) : (
              /* spread icon — two pages side by side */
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x="0.5" y="1" width="5" height="10" rx="1" />
                <rect x="6.5" y="1" width="5" height="10" rx="1" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Preview area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto min-h-0 bg-surface-canvas"
        style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(var(--accent-secondary-rgb) / 0.07) 0%, transparent 60%)' }}
      >
        <div className="flex justify-center items-start p-8 gap-4">
          {frontPage && (
            <div style={{ width: paperCssPxW * scale, height: paperCssPxH * scale, flexShrink: 0 }}>
              <PreviewPage
                page={frontPage}
                cards={cards}
                settings={settings}
                scale={scale}
                paperWidthMm={layout.paperWidthMm}
                paperHeightMm={layout.paperHeightMm}
                cardSlotWidthMm={layout.cardSlotWidthMm}
                cardSlotHeightMm={layout.cardSlotHeightMm}
                effectiveMarginLeftMm={layout.effectiveMarginLeftMm}
                effectiveMarginTopMm={layout.effectiveMarginTopMm}
                highlightCardId={hoveredCardId}
              />
            </div>
          )}
          {backPage && (
            <div style={{ width: paperCssPxW * scale, height: paperCssPxH * scale, flexShrink: 0 }}>
              <PreviewPage
                page={backPage}
                cards={cards}
                settings={settings}
                scale={scale}
                paperWidthMm={layout.paperWidthMm}
                paperHeightMm={layout.paperHeightMm}
                cardSlotWidthMm={layout.cardSlotWidthMm}
                cardSlotHeightMm={layout.cardSlotHeightMm}
                effectiveMarginLeftMm={layout.effectiveMarginLeftMm}
                effectiveMarginTopMm={layout.effectiveMarginTopMm}
                highlightCardId={hoveredCardId}
              />
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="px-3 py-1.5 border-t border-surface-border flex gap-2 flex-shrink-0 bg-surface-card">
        {[
          `${layout.cols}×${layout.rows}`,
          `${layout.cols * layout.rows} per page`,
          `${pages.length} page${pages.length !== 1 ? 's' : ''}`,
        ].map((label) => (
          <span key={label} className="text-ink/25 text-xs">{label}</span>
        ))}
        {settings.bleed.enabled && (
          <span className="text-accent/60 text-xs ml-auto">bleed {settings.bleed.amountMm}mm</span>
        )}
        {settings.duplex !== 'none' && (
          <span className={`text-accent/60 text-xs ${settings.bleed.enabled ? '' : 'ml-auto'}`}>duplex</span>
        )}
      </div>
    </div>
  )
}
