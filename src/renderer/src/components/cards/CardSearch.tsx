import React, { useState, useCallback, useRef, useEffect } from 'react'
import type { ScryfallCard } from '../../../../shared/types'
import { bridge } from '../../api/bridge'
import { useDeckStore } from '../../store/deckStore'
import { useAppPrefsStore } from '../../store/appPrefsStore'
import { AdvancedSearch } from './AdvancedSearch'
import { getCardImageUri, buildPrintCard } from '../../utils/scryfallUtils'

// ─── Printing picker (shared between simple and advanced results) ─────────────

function PrintingPicker({ cardName, printings, onSelect, onBack, loading }: {
  cardName: string
  printings: ScryfallCard[]
  onSelect: (card: ScryfallCard) => Promise<void>
  onBack: () => void
  loading: boolean
}) {
  const [adding, setAdding] = useState<string | null>(null)

  const handleSelect = async (card: ScryfallCard) => {
    setAdding(card.id)
    await onSelect(card)
    setAdding(null)
  }

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
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {printings.map((card) => {
          const thumb = getCardImageUri(card, 'normal')
          const isAdding = adding === card.id
          return (
            <div
              key={card.id}
              className="flex items-center gap-2.5 bg-surface-elevated rounded-md px-2 py-1.5 cursor-pointer hover:bg-surface-hover border border-transparent hover:border-surface-border group transition-all"
              onClick={() => handleSelect(card)}
            >
              {thumb && <img src={thumb} alt={card.set_name} className="w-8 h-11 object-cover rounded flex-shrink-0 shadow-card" />}
              <div className="flex-1 min-w-0">
                <p className="text-ink/80 text-xs font-medium leading-tight">{card.set_name}</p>
                <p className="text-ink/35 text-xs mt-0.5">#{card.collector_number} · {card.set.toUpperCase()}</p>
              </div>
              <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-xs transition-all ${
                isAdding
                  ? 'bg-accent/20 text-accent/80'
                  : 'text-ink/15 group-hover:bg-accent/15 group-hover:text-accent/80'
              }`}>
                {isAdding ? '✓' : '+'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Simple name search ───────────────────────────────────────────────────────

function SimpleSearch({ onResults, loading, setLoading, error, setError, deduplicate = true }: {
  onResults: (results: ScryfallCard[], query: string) => void
  loading: boolean
  setLoading: (v: boolean) => void
  error: string | null
  setError: (v: string | null) => void
  deduplicate?: boolean
}) {
  const [query, setQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { onResults([], ''); return }
    setLoading(true)
    setError(null)
    const result = await bridge.scryfallSearch(q.trim())
    setLoading(false)
    if (result.ok && result.data) {
      if (deduplicate) {
        const seen = new Set<string>()
        const deduped = result.data.filter((c) => {
          if (seen.has(c.name)) return false
          seen.add(c.name)
          return true
        })
        onResults(deduped, q.trim())
      } else {
        onResults(result.data, q.trim())
      }
    } else {
      setError(result.error ?? 'Search failed')
      onResults([], '')
    }
  }, [deduplicate])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 400)
  }

  return (
    <div>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Search card name..."
          className="w-full bg-surface-elevated border border-surface-border rounded-md px-3 py-2 text-ink placeholder-ink/25 text-sm focus:outline-none focus:border-accent/50 focus:bg-surface-hover transition-colors pr-8"
        />
        {loading
          ? <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-accent/60 animate-pulse" />
          : <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/15 text-xs">⌕</span>
        }
      </div>
      {error && <p className="text-red-400 text-xs mt-1.5 px-0.5">{error}</p>}
    </div>
  )
}

// ─── Main CardSearch component ────────────────────────────────────────────────

export function CardSearch(): React.ReactElement {
  const [advancedOpen, setAdvancedOpen] = useState(false)

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

  const addCard = useDeckStore((s) => s.addCard)
  const searchMode = useAppPrefsStore((s) => s.searchMode)

  // Open printing picker for a given card name
  const handleSelectName = async (card: ScryfallCard) => {
    setSelectedName(card.name)
    setPrintings([])
    setPrintingsLoading(true)
    const result = await bridge.scryfallSearch(`!"${card.name}"`)
    setPrintingsLoading(false)
    if (result.ok && result.data) setPrintings(result.data)
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
    setNameResults([])
    setAdvancedResults([])
    setSelectedName(null)
    setError(null)
    setHasSearched(false)
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
      {/* Simple search input */}
      {!advancedOpen && (
        <div className="p-3 flex-shrink-0">
          <SimpleSearch
            onResults={(results) => { setNameResults(results); setHasSearched(true) }}
            loading={loading}
            setLoading={setLoading}
            error={error}
            setError={setError}
            deduplicate={searchMode === 'select-printing'}
          />
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

      {/* Results — pinned at bottom, scrolls within its own region */}
      {activeResults.length > 0 && (
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

      {hasSearched && activeResults.length === 0 && !loading && (
        <div className="flex-shrink-0 flex flex-col items-center py-6 px-3 gap-1.5">
          <span className="text-ink/10 text-2xl">∅</span>
          <p className="text-ink/25 text-xs text-center">No results found.</p>
        </div>
      )}
    </div>
  )
}
