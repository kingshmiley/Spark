import React, { useState, useCallback, useRef, useEffect } from 'react'
import type { ScryfallCard } from '../../../../shared/types'
import { bridge } from '../../api/bridge'
import { useDeckStore } from '../../store/deckStore'
import { useAppPrefsStore } from '../../store/appPrefsStore'
import { AdvancedSearch } from './AdvancedSearch'
import { getCardImageUri, buildPrintCard } from '../../utils/scryfallUtils'
import { useAddCard } from '../../hooks/useAddCard'

// ─── Printing picker (shared between simple and advanced results) ─────────────

function PrintingPicker({ cardName, printings, onSelect, onBack, loading }: {
  cardName: string
  printings: ScryfallCard[]
  onSelect: (card: ScryfallCard) => Promise<void>
  onBack: () => void
  loading: boolean
}) {
  const [adding, setAdding] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [favorites, setFavorites] = useState<string[]>([])

  useEffect(() => {
    bridge.favoritesGet(cardName).then((r) => { if (r.ok && r.data) setFavorites(r.data) })
  }, [cardName])

  const handleSelect = async (card: ScryfallCard) => {
    setAdding(card.id)
    await onSelect(card)
    setAdding(null)
  }

  const toggleFavorite = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const r = await bridge.favoritesToggle(cardName, id)
    if (r.ok && r.data) setFavorites(r.data)
  }

  const filtered = printings
    .filter((c) => {
      if (!filter.trim()) return true
      const q = filter.toLowerCase()
      return c.set_name.toLowerCase().includes(q) || c.set.toLowerCase().includes(q) || c.collector_number.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      const aFav = favorites.includes(a.id)
      const bFav = favorites.includes(b.id)
      if (aFav !== bFav) return aFav ? -1 : 1
      return sort === 'oldest'
        ? (a.released_at ?? '').localeCompare(b.released_at ?? '')
        : (b.released_at ?? '').localeCompare(a.released_at ?? '')
    })

  const hasFavSection = filtered.some((c) => favorites.includes(c.id))

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-border flex-shrink-0 bg-surface-card">
        <button onClick={onBack} className="w-6 h-6 flex items-center justify-center rounded text-ink/40 hover:text-ink hover:bg-surface-elevated transition-colors text-base leading-none">←</button>
        <span className="text-ink/85 text-sm font-semibold truncate">{cardName}</span>
        {printings.length > 0 && (
          <span className="ml-auto text-ink/20 text-xs flex-shrink-0">{printings.length} printings</span>
        )}
      </div>
      {loading && (
        <div className="flex items-center gap-2 px-3 py-3 text-ink/25 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-accent/50 animate-pulse" />
          Loading printings...
        </div>
      )}
      {!loading && printings.length > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-surface-border flex-shrink-0">
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
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {filtered.map((card, i) => {
          const thumb = getCardImageUri(card, 'normal')
          const isAdding = adding === card.id
          const isFav = favorites.includes(card.id)
          const prevIsFav = i > 0 && favorites.includes(filtered[i - 1].id)
          const showDivider = hasFavSection && !isFav && prevIsFav
          return (
            <React.Fragment key={card.id}>
              {showDivider && <div className="border-t border-surface-border mx-1 my-1" />}
              <div
                className="flex items-center gap-2.5 bg-surface-elevated rounded-md px-2 py-1.5 cursor-pointer hover:bg-surface-hover border border-transparent hover:border-surface-border group transition-all"
                onClick={() => handleSelect(card)}
              >
                {thumb && <img src={thumb} alt={card.set_name} className="w-8 h-11 object-cover rounded flex-shrink-0 shadow-card" />}
                <div className="flex-1 min-w-0">
                  <p className="text-ink/80 text-xs font-medium leading-tight">{card.set_name}</p>
                  <p className="text-ink/35 text-xs mt-0.5">#{card.collector_number} · {card.set.toUpperCase()}</p>
                </div>
                <button
                  onClick={(e) => toggleFavorite(e, card.id)}
                  className={`w-5 h-5 flex items-center justify-center flex-shrink-0 text-xs transition-all rounded hover:scale-110 ${
                    isFav ? 'text-accent' : 'text-ink/15 group-hover:text-ink/35'
                  }`}
                  title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                >★</button>
                <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-xs transition-all ${
                  isAdding
                    ? 'bg-accent/20 text-accent/80'
                    : 'text-ink/15 group-hover:bg-accent/15 group-hover:text-accent/80'
                }`}>
                  {isAdding ? '✓' : '+'}
                </div>
              </div>
            </React.Fragment>
          )
        })}
        {!loading && filtered.length === 0 && filter && (
          <p className="text-ink/25 text-xs text-center py-4">No printings match "{filter}"</p>
        )}
      </div>
    </div>
  )
}

// ─── Simple name search ───────────────────────────────────────────────────────

function SimpleSearch({ onResults, onDirectSelect, loading, setLoading, error, setError, deduplicate = true }: {
  onResults: (results: ScryfallCard[], query: string) => void
  onDirectSelect?: (name: string) => void
  loading: boolean
  setLoading: (v: boolean) => void
  error: string | null
  setError: (v: string | null) => void
  deduplicate?: boolean
}) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSuggestions([]); return }
    const result = await bridge.scryfallAutocomplete(q.trim())
    if (result.ok && result.data) setSuggestions(result.data)
  }, [])

  const searchByName = useCallback(async (name: string) => {
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    setSuggestions([])
    setShowSuggestions(false)
    // Cancel any previous in-flight request
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const result = await bridge.scryfallSearch(`name:"${name.trim()}"`, deduplicate ? false : true)
    setLoading(false)
    if (result.ok && result.data) {
      onResults(result.data, name.trim())
    } else {
      setError(result.error ?? 'Search failed')
      onResults([], '')
    }
  }, [deduplicate])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    setShowSuggestions(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.trim().length < 2) { setSuggestions([]); return }
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 200)
  }

  const handleSuggestionClick = (name: string) => {
    setQuery(name)
    setSuggestions([])
    setShowSuggestions(false)
    if (onDirectSelect) {
      onDirectSelect(name)
    } else {
      searchByName(name)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim().length >= 2) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      searchByName(query.trim())
    }
    if (e.key === 'Escape') { setSuggestions([]); setShowSuggestions(false) }
  }

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder="Search card name..."
          className="w-full bg-surface-elevated border border-surface-border rounded-md px-3 py-2 text-ink placeholder-ink/25 text-sm focus:outline-none focus:border-accent/50 focus:bg-surface-hover transition-colors pr-8"
        />
        {loading
          ? <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-accent/60 animate-pulse" />
          : <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/15 text-xs">⌕</span>
        }
      </div>
      {/* Autocomplete dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-surface-elevated border border-surface-border rounded-md shadow-panel z-30 overflow-hidden max-h-52 overflow-y-auto">
          {suggestions.map((name) => (
            <button
              key={name}
              onMouseDown={() => handleSuggestionClick(name)}
              className="w-full text-left px-3 py-1.5 text-sm text-ink/75 hover:text-ink hover:bg-surface-hover transition-colors truncate"
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-red-400 text-xs mt-1.5 px-0.5">{error}</p>}
    </div>
  )
}

// ─── Favorites view ──────────────────────────────────────────────────────────

function FavoritesView({ onAddCard }: { onAddCard: (card: ScryfallCard) => Promise<void> }) {
  const [cards, setCards] = useState<ScryfallCard[]>([])
  const [favorites, setFavorites] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const favResult = await bridge.favoritesGetAll()
    if (!favResult.ok || !favResult.data) { setLoading(false); return }
    const store = favResult.data
    setFavorites(store)
    const allIds = Object.values(store).flat()
    if (allIds.length === 0) { setCards([]); setLoading(false); return }
    const colResult = await bridge.scryfallCollection(allIds)
    if (colResult.ok && colResult.data) setCards(colResult.data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleUnfavorite = async (cardName: string, id: string) => {
    const r = await bridge.favoritesToggle(cardName, id)
    if (r.ok) {
      setFavorites((prev) => {
        const next = { ...prev }
        next[cardName] = (next[cardName] ?? []).filter((i) => i !== id)
        if (next[cardName].length === 0) delete next[cardName]
        return next
      })
      setCards((prev) => prev.filter((c) => c.id !== id))
    }
  }

  const handleAdd = async (card: ScryfallCard) => {
    setAdding(card.id)
    await onAddCard(card)
    setAdding(null)
  }

  // Group cards by name, preserving favorite order within each group
  const grouped = Object.entries(favorites).map(([name, ids]) => ({
    name,
    cards: ids.map((id) => cards.find((c) => c.id === id)).filter(Boolean) as ScryfallCard[]
  })).filter((g) => g.cards.length > 0)

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const toggle = (name: string) => setExpanded((prev) => ({ ...prev, [name]: !prev[name] }))

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-4 text-ink/25 text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-accent/50 animate-pulse" />
        Loading favorites...
      </div>
    )
  }

  if (grouped.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 px-3 gap-2">
        <span className="text-ink/10 text-2xl">★</span>
        <p className="text-ink/25 text-xs text-center">No favorites yet.<br />Star a printing in the printing picker to save it here.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
      {grouped.map(({ name, cards: favCards }) => {
        const isExpanded = expanded[name] ?? false
        return (
        <div key={name}>
          <button
            onClick={() => toggle(name)}
            className="w-full flex items-center gap-1.5 px-1 py-1 text-ink/45 hover:text-ink/70 transition-colors group"
          >
            <svg
              width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5"
              style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}
            >
              <polyline points="2,1 6,4 2,7" />
            </svg>
            <span className="text-xs font-medium truncate flex-1 text-left">{name}</span>
            <span className="text-ink/20 text-xs flex-shrink-0">{favCards.length}</span>
          </button>
          {isExpanded && (
          <div className="space-y-1 mb-1">
            {favCards.map((card) => {
              const thumb = getCardImageUri(card, 'normal')
              const isAdding = adding === card.id
              return (
                <div
                  key={card.id}
                  className="flex items-center gap-2.5 bg-surface-elevated rounded-md px-2 py-1.5 border border-transparent hover:border-surface-border hover:bg-surface-hover group transition-all"
                >
                  {thumb && <img src={thumb} alt={card.set_name} className="w-8 h-11 object-cover rounded flex-shrink-0 shadow-card" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-ink/75 text-xs font-medium leading-tight truncate">{card.set_name}</p>
                    <p className="text-ink/35 text-xs mt-0.5">#{card.collector_number} · {card.set.toUpperCase()}</p>
                  </div>
                  <button
                    onClick={() => handleUnfavorite(name, card.id)}
                    className="text-accent/60 hover:text-ink/40 text-xs w-5 h-5 flex items-center justify-center flex-shrink-0 transition-colors"
                    title="Remove from favorites"
                  >★</button>
                  <button
                    onClick={() => handleAdd(card)}
                    className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-xs transition-all ${
                      isAdding ? 'bg-accent/20 text-accent/80' : 'text-ink/20 group-hover:bg-accent/15 group-hover:text-accent/80'
                    }`}
                    title="Add to print list"
                  >{isAdding ? '✓' : '+'}</button>
                </div>
              )
            })}
          </div>
          )}
        </div>
        )
      })}
    </div>
  )
}

