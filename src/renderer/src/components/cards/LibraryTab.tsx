import React, { useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { PrintCard, LibraryCard } from '../../../../shared/types'
import { bridge } from '../../api/bridge'
import { useLibraryStore } from '../../store/libraryStore'
import { useAddCard } from '../../hooks/useAddCard'

export function LibraryTab(): React.ReactElement {
  const { cards: library, loaded, loadLibrary, saveCard, deleteCard } = useLibraryStore()
  const addCard = useAddCard()
  const [adding, setAdding] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    if (!loaded) loadLibrary()
  }, [loaded])

  const handleAddToList = async (libCard: LibraryCard) => {
    setAdding(libCard.id)
    const frontDu = await bridge.readFileAsDataUrl(libCard.frontPath)
    if (!frontDu.ok) {
      setAdding(null)
      return
    }

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

  const handleSaveNew = async () => {
    const result = await bridge.openImageFile()
    if (!result.ok || !result.data) return
    const frontPath = result.data.filePath
    const name = frontPath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? 'Custom Card'
    const newCard: LibraryCard = {
      id: uuidv4(),
      name,
      frontPath,
      addedAt: new Date().toISOString()
    }
    await saveCard(newCard)
  }

  const isFileMissing = async (path: string): Promise<boolean> => {
    const result = await bridge.readFileAsDataUrl(path)
    return !result.ok
  }

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
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-surface-border flex-shrink-0">
        <span className="text-ink/40 text-xs">
          {library.length === 0 ? 'No saved cards' : `${library.length} saved card${library.length !== 1 ? 's' : ''}`}
        </span>
        <button
          onClick={handleSaveNew}
          className="text-xs text-accent/70 hover:text-accent/70 border border-accent/30 rounded px-2 py-0.5 hover:bg-accent/10 hover:border-accent/50 transition-all"
        >
          + Save image to library
        </button>
      </div>

      {library.length === 0 && (
        <div className="flex flex-col items-center py-8 px-3 gap-2">
          <span className="text-ink/10 text-3xl select-none">⊟</span>
          <p className="text-ink/20 text-xs text-center leading-relaxed">
            Save custom card images here for quick reuse across projects.
          </p>
        </div>
      )}

      {/* Card grid */}
      {library.length > 0 && (
        <div className="space-y-1 px-2 py-2">
          {library.map((libCard) => (
            <div
              key={libCard.id}
              className="flex items-center gap-2.5 bg-surface-elevated rounded-md px-2 py-2 border border-transparent hover:border-surface-border group transition-all"
            >
              {/* Thumbnail placeholder */}
              <div className="w-8 h-11 bg-surface rounded flex-shrink-0 flex items-center justify-center border border-surface-border text-ink/10 text-xs overflow-hidden">
                <ImageThumb path={libCard.frontPath} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-ink/80 text-xs font-medium truncate leading-tight">{libCard.name}</p>
                {libCard.backPath && (
                  <p className="text-ink/25 text-xs mt-0.5">Has custom back</p>
                )}
              </div>

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
                    >
                      ✕
                    </button>
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
                    >
                      ×
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Loads thumbnail lazily; shows a missing-file icon if the path is gone
function ImageThumb({ path }: { path: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    bridge.readFileAsDataUrl(path).then((r) => {
      if (r.ok && r.data) setSrc(r.data)
      else setMissing(true)
    })
  }, [path])

  if (missing) return <span title="File not found" className="text-red-400/60 text-base leading-none select-none">!</span>
  if (!src) return null
  return <img src={src} className="w-full h-full object-cover" alt="" />
}
