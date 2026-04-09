import React, { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { PrintCard, CardFace, ScryfallCard } from '../../../../shared/types'
import { useDeckStore } from '../../store/deckStore'
import { useUiStore } from '../../store/uiStore'
import { bridge } from '../../api/bridge'
import { getCardImageUri, getCardBackUri } from '../../utils/scryfallUtils'

interface Props {
  card: PrintCard
  pageJumps: { label: string; pageIndex: number }[]
}

function PageBadge({ pageJumps }: { pageJumps: { label: string; pageIndex: number }[] }) {
  const setPreviewPage = useUiStore((s) => s.setPreviewPage)
  const [open, setOpen] = useState(false)

  if (pageJumps.length === 0) return null

  if (pageJumps.length === 1) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setPreviewPage(pageJumps[0].pageIndex) }}
        className="text-xs text-ink/45 hover:text-accent/70 border border-surface-border hover:border-accent/30 rounded px-1.5 py-0.5 transition-all"
        title="Jump to page"
      >
        {pageJumps[0].label}
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className="text-xs text-ink/45 hover:text-accent/70 border border-surface-border hover:border-accent/30 rounded px-1.5 py-0.5 transition-all"
        title="Show pages"
      >
        {pageJumps[0].label}+
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 mb-1 bg-surface-elevated border border-surface-border rounded shadow-panel z-20 py-1 min-w-[6rem]">
            {pageJumps.map((jump) => (
              <button
                key={jump.pageIndex}
                onClick={(e) => { e.stopPropagation(); setPreviewPage(jump.pageIndex); setOpen(false) }}
                className="w-full text-left px-2.5 py-1 text-xs text-ink/60 hover:text-ink hover:bg-surface-hover transition-colors"
              >
                {jump.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}


function PrintingPicker({ card, onClose }: { card: PrintCard; onClose: () => void }) {
  const { updateCard } = useDeckStore()
  const [printings, setPrintings] = useState<ScryfallCard[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [favorites, setFavorites] = useState<string[]>([])

  const cardName = card.scryfallData?.name ?? card.displayName

  React.useEffect(() => {
    bridge.scryfallSearch(`!"${cardName}"`, true).then((result) => {
      setLoading(false)
      if (result.ok && result.data) setPrintings(result.data)
    })
    bridge.favoritesGet(cardName).then((r) => { if (r.ok && r.data) setFavorites(r.data) })
  }, [])

  const apply = async (printing: ScryfallCard) => {
    setApplying(printing.id)
    const frontUri = getCardImageUri(printing, 'large')
    if (!frontUri) { setApplying(null); return }
    const frontResult = await bridge.scryfallFetchImage(frontUri, printing.id + '-front', 'large')
    const frontCachedPath = frontResult.ok ? frontResult.data : undefined
    const frontDataUrl = frontCachedPath ? (await bridge.readFileAsDataUrl(frontCachedPath)).data : undefined

    const backUri = getCardBackUri(printing)
    let newBack: PrintCard['back'] = 'default'
    if (backUri) {
      const backResult = await bridge.scryfallFetchImage(backUri, printing.id + '-back', 'large')
      const backCachedPath = backResult.ok ? backResult.data : undefined
      const backDataUrl = backCachedPath ? (await bridge.readFileAsDataUrl(backCachedPath)).data : undefined
      newBack = {
        imageSource: { kind: 'scryfall', scryfallId: printing.id + '-back', imageUri: backUri, name: printing.card_faces?.[1]?.name ?? printing.name + ' (back)' },
        cachedPath: backCachedPath,
        dataUrl: backDataUrl
      }
    } else if (card.back !== 'default' && card.back.imageSource.kind !== 'scryfall') {
      // Preserve a user-assigned custom back when switching printings
      newBack = card.back
    }

    updateCard(card.id, {
      displayName: printing.name,
      scryfallData: printing,
      front: {
        imageSource: { kind: 'scryfall', scryfallId: printing.id, imageUri: frontUri, name: printing.name },
        cachedPath: frontCachedPath,
        dataUrl: frontDataUrl
      },
      back: newBack
    })
    setApplying(null)
    onClose()
  }

  const toggleFavorite = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const r = await bridge.favoritesToggle(cardName, id)
    if (r.ok && r.data) setFavorites(r.data)
  }

  const filtered = printings
    .filter((p) => {
      if (!filter.trim()) return true
      const q = filter.toLowerCase()
      return p.set_name.toLowerCase().includes(q) || p.set.toLowerCase().includes(q) || p.collector_number.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      const aFav = favorites.includes(a.id)
      const bFav = favorites.includes(b.id)
      if (aFav !== bFav) return aFav ? -1 : 1
      return sort === 'oldest'
        ? (a.released_at ?? '').localeCompare(b.released_at ?? '')
        : (b.released_at ?? '').localeCompare(a.released_at ?? '')
    })

  const hasFavSection = filtered.some((p) => favorites.includes(p.id))

  return (
    <div className="mt-2 rounded-md overflow-hidden border border-surface-border bg-surface">
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-surface-elevated border-b border-surface-border">
        <span className="text-ink/50 text-xs font-medium">Change printing</span>
        <button onClick={onClose} className="text-ink/20 hover:text-ink/60 text-sm leading-none transition-colors">×</button>
      </div>
      {loading && <p className="text-ink/25 text-xs p-2.5">Loading printings...</p>}
      {!loading && printings.length > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-surface-border">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by set or #..."
            className="flex-1 bg-surface-elevated border border-surface-border rounded px-2 py-1 text-xs text-ink placeholder-ink/25 focus:outline-none focus:border-accent/50 transition-colors"
          />
          <button
            onClick={() => setSort(sort === 'newest' ? 'oldest' : 'newest')}
            className="text-xs text-ink/40 hover:text-ink/75 border border-surface-border rounded px-2 py-1 bg-surface-elevated hover:border-surface-hover transition-colors flex-shrink-0"
            title="Toggle sort order"
          >
            {sort === 'newest' ? 'Newest' : 'Oldest'}
          </button>
        </div>
      )}
      <div className="max-h-52 overflow-y-auto divide-y divide-surface-border">
        {filtered.map((p, i) => {
          const thumb = getCardImageUri(p, 'normal')
          const isCurrent = card.scryfallData?.id === p.id
          const isApplying = applying === p.id
          const isFav = favorites.includes(p.id)
          const prevIsFav = i > 0 && favorites.includes(filtered[i - 1].id)
          const showDivider = hasFavSection && !isFav && prevIsFav
          return (
            <React.Fragment key={p.id}>
              {showDivider && <div className="border-t border-surface-border" />}
              <div
                onClick={() => !isCurrent && apply(p)}
                className={`flex items-center gap-2.5 px-2.5 py-2 text-xs transition-colors group ${
                  isCurrent
                    ? 'bg-accent/8 cursor-default'
                    : 'cursor-pointer hover:bg-surface-elevated'
                }`}
              >
                {thumb && <img src={thumb} className="w-7 h-9 object-cover rounded flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${isCurrent ? 'text-accent/80' : 'text-ink/70'}`}>
                    {p.set_name}
                  </p>
                  <p className="text-ink/30 text-xs">#{p.collector_number} · {p.set.toUpperCase()}</p>
                </div>
                {isCurrent && <span className="text-accent/60 text-xs flex-shrink-0">✓ current</span>}
                {isApplying && <span className="text-accent/80 text-xs flex-shrink-0 animate-pulse">applying…</span>}
                <button
                  onClick={(e) => toggleFavorite(e, p.id)}
                  className={`w-5 h-5 flex items-center justify-center flex-shrink-0 text-xs rounded transition-all hover:scale-110 ${
                    isFav ? 'text-accent' : 'text-ink/15 group-hover:text-ink/35'
                  }`}
                  title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                >★</button>
              </div>
            </React.Fragment>
          )
        })}
        {!loading && filtered.length === 0 && filter && (
          <p className="text-ink/25 text-xs text-center py-3">No printings match "{filter}"</p>
        )}
      </div>
    </div>
  )
}

export function CardListItem({ card, pageJumps }: Props): React.ReactElement {
  const { removeCard, setCardQuantity, setCardBack } = useDeckStore()
  const { setHoveredCardId } = useUiStore()
  const [showBackPicker, setShowBackPicker] = useState(false)
  const [showPrintingPicker, setShowPrintingPicker] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id })

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }

  const frontSrc    = card.front.dataUrl ?? null
  const isCustomBack  = card.back !== 'default'
  const isDoubleSided = !!(card.scryfallData?.card_faces?.[1]?.image_uris)
  const showBackThumb = isCustomBack || isDoubleSided
  const backSrc       = isCustomBack ? ((card.back as CardFace).dataUrl ?? null) : null

  const pickCustomBack = async () => {
    const result = await bridge.openImageFile()
    if (!result.ok || !result.data) return
    const path = result.data.filePath
    const du = await bridge.readFileAsDataUrl(path)
    setCardBack(card.id, {
      imageSource: { kind: 'local', filePath: path, name: card.displayName + ' (back)' },
      cachedPath: path,
      dataUrl: du.ok ? du.data : undefined
    })
    setShowBackPicker(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group rounded-md border transition-colors ${
        isDragging ? 'border-accent/40 bg-surface-elevated' : 'border-surface-border bg-surface-elevated hover:border-surface-hover'
      }`}
      onMouseEnter={() => setHoveredCardId(card.id)}
      onMouseLeave={() => setHoveredCardId(null)}
    >
      {/* Row 1 — always visible */}
      <div className="flex items-center gap-2 p-2">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="flex-shrink-0 text-ink/25 hover:text-ink/55 cursor-grab active:cursor-grabbing px-0.5 touch-none transition-colors text-base leading-none"
          title="Drag to reorder"
        >⠿</button>

        {/* Front thumbnail */}
        {frontSrc
          ? <img src={frontSrc} alt={card.displayName} className="w-10 h-14 object-cover rounded flex-shrink-0 shadow-card" />
          : <div className="w-10 h-14 bg-surface rounded flex-shrink-0 flex items-center justify-center text-ink/15 text-xs border border-surface-border">?</div>
        }

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-ink/90 text-sm font-medium truncate leading-tight mb-0.5">{card.displayName}</p>
          {card.scryfallData && (
            <p className="text-ink/40 text-xs truncate">{card.scryfallData.set_name} #{card.scryfallData.collector_number}</p>
          )}
          {/* Quantity + page badge */}
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex items-center rounded border border-surface-border overflow-hidden w-fit">
              <button
                onClick={() => setCardQuantity(card.id, card.quantity - 1)}
                disabled={card.quantity <= 1}
                className="w-5 h-5 text-ink/55 hover:text-ink hover:bg-surface-hover disabled:opacity-20 text-xs leading-none transition-colors"
              >−</button>
              <span className="text-ink/80 text-xs w-5 text-center border-x border-surface-border">{card.quantity}</span>
              <button
                onClick={() => setCardQuantity(card.id, card.quantity + 1)}
                className="w-5 h-5 text-ink/55 hover:text-ink hover:bg-surface-hover text-xs leading-none transition-colors"
              >+</button>
            </div>
            <PageBadge pageJumps={pageJumps} />
          </div>
        </div>

        {/* Back thumbnail — only for custom backs or double-sided cards */}
        {showBackThumb && (
          <div className="flex-shrink-0 opacity-40 hover:opacity-70 transition-opacity">
            {backSrc
              ? <img src={backSrc} alt="back" className="w-7 h-9 object-cover rounded shadow-card" />
              : <div className="w-7 h-9 bg-surface rounded flex items-center justify-center text-ink/20 text-xs border border-surface-border">↩</div>
            }
          </div>
        )}

        {/* Remove */}
        <button
          onClick={() => removeCard(card.id)}
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-ink/30 hover:text-red-400 hover:bg-red-400/10 rounded transition-all text-sm leading-none"
          title="Remove"
        >×</button>
      </div>

      {/* Row 2 — hover only, stays visible while a picker is open */}
      <div className={`items-center gap-1.5 pr-2 pb-2 pt-0 pl-[3.25rem] ${
        showBackPicker || showPrintingPicker ? 'flex' : 'hidden group-hover:flex'
      }`}>
        {card.scryfallData && (
          <button
            onClick={() => { setShowPrintingPicker(!showPrintingPicker); setShowBackPicker(false) }}
            className={`text-xs border rounded px-1.5 py-0.5 transition-all ${
              showPrintingPicker
                ? 'border-accent/60 text-accent/80 bg-accent/8'
                : 'border-surface-border text-ink/45 hover:text-ink/75 hover:border-surface-hover'
            }`}
          >printing</button>
        )}
        <button
          onClick={() => { setShowBackPicker(!showBackPicker); setShowPrintingPicker(false) }}
          className={`text-xs border rounded px-1.5 py-0.5 transition-all ${
            showBackPicker
              ? 'border-accent/60 text-accent/80 bg-accent/8'
              : 'border-surface-border text-ink/45 hover:text-ink/75 hover:border-surface-hover'
          }`}
        >back</button>
      </div>

      {/* Back picker */}
      {showBackPicker && (
        <div className="px-2 pb-2 flex gap-1.5">
          <button
            onClick={() => { useDeckStore.getState().setCardBack(card.id, 'default'); setShowBackPicker(false) }}
            className={`text-xs border rounded px-2 py-1 transition-all ${
              card.back === 'default'
                ? 'border-accent/60 text-accent/80 bg-accent/8'
                : 'border-surface-border text-ink/35 hover:text-ink hover:border-surface-hover'
            }`}
          >Use default</button>
          <button
            onClick={pickCustomBack}
            className="text-xs border border-surface-border rounded px-2 py-1 text-ink/35 hover:text-ink hover:border-surface-hover transition-all"
          >Browse image…</button>
        </div>
      )}

      {/* Printing picker */}
      {showPrintingPicker && (
        <div className="px-2 pb-2">
          <PrintingPicker card={card} onClose={() => setShowPrintingPicker(false)} />
        </div>
      )}
    </div>
  )
}
