import React, { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { PrintCard } from '../../../../shared/types'
import { bridge } from '../../api/bridge'
import { useDeckStore } from '../../store/deckStore'

interface PickedFile { path: string; dataUrl: string }

export function LocalImageUpload(): React.ReactElement {
  const [name, setName] = useState('')
  const [front, setFront] = useState<PickedFile | null>(null)
  const [back, setBack] = useState<PickedFile | null>(null)
  const addCard = useDeckStore((s) => s.addCard)

  const pick = async (target: 'front' | 'back') => {
    const result = await bridge.openImageFile()
    if (!result.ok || !result.data) return
    const path = result.data.filePath
    const du = await bridge.readFileAsDataUrl(path)
    if (!du.ok || !du.data) return
    const picked: PickedFile = { path, dataUrl: du.data }
    if (target === 'front') {
      setFront(picked)
      if (!name) setName(path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? 'Custom Card')
    } else {
      setBack(picked)
    }
  }

  const add = () => {
    if (!front) return
    const displayName = name || 'Custom Card'
    const card: PrintCard = {
      id: uuidv4(),
      quantity: 1,
      displayName,
      front: {
        imageSource: { kind: 'local', filePath: front.path, name: displayName },
        cachedPath: front.path,
        dataUrl: front.dataUrl
      },
      back: back
        ? {
            imageSource: { kind: 'local', filePath: back.path, name: displayName + ' (back)' },
            cachedPath: back.path,
            dataUrl: back.dataUrl
          }
        : 'default'
    }
    addCard(card)
    setName('')
    setFront(null)
    setBack(null)
  }

  const filename = (p: PickedFile | null) =>
    p ? p.path.split(/[\\/]/).pop() ?? p.path : null

  return (
    <div className="p-3 space-y-3">
      <p className="text-ink/40 text-xs">Add a card from local image files.</p>

      <div>
        <label className="text-ink/45 text-xs font-medium block mb-1.5">Card Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Black Lotus Alter"
          className="w-full bg-surface-elevated border border-surface-border rounded-md px-3 py-1.5 text-ink text-sm placeholder-ink/20 focus:outline-none focus:border-accent/50 transition-colors"
        />
      </div>

      <div>
        <label className="text-ink/45 text-xs font-medium block mb-1.5">
          Front Image <span className="text-accent/60">*</span>
        </label>
        <button
          onClick={() => pick('front')}
          className={`w-full rounded-md px-3 py-2 text-left text-xs transition-all border ${
            front
              ? 'bg-accent/8 border-accent/40 hover:border-accent/60'
              : 'bg-surface-elevated border-surface-border hover:border-white/20 hover:bg-surface-hover'
          }`}
        >
          {front
            ? <span className="text-accent/80 truncate block">{filename(front)}</span>
            : <span className="text-ink/25">Browse image...</span>}
        </button>
      </div>

      <div>
        <label className="text-ink/45 text-xs font-medium block mb-1.5">Back Image <span className="text-ink/25">(optional)</span></label>
        <button
          onClick={() => pick('back')}
          className={`w-full rounded-md px-3 py-2 text-left text-xs transition-all border ${
            back
              ? 'bg-accent/8 border-accent/40 hover:border-accent/60'
              : 'bg-surface-elevated border-surface-border hover:border-white/20 hover:bg-surface-hover'
          }`}
        >
          {back
            ? <span className="text-accent/80 truncate block">{filename(back)}</span>
            : <span className="text-ink/25">Browse image...</span>}
        </button>
        {back && (
          <button
            onClick={() => setBack(null)}
            className="text-ink/20 hover:text-ink/50 text-xs mt-1 transition-colors"
          >
            ✕ Remove back
          </button>
        )}
      </div>

      <button
        onClick={add}
        disabled={!front}
        className="w-full bg-accent hover:bg-accent/90 text-ink font-semibold rounded-md py-2 text-sm disabled:opacity-30 transition-colors shadow-sm"
      >
        Add to Print List
      </button>
    </div>
  )
}
