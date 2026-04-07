import React, { useState, useRef, useCallback } from 'react'

interface TourHintProps {
  text: string
}

const TOOLTIP_W = 224 // px — w-56
const GAP = 8

/**
 * A small "?" button that shows a tip on hover.
 * Uses position:fixed so it escapes any overflow:hidden parent (e.g. sidebars).
 */
export function TourHint({ text }: TourHintProps): React.ReactElement {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      // Prefer right; fall back to left if tooltip would clip the viewport
      const fitsRight = r.right + GAP + TOOLTIP_W < window.innerWidth
      const left = fitsRight ? r.right + GAP : r.left - GAP - TOOLTIP_W
      setPos({ top: r.top - 4, left })
    }
  }, [])

  const hide = useCallback(() => {
    hideTimer.current = setTimeout(() => setPos(null), 120)
  }, [])

  // Keep tooltip open when mouse moves onto it
  const cancelHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
  }, [])

  return (
    <span className="inline-flex flex-shrink-0 align-middle">
      <button
        ref={btnRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        className={`w-3.5 h-3.5 rounded-full border text-[9px] leading-none flex items-center justify-center transition-colors flex-shrink-0 ${
          pos
            ? 'border-accent/50 text-accent/70 bg-accent/10'
            : 'border-ink/20 text-ink/25 hover:text-ink/55 hover:border-ink/35'
        }`}
        tabIndex={-1}
        aria-label="What's this?"
      >
        ?
      </button>
      {pos && (
        <div
          onMouseEnter={cancelHide}
          onMouseLeave={hide}
          className="fixed z-[150] w-56 bg-surface-elevated border border-surface-border rounded-md px-2.5 py-2 text-ink/60 text-xs shadow-lg leading-relaxed pointer-events-auto"
          style={{ top: pos.top, left: pos.left }}
        >
          {text}
        </div>
      )}
    </span>
  )
}