// ─── Main CardSearch component ────────────────────────────────────────────────

export function CardSearch(): React.ReactElement {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [favoritesOpen, setFavoritesOpen] = useState(false)

  // Shared results state
  const [nameResults, setNameResults] = useState<ScryfallCard[]>([])
  const [advancedResults, setAdvancedResults] = useState<ScryfallCard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  // Printing picker state
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [printings, setPrintings] = useState<ScryfallCard[]>([])
  const [printingsLoading, setPrintingsLoading] = useState(false)

  const addCard = useAddCard()
  const searchMode = useAppPrefsStore((s) => s.searchMode)

  // Open printing picker for a given card name string
  const openPrintingPicker = async (name: string) => {
    setSelectedName(name)
    setPrintings([])
    setPrintingsLoading(true)
    const result = await bridge.scryfallSearch(`!"${name}"`, true)
    setPrintingsLoading(false)
    if (result.ok && result.data) setPrintings(result.data)
  }

  // Open printing picker for a given card name
  const handleSelectName = async (card: ScryfallCard) => {
    openPrintingPicker(card.name)
  }

  // Add a specific printing to deck
  const handleSelectPrinting = async (card: ScryfallCard) => {
    const pc = await buildPrintCard(card)
    if (pc) addCard(pc)
  }

  // Advanced search
  const handleAdvancedSearch = async (query: string) => {
    setLoading(true)
    setError(null)
    setHasSearched(true)
    setAdvancedResults([])
    const result = await bridge.scryfallSearch(query)
    setLoading(false)
    if (result.ok && result.data) {
      if (searchMode === 'select-printing') {
        const seen = new Set<string>()
        const deduped = result.data.filter((c) => {
          if (seen.has(c.name)) return false
          seen.add(c.name)
          return true
        })
        setAdvancedResults(deduped)
      } else {
        setAdvancedResults(result.data)
      }
    } else {
      setError(result.error ?? 'Search failed')
    }
  }

  const toggleAdvanced = () => {
    setAdvancedOpen((v) => !v)
    setFavoritesOpen(false)
    setNameResults([])
    setAdvancedResults([])
    setSelectedName(null)
    setError(null)
    setHasSearched(false)
  }

  const toggleFavorites = () => {
    setFavoritesOpen((v) => !v)
    setAdvancedOpen(false)
    setSelectedName(null)
  }

  // Route card click based on search mode
  const handleCardClick = async (card: ScryfallCard) => {
    if (searchMode === 'direct-add') {
      const pc = await buildPrintCard(card)
      if (pc) addCard(pc)
    } else {
      await handleSelectName(card)
    }
  }

  // ── Printing picker active
  if (selectedName !== null && searchMode === 'select-printing') {
    return (
      <PrintingPicker
        cardName={selectedName}
        printings={printings}
        loading={printingsLoading}
        onSelect={handleSelectPrinting}
        onBack={() => setSelectedName(null)}
      />
    )
  }

  const activeResults = advancedOpen ? advancedResults : nameResults

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Simple search input + favorites toggle */}
      {!advancedOpen && !favoritesOpen && (
        <div className="p-3 pb-0 flex-shrink-0">
          <div className="flex gap-1.5">
            <div className="flex-1">
              <SimpleSearch
                onResults={(results) => { setNameResults(results); setHasSearched(true) }}
                onDirectSelect={searchMode === 'select-printing' ? openPrintingPicker : undefined}
                loading={loading}
                setLoading={setLoading}
                error={error}
                setError={setError}
                deduplicate={searchMode === 'select-printing'}
              />
            </div>
            <button
              onClick={toggleFavorites}
              title="View favorite printings"
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-md border border-surface-border bg-surface-elevated text-ink/30 hover:text-accent/70 hover:border-accent/30 transition-colors text-sm"
            >★</button>
          </div>
        </div>
      )}

      {/* Favorites view */}
      {favoritesOpen && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-border flex-shrink-0">
            <button onClick={toggleFavorites} className="w-6 h-6 flex items-center justify-center rounded text-ink/40 hover:text-ink hover:bg-surface-elevated transition-colors text-base leading-none">←</button>
            <span className="text-ink/70 text-xs font-medium">Favorite printings</span>
          </div>
          <FavoritesView onAddCard={async (card) => { const pc = await buildPrintCard(card); if (pc) addCard(pc) }} />
        </div>
      )}

      {/* Advanced form — scrolls independently in the middle */}
      {advancedOpen && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <AdvancedSearch onSearch={handleAdvancedSearch} loading={loading} />
          {error && <p className="text-red-400 text-xs px-3 pb-3">{error}</p>}
        </div>
      )}

      {/* Advanced toggle link */}
      {!favoritesOpen && (
      <div className="flex justify-end px-3 py-1.5 flex-shrink-0">
        <button
          onClick={toggleAdvanced}
          className="flex items-center gap-1 text-ink/25 hover:text-ink/55 text-xs transition-colors"
        >
          <span>{advancedOpen ? 'Simple search' : 'Advanced search'}</span>
          <svg
            width="10" height="10" viewBox="0 0 10 10"
            fill="none" stroke="currentColor" strokeWidth="1.5"
            style={{ transform: advancedOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
          >
            <polyline points="2,3 5,7 8,3" />
          </svg>
        </button>
      </div>
      )}

      {/* Results — pinned at bottom, scrolls within its own region */}
      {!favoritesOpen && activeResults.length > 0 && (
        <div className="flex-shrink-0 overflow-y-auto border-t border-surface-border px-2 pb-2 pt-1 space-y-1" style={{ maxHeight: 260 }}>
          {activeResults.map((card) => {
            const thumb = getCardImageUri(card, 'normal')
            return (
              <div
                key={searchMode === 'direct-add' ? card.id : card.name}
                className="flex items-center gap-2.5 bg-surface-elevated rounded-md px-2 py-1.5 cursor-pointer hover:bg-surface-hover border border-transparent hover:border-surface-border group transition-all"
                onClick={() => handleCardClick(card)}
              >
                {thumb
                  ? <img src={thumb} alt={card.name} className="w-9 h-12 object-cover rounded flex-shrink-0 shadow-card" loading="lazy" />
                  : <div className="w-9 h-12 bg-surface rounded flex-shrink-0 flex items-center justify-center text-ink/10 text-xs border border-surface-border">?</div>
                }
                <div className="flex-1 min-w-0">
                  <p className="text-ink/90 text-sm font-medium truncate leading-tight">{card.name}</p>
                  {(advancedOpen || searchMode === 'direct-add') && (
                    <p className="text-ink/30 text-xs truncate mt-0.5">{card.set_name} · #{card.collector_number}</p>
                  )}
                </div>
                <span className="text-ink/15 group-hover:text-accent/80 text-xs transition-colors flex-shrink-0 pr-0.5">
                  {searchMode === 'direct-add' ? '+' : '→'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {!favoritesOpen && hasSearched && activeResults.length === 0 && !loading && (
        <div className="flex-shrink-0 flex flex-col items-center py-6 px-3 gap-1.5">
          <span className="text-ink/10 text-2xl">∅</span>
          <p className="text-ink/25 text-xs text-center">No results found.</p>
        </div>
      )}
    </div>
  )
}
