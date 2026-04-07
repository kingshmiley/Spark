import React, { useEffect, useState, useCallback } from 'react'
import { useTourStore, TOUR_STEPS } from '../../store/tourStore'
import { useAppPrefsStore } from '../../store/appPrefsStore'
import { useUiStore } from '../../store/uiStore'

// Padding (px) added around the highlighted element on all sides
const PAD = 8
// Width of the floating callout box
const CALLOUT_W = 292
// Gap between the highlighted element and the callout
const CALLOUT_GAP = 18

interface TargetRect {
  top: number; left: number; right: number; bottom: number
  width: number; height: number
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`rounded-full transition-all duration-200 ${
            i === current
              ? 'w-3 h-1.5 bg-accent'
              : i < current
                ? 'w-1.5 h-1.5 bg-accent/40'
                : 'w-1.5 h-1.5 bg-surface-border'
          }`}
        />
      ))}
      <span className="text-ink/20 text-xs ml-1 tabular-nums">{current + 1}/{total}</span>
    </div>
  )
}

function NavButtons({
  isFirst, isLast,
  onPrev, onNext, onSkip,
}: {
  isFirst: boolean; isLast: boolean
  onPrev: () => void; onNext: () => void; onSkip: () => void
}) {
  return (
    <div className="flex items-center gap-2 pt-1">
      {!isFirst && (
        <button
          onClick={onPrev}
          className="text-xs text-ink/35 hover:text-ink/70 border border-surface-border rounded px-2.5 py-1 hover:border-surface-hover bg-surface-elevated transition-colors"
        >
          Back
        </button>
      )}
      <div className="flex-1" />
      {!isLast && (
        <button
          onClick={onSkip}
          className="text-xs text-ink/25 hover:text-ink/50 transition-colors"
        >
          Skip tour
        </button>
      )}
      <button
        onClick={onNext}
        className="text-xs bg-accent hover:bg-accent/85 text-ink font-semibold rounded px-3 py-1.5 transition-colors"
      >
        {isLast ? 'Done' : 'Next'}
      </button>
    </div>
  )
}

// ─── Main overlay ─────────────────────────────────────────────────────────────

