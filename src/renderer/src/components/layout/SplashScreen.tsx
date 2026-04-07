import React, { useState, useEffect, useRef } from 'react'
import { SparkLogo } from './SparkLogo'

export function SplashScreen({ onDone }: { onDone: () => void }): React.ReactElement {
  const [fadingOut, setFadingOut] = useState(false)
  const onDoneRef = useRef(onDone)

  useEffect(() => {
    // Empty deps — timers run exactly once on mount, never reset by re-renders
    const fadeTimer = setTimeout(() => setFadingOut(true), 2900)
    const doneTimer = setTimeout(() => onDoneRef.current(), 3800)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(doneTimer)
    }
  }, [])

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-surface ${fadingOut ? 'splash-fadeout' : ''}`}
    >
      <SparkLogo className="w-48 h-48 text-accent splash-flicker" />
    </div>
  )
}
