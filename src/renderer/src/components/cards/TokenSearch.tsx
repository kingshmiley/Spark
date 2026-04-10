import React, { useState, useCallback, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { ScryfallCard } from '../../../../shared/types'
import { bridge } from '../../api/bridge'
import { getCardImageUri, buildPrintCard } from '../../utils/scryfallUtils'
import { useAddCard } from '../../hooks/useAddCard'

// ─── Slot value type ──────────────────────────────────────────────────────────

type TokenSlotValue =
  | { kind: 'scryfall'; card: ScryfallCard }
  | { kind: 'custom'; path: string; dataUrl: string; fileName: string }
  | null

function slotDisplayName(slot: TokenSlotValue): string {
  if (!slot) return ''
  if (slot.kind === 'scryfall') return slot.card.name
  return slot.fileName.replace(/\.[^/.]+$/, '')
}

// ─── Token Printing Picker ─────────────────────────────────────────────────────

function TokenPrintingPicker({ tokenName, printings, loading, onSelect, onBack }: {
  tokenName: string
  printings: ScryfallCard[]
  loading: boolean
  onSelect: (card: ScryfallCard) => void
  onBack: () => void
}) {
  const [setFilter, setSetFilter] = useState('')
  const [powerFilter, setPowerFilter] = useState('')
  const [toughnessFilter, setToughnessFilter] = useState('')

  const filtered = printings.filter((c) => {
    if (setFilter.trim()) {
      const q = setFilter.toLowerCase()
      if (!c.set_name.toLowerCase().includes(q) && !c.set.toLowerCase().includes(q)) return false
    }
    if (powerFilter.trim() && (c.power ?? '').toLowerCase() !== powerFilter.trim().toLowerCase()) return false
    if (toughnessFilter.trim() && (c.toughness ?? '').toLowerCase() !== toughnessFilter.trim().toLowerCase()) return false
    return true
  })

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-border flex-shrink-0 bg-surface-card">
        <button
          onClick={onBack}
          className="w-6 h-6 flex items-center justify-center rounded text-ink/40 hover:text-ink hover:bg-surface-elevated transition-colors text-base leading-none"
        >←</button>
        <span className="text-ink/85 text-sm font-semibold truncate">{tokenName}</span>
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
            value={setFilter}
            onChange={(e) => setSetFilter(e.target.value)}
            placeholder="Filter by set..."
            className="flex-1 bg-surface-elevated border border-surface-border rounded px-2 py-1 text-xs text-ink placeholder-ink/25 focus:outline-none focus:border-accent/50 transition-colors"
          />
          <input
            type="text"
            value={powerFilter}
            onChange={(e) => setPowerFilter(e.target.value)}
            placeholder="Pow"
            className="w-10 bg-surface-elevated border border-surface-border rounded px-2 py-1 text-xs text-ink placeholder-ink/25 focus:outline-none focus:border-accent/50 transition-colors text-center"
          />
          <span className="text-ink/20 text-xs">/</span>
          <input
            type="text"
            value={toughnessFilter}
            onChange={(e) => setToughnessFilter(e.target.value)}
            placeholder="Tgh"
            className="w-10 bg-surface-elevated border border-surface-border rounded px-2 py-1 text-xs text-ink placeholder-ink/25 focus:outline-none focus:border-accent/50 transition-colors text-center"
          />
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {filtered.map((card) => {
          const thumb = getCardImageUri(card, 'normal')
          const pt = card.power != null && card.toughness != null ? `${card.power}/${card.toughness}` : null
          return (
            <div
              key={card.id}
              onClick={() => onSelect(card)}
              className="flex items-center gap-2.5 bg-surface-elevated rounded-md px-2 py-1.5 cursor-pointer hover:bg-surface-hover border border-transparent hover:border-surface-border group transition-all"
            >
              {thumb && <img src={thumb} alt={card.set_name} className="w-8 h-11 object-cover rounded flex-shrink-0 shadow-card" />}
              <div className="flex-1 min-w-0">
                <p className="text-ink/80 text-xs font-medium leading-tight">{card.set_name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-ink/35 text-xs">#{card.collector_number} · {card.set.toUpperCase()}</p>
                  {pt && <span className="text-ink/25 text-xs">· {pt}</span>}
                </div>
              </div>
              <span className="text-ink/15 group-hover:text-accent/80 text-xs transition-colors pr-0.5">+</span>
            </div>
          )
        })}
        {!loading && filtered.length === 0 && (
          <p className="text-ink/25 text-xs text-center py-4">No printings match filters.</p>
        )}
      </div>
    </div>
  )
}

// ─── Token Slot ────────────────────────────────────────────────────────────────

function TokenSlot({ label, optional = false, value, onResultClick, onCustomSelect, onClear }: {
  label: string
  optional?: boolean
  value: TokenSlotValue
  onResultClick: (card: ScryfallCard) => void
  onCustomSelect: (v: { path: string; dataUrl: string; fileName: string }) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ScryfallCard[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    setLoading(true)
    const result = await bridge.scryfallSearch(`t:token name:"${q.trim()}"`)
    setLoading(false)
    if (result.ok && result.data) {
      const seen = new Set<string>()
      setResults(result.data.filter((c) => {
        if (seen.has(c.name)) return false
        seen.add(c.name)
        return true
      }))
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 300)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const path = (file as any).path as string
    const reader = new FileReader()
    reader.onload = () => {
      onCustomSelect({ path, dataUrl: reader.result as string, fileName: file.name })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // ── Confirmed state ──
  if (value) {
    const thumb = value.kind === 'scryfall' ? getCardImageUri(value.card, 'normal') : value.dataUrl
    const name = slotDisplayName(value)
    const sub = value.kind === 'scryfall'
      ? `${value.card.set_name} · #${value.card.collector_number}`
      : 'Custom image'
    return (
      <div className="flex items-center gap-2.5 bg-surface-elevated rounded-md px-2 py-1.5 border border-surface-border">
        {thumb && <img src={thumb} alt={name} className="w-8 h-11 object-cover rounded flex-shrink-0 shadow-card" />}
        <div className="flex-1 min-w-0">
          <p className="text-ink/85 text-xs font-medium truncate">{name}</p>
          <p className="text-ink/35 text-xs truncate">{sub}</p>
        </div>
        <button
          onClick={onClear}
          className="text-ink/25 hover:text-ink/60 text-xs w-5 h-5 flex items-center justify-center transition-colors flex-shrink-0"
          title="Clear"
        >✕</button>
      </div>
    )
  }

  // ── Empty state ──
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder={`Search ${label.toLowerCase()} token...`}
          className="w-full bg-surface-elevated border border-surface-border rounded-md px-3 py-2 text-ink placeholder-ink/25 text-sm focus:outline-none focus:border-accent/50 transition-colors pr-8"
        />
        {loading
          ? <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-accent/60 animate-pulse" />
          : <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/15 text-xs">⌕</span>
        }
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full text-xs text-ink/25 hover:text-ink/55 border border-dashed border-surface-border hover:border-surface-hover rounded-md py-1.5 transition-colors"
      >
        Custom image
      </button>
      {results.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {results.map((card) => {
            const thumb = getCardImageUri(card, 'normal')
            return (
              <div
                key={card.name}
                onClick={() => onResultClick(card)}
                className="flex items-center gap-2 bg-surface-elevated rounded-md px-2 py-1.5 cursor-pointer hover:bg-surface-hover border border-transparent hover:border-surface-border transition-all"
              >
                {thumb
                  ? <img src={thumb} alt={card.name} className="w-7 h-10 object-cover rounded flex-shrink-0" />
                  : <div className="w-7 h-10 bg-surface rounded flex-shrink-0 border border-surface-border" />
                }
                <span className="text-ink/80 text-sm truncate">{card.name}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main TokenSearch component ────────────────────────────────────────────────

export function TokenSearch({ onBack }: { onBack: () => void }) {
  const addCard = useAddCard()

  const [frontSlot, setFrontSlot] = useState<TokenSlotValue>(null)
  const [backSlot, setBackSlot] = useState<TokenSlotValue>(null)
  const [adding, setAdding] = useState(false)

  const [activePicker, setActivePicker] = useState<{
    slot: 'front' | 'back'
    name: string
    printings: ScryfallCard[]
    loading: boolean
  } | null>(null)

  const handleResultClick = async (slot: 'front' | 'back', card: ScryfallCard) => {
    setActivePicker({ slot, name: card.name, printings: [], loading: true })
    const result = await bridge.scryfallSearch(`!"${card.name}" t:token`, true)
    setActivePicker((prev) =>
      prev ? { ...prev, loading: false, printings: result.ok && result.data ? result.data : [] } : null
    )
  }

  const handleSelectPrinting = (card: ScryfallCard) => {
    if (!activePicker) return
    const val: TokenSlotValue = { kind: 'scryfall', card }
    if (activePicker.slot === 'front') setFrontSlot(val)
    else setBackSlot(val)
    setActivePicker(null)
  }

  const handleCustomSelect = (slot: 'front' | 'back', v: { path: string; dataUrl: string; fileName: string }) => {
    const val: TokenSlotValue = { kind: 'custom', ...v }
    if (slot === 'front') setFrontSlot(val)
    else setBackSlot(val)
  }

  const handleAdd = async () => {
    if (!frontSlot) return
    setAdding(true)

    // Build front face
    let pc = frontSlot.kind === 'scryfall'
      ? await buildPrintCard(frontSlot.card)
      : {
          id: uuidv4(),
          quantity: 1,
          displayName: slotDisplayName(frontSlot),
          front: {
            imageSource: { kind: 'local' as const, filePath: frontSlot.path, name: frontSlot.fileName },
            cachedPath: frontSlot.path,
            dataUrl: frontSlot.dataUrl
          },
          back: 'default' as const
        }

    if (!pc) { setAdding(false); return }

    // Build back face
    if (backSlot) {
      if (backSlot.kind === 'scryfall') {
        const backUri = getCardImageUri(backSlot.card, 'large')
        if (backUri) {
          const backResult = await bridge.scryfallFetchImage(backUri, backSlot.card.id + '-front', 'large')
          const backCachedPath = backResult.ok ? backResult.data : undefined
          const backDataUrl = backCachedPath
            ? (await bridge.readFileAsDataUrl(backCachedPath)).data
            : undefined
          pc.back = {
            imageSource: { kind: 'scryfall', scryfallId: backSlot.card.id, imageUri: backUri, name: backSlot.card.name },
            cachedPath: backCachedPath,
            dataUrl: backDataUrl
          }
        }
      } else {
        pc.back = {
          imageSource: { kind: 'local', filePath: backSlot.path, name: backSlot.fileName },
          cachedPath: backSlot.path,
          dataUrl: backSlot.dataUrl
        }
      }
    }

    pc.displayName = backSlot
      ? `${slotDisplayName(frontSlot)} // ${slotDisplayName(backSlot)}`
      : slotDisplayName(frontSlot)

    addCard(pc)
    setAdding(false)
    setFrontSlot(null)
    setBackSlot(null)
  }

  if (activePicker) {
    return (
      <TokenPrintingPicker
        tokenName={activePicker.name}
        printings={activePicker.printings}
        loading={activePicker.loading}
        onSelect={handleSelectPrinting}
        onBack={() => setActivePicker(null)}
      />
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-border flex-shrink-0 bg-surface-card">
        <button
          onClick={onBack}
          className="w-6 h-6 flex items-center justify-center rounded text-ink/40 hover:text-ink hover:bg-surface-elevated transition-colors text-base leading-none"
        >←</button>
        <span className="text-ink/70 text-xs font-medium">Token Builder</span>
      </div>

      <div className="p-3 space-y-4 flex-1 overflow-y-auto">
        <div>
          <p className="text-ink/40 text-xs font-medium mb-1.5 px-0.5">Front</p>
          <TokenSlot
            label="Front"
            value={frontSlot}
            onResultClick={(card) => handleResultClick('front', card)}
            onCustomSelect={(v) => handleCustomSelect('front', v)}
            onClear={() => setFrontSlot(null)}
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-surface-border" />
          <span className="text-ink/20 text-xs">//</span>
          <div className="flex-1 h-px bg-surface-border" />
        </div>

        <div>
          <p className="text-ink/40 text-xs font-medium mb-1.5 px-0.5">
            Back <span className="text-ink/20 font-normal">(optional)</span>
          </p>
          <TokenSlot
            label="Back"
            optional
            value={backSlot}
            onResultClick={(card) => handleResultClick('back', card)}
            onCustomSelect={(v) => handleCustomSelect('back', v)}
            onClear={() => setBackSlot(null)}
          />
        </div>
      </div>

      <div className="p-3 border-t border-surface-border flex-shrink-0">
        <button
          onClick={handleAdd}
          disabled={!frontSlot || adding}
          className="w-full bg-accent/90 hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-md transition-colors"
        >
          {adding ? 'Adding...' : 'Add to print list'}
        </button>
      </div>
    </div>
  )
}