export function TourOverlay(): React.ReactElement | null {
  const { isActive, currentStep, nextStep, prevStep, endTour } = useTourStore()
  const { setTourCompleted } = useAppPrefsStore()
  const [rect, setRect] = useState<TargetRect | null>(null)
  const [visible, setVisible] = useState(false)

  const step = TOUR_STEPS[currentStep]
  const isLast  = currentStep === TOUR_STEPS.length - 1
  const isFirst = currentStep === 0

  // Apply any sidebar side-effects before measuring so the target element
  // is actually mounted by the time we do the getBoundingClientRect call.
  useEffect(() => {
    if (!isActive || !step) return
    const { setActivePanel, setCardTab } = useUiStore.getState()
    // Steps that reference left-sidebar or card-tabs need cards panel active
    if (step.target === 'left-sidebar' || step.target === 'card-tabs') {
      setActivePanel('cards')
      setCardTab('search')
    }
    // Document-tab step — the button is always visible, no switch needed
  }, [isActive, currentStep])

  // Measure after side-effects have painted (double rAF)
  const measure = useCallback(() => {
    if (!step?.target) { setRect(null); setVisible(true); return }
    const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null
    if (!el) { setRect(null); setVisible(true); return }
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height })
    setVisible(true)
  }, [step])

  useEffect(() => {
    if (!isActive) { setVisible(false); return }
    setVisible(false)
    let raf1: number, raf2: number
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(measure)
    })
    const onResize = () => measure()
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      window.removeEventListener('resize', onResize)
    }
  }, [isActive, currentStep, measure])

  if (!isActive || !step) return null

  const handleNext = () => {
    if (isLast) { setTourCompleted(true); endTour() }
    else nextStep()
  }
  const handleSkip = () => { setTourCompleted(true); endTour() }

  // ── No target: centered modal ──────────────────────────────────────────────
  if (!rect || !step.target) {
    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center"
        style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.15s ease' }}
      >
        <div className="absolute inset-0 bg-black/70" onClick={handleSkip} />
        <div
          key={currentStep}
          className="relative z-10 w-80 bg-surface-card border border-surface-border rounded-xl shadow-2xl p-6 flex flex-col gap-4"
          style={{ animation: visible ? 'tourFadeUp 0.2s ease-out both' : undefined }}
        >
          <ProgressDots current={currentStep} total={TOUR_STEPS.length} />
          <div>
            <h2 className="text-ink/90 text-base font-bold mb-2 leading-snug">{step.title}</h2>
            <p className="text-ink/55 text-sm leading-relaxed">{step.body}</p>
          </div>
          <NavButtons isFirst={isFirst} isLast={isLast} onPrev={prevStep} onNext={handleNext} onSkip={handleSkip} />
        </div>
      </div>
    )
  }

  // ── Targeted step: 4-panel overlay + callout ──────────────────────────────
  const vw = window.innerWidth
  const vh = window.innerHeight

  const padTop    = Math.max(0, rect.top    - PAD)
  const padLeft   = Math.max(0, rect.left   - PAD)
  const padRight  = Math.min(vw, rect.right  + PAD)
  const padBottom = Math.min(vh, rect.bottom + PAD)

  const holeW = padRight  - padLeft
  const holeH = padBottom - padTop

  // Callout horizontal placement: prefer the side indicated by the step,
  // fall back to whichever side has more room.
  const targetCenterX = (rect.left + rect.right) / 2
  const autoSide = targetCenterX < vw / 2 ? 'right' : 'left'
  const side = step.preferSide ?? autoSide

  const targetCenterY = (rect.top + rect.bottom) / 2
  const CALLOUT_MIN_HEIGHT = 180 // rough estimate to keep callout within viewport
  const calloutTop = Math.max(8, Math.min(vh - CALLOUT_MIN_HEIGHT - 8, targetCenterY - 90))

  const calloutStyle: React.CSSProperties =
    side === 'right'
      ? { position: 'fixed', top: calloutTop, left: padRight + CALLOUT_GAP, width: CALLOUT_W }
      : { position: 'fixed', top: calloutTop, right: vw - padLeft + CALLOUT_GAP, width: CALLOUT_W }

  // Arrow pointing back toward the highlighted element
  const arrowStyle: React.CSSProperties =
    side === 'right'
      ? {
          position: 'absolute',
          left: -8,
          top: Math.min(holeH / 2 + (padTop - calloutTop), 80),
          width: 0, height: 0,
          borderTop: '8px solid transparent',
          borderBottom: '8px solid transparent',
          borderRight: '8px solid var(--surface-card, #151618)',
        }
      : {
          position: 'absolute',
          right: -8,
          top: Math.min(holeH / 2 + (padTop - calloutTop), 80),
          width: 0, height: 0,
          borderTop: '8px solid transparent',
          borderBottom: '8px solid transparent',
          borderLeft: '8px solid var(--surface-card, #151618)',
        }

  const overlayBg = 'rgba(0,0,0,0.72)'

  return (
    <div
      className="fixed inset-0 z-[200] pointer-events-none"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.18s ease' }}
    >
      {/* ── 4 overlay panels ── */}
      {/* Top */}
      <div
        className="absolute pointer-events-auto"
        style={{ top: 0, left: 0, right: 0, height: padTop, background: overlayBg }}
        onClick={handleSkip}
      />
      {/* Left */}
      <div
        className="absolute pointer-events-auto"
        style={{ top: padTop, left: 0, width: padLeft, height: holeH, background: overlayBg }}
        onClick={handleSkip}
      />
      {/* Right */}
      <div
        className="absolute pointer-events-auto"
        style={{ top: padTop, left: padRight, right: 0, height: holeH, background: overlayBg }}
        onClick={handleSkip}
      />
      {/* Bottom */}
      <div
        className="absolute pointer-events-auto"
        style={{ top: padBottom, left: 0, right: 0, bottom: 0, background: overlayBg }}
        onClick={handleSkip}
      />

      {/* ── Highlight ring ── */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: padTop, left: padLeft,
          width: holeW, height: holeH,
          borderRadius: 7,
          boxShadow: '0 0 0 2px rgb(var(--accent-secondary-rgb)), 0 0 16px rgb(var(--accent-secondary-rgb) / 0.30)',
          transition: 'top 0.18s ease, left 0.18s ease, width 0.18s ease, height 0.18s ease',
        }}
      />

      {/* ── Callout ── */}
      <div
        key={currentStep}
        className="bg-surface-card border border-surface-border rounded-xl shadow-2xl p-5 flex flex-col gap-3.5 pointer-events-auto"
        style={{ ...calloutStyle, animation: visible ? 'tourFadeUp 0.2s ease-out both' : undefined }}
      >
        {/* Arrow */}
        <div style={arrowStyle} />

        <ProgressDots current={currentStep} total={TOUR_STEPS.length} />
        <div>
          <h2 className="text-ink/90 text-sm font-bold mb-1.5 leading-snug">{step.title}</h2>
          <p className="text-ink/55 text-xs leading-relaxed">{step.body}</p>
        </div>
        <NavButtons isFirst={isFirst} isLast={isLast} onPrev={prevStep} onNext={handleNext} onSkip={handleSkip} />
      </div>
    </div>
  )
}
