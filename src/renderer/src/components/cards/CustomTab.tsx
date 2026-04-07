import React, { useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { PrintCard, LibraryCard } from '../../../../shared/types'
import { bridge } from '../../api/bridge'
import { useDeckStore } from '../../store/deckStore'
import { useLibraryStore } from '../../store/libraryStore'

// ─── Local image upload section ───────────────────────────────────────────────

interface PickedFile { path: string; dataUrl: string }

function UploadSection() {
  const [name, setName] = useState('')
  const [front, setFront] = useState<PickedFile | null>(null)
  const [back, setBack] = useState<PickedFile | null>(null)
  const [saveToLibrary, setSaveToLibrary] = useState(false)
  const addCard = useDeckStore((s) => s.addCard)
  const { saveCard } = useLibraryStore()

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

  const add = async () => {
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

    if (saveToLibrary) {
      const libCard: LibraryCard = {
        id: uuidv4(),
        name: displayName,
        frontPath: front.path,
        backPath: back?.path,
        addedAt: new Date().toISOString()
      }
      await saveCard(libCard)
    }

    setName('')
    setFront(null)
    setBack(null)
  }

  const filename = (p: PickedFile | null) =>
    p ? p.path.split(/[\\/]/).pop() ?? p.path : null

  return (
    <div className="p-3 space-y-3 border-b border-surface-border">
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
        <label className="text-ink/45 text-xs font-medium block mb-1.5">
          Back Image <span className="text-ink/25">(optional)</span>
        </label>
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

      {/* Save to library checkbox */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={saveToLibrary}
          onChange={(e) => setSaveToLibrary(e.target.checked)}
          className="accent-[var(--accent-primary)] flex-shrink-0"
        />
        <span className="text-ink/45 text-xs">Save to library</span>
      </label>

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

// ─── Library section ──────────────────────────────────────────────────────────

function LibrarySection() {
  const { cards: library, loaded, loadLibrary, saveCard, deleteCard } = useLibraryStore()
  const addCard = useDeckStore((s) => s.addCard)
  const [adding, setAdding] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!loaded) loadLibrary()
  }, [loaded])

  const handleAddToList = async (libCard: LibraryCard) => {
    setAdding(libCard.id)
    const frontDu = await bridge.readFileAsDataUrl(libCard.frontPath)
    if (!frontDu.ok) { setAdding(null); return }

    let backFace: PrintCard['back'] = 'default'
    if (libCard.backPath) {
      const backDu = await bridge.readFileAsDataUrl(libCard.backPath)
      if (backDu.ok && backDu.data) {
        backFace = {
          imageSource: { kind: 'local', filePath: libCard.backPath, name: libCard.name + ' (back)' },
          cachedPath: libCard.backPath,
          dataUrl: backDu.data
        }
      }
    }

    addCard({
      id: uuidv4(),
      quantity: 1,
      displayName: libCard.name,
      front: {
        imageSource: { kind: 'local', filePath: libCard.frontPath, name: libCard.name },
        cachedPath: libCard.frontPath,
        dataUrl: frontDu.data
      },
      back: backFace
    })
    setAdding(null)
  }

  const startRename = (libCard: LibraryCard) => {
    setEditingId(libCard.id)
    setEditName(libCard.name)
  }

  const commitRename = async (libCard: LibraryCard) => {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== libCard.name) {
      await saveCard({ ...libCard, name: trimmed })
    }
    setEditingId(null)
  }

  const filtered = search.trim()
    ? library.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : library

  if (!loaded) {
    return (
      <div className="flex items-center gap-2 p-4 text-ink/25 text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-accent/50 animate-pulse" />
        Loading library...
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Library header + search */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-ink/35 text-xs font-medium">
            Saved cards {library.length > 0 && <span className="text-ink/20">({library.length})</span>}
          </span>
        </div>
        {library.length > 0 && (
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter library..."
              className="w-full bg-surface-elevated border border-surface-border rounded-md px-3 py-1.5 text-ink text-xs placeholder-ink/20 focus:outline-none focus:border-accent/50 transition-colors pr-7"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink/25 hover:text-ink/60 text-xs"
              >✕</button>
            )}
          </div>
        )}
      </div>

      {library.length === 0 && (
        <div className="flex flex-col items-center py-8 px-3 gap-2">
          <span className="text-ink/10 text-3xl select-none">⊟</span>
          <p className="text-ink/20 text-xs text-center leading-relaxed">
            Check "Save to library" when adding a card to save it here for reuse.
          </p>
        </div>
      )}

      {filtered.length === 0 && library.length > 0 && (
        <p className="text-ink/20 text-xs text-center py-4">No matches.</p>
      )}

      <div className="space-y-1 px-2 pb-2">
        {filtered.map((libCard) => (
          <div
            key={libCard.id}
            className="flex items-center gap-2 bg-surface-elevated rounded-md px-2 py-2 border border-transparent hover:border-surface-border group transition-all"
          >
            {/* Thumbnail */}
            <div className="w-8 h-11 bg-surface rounded flex-shrink-0 flex items-center justify-center border border-surface-border overflow-hidden">
              <ImageThumb path={libCard.frontPath} />
            </div>

            {/* Name — editable on click */}
            <div className="flex-1 min-w-0">
              {editingId === libCard.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => commitRename(libCard)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(libCard)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="w-full bg-surface border border-accent/50 rounded px-1.5 py-0.5 text-ink text-xs focus:outline-none"
                />
              ) : (
                <p
                  className="text-ink/80 text-xs font-medium truncate leading-tight cursor-pointer hover:text-ink transition-colors"
                  title="Click to rename"
                  onClick={() => startRename(libCard)}
                >
                  {libCard.name}
                </p>
              )}
              {libCard.backPath && (
                <p className="text-ink/25 text-xs mt-0.5">Has custom back</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {confirmDelete === libCard.id ? (
                <>
                  <button
                    onClick={() => { deleteCard(libCard.id); setConfirmDelete(null) }}
                    className="text-xs text-red-400 hover:text-red-300 border border-red-700/40 rounded px-1.5 py-0.5 transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="text-xs text-ink/30 hover:text-ink/60 transition-colors"
                  >✕</button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleAddToList(libCard)}
                    disabled={adding === libCard.id}
                    className="text-xs text-accent/80 hover:text-accent/70 border border-accent/30 rounded px-2 py-0.5 hover:bg-accent/10 hover:border-accent/50 transition-all disabled:opacity-40"
                  >
                    {adding === libCard.id ? '...' : 'Add'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(libCard.id)}
                    className="w-5 h-5 flex items-center justify-center text-ink/15 hover:text-red-400 hover:bg-red-400/10 rounded transition-all opacity-0 group-hover:opacity-100"
                    title="Remove from library"
                  >×</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ImageThumb({ path }: { path: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    bridge.readFileAsDataUrl(path).then((r) => {
      if (cancelled) return
      if (r.ok && r.data) setSrc(r.data)
      else setMissing(true)
    })
    return () => { cancelled = true }
  }, [path])

  if (missing) return <span title="File not found" className="text-red-400/60 text-base leading-none select-none">!</span>
  if (!src) return null
  return <img src={src} className="w-full h-full object-cover" alt="" />
}

// ─── Combined Custom tab ──────────────────────────────────────────────────────

export function CustomTab(): React.ReactElement {
  return (
    <div className="flex flex-col">
      <UploadSection />
      <LibrarySection />
    </div>
  )
}
