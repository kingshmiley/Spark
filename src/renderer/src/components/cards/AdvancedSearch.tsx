import React, { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdvancedQuery {
  name: string
  text: string         // oracle text
  typeLine: string
  colors: string[]     // W U B R G C
  colorMode: 'exact' | 'including' | 'atmost'
  colorIdentity: string[]
  ciMode: 'exact' | 'including' | 'atmost'
  cmc: string          // e.g. "3" or ">=4"
  cmcOp: '=' | '<' | '>' | '<=' | '>='
  power: string
  powerOp: '=' | '<' | '>' | '<=' | '>='
  toughness: string
  toughnessOp: '=' | '<' | '>' | '<=' | '>='
  set: string
  rarity: string       // common uncommon rare mythic
  format: string
  artist: string
  is: string[]         // legendary spell permanent creature etc
  not: string[]
  tags: string         // scryfall tagger tags, comma-separated
  sortBy: string
  sortDir: 'auto' | 'asc' | 'desc'
}

const EMPTY_QUERY: AdvancedQuery = {
  name: '', text: '', typeLine: '',
  colors: [], colorMode: 'including',
  colorIdentity: [], ciMode: 'including',
  cmc: '', cmcOp: '=',
  power: '', powerOp: '=',
  toughness: '', toughnessOp: '=',
  set: '', rarity: '', format: '', artist: '',
  is: [], not: [],
  tags: '',
  sortBy: 'name', sortDir: 'auto'
}

const COLOR_OPTIONS = [
  { value: 'W', label: 'W', title: 'White',     bg: 'bg-yellow-100 text-yellow-900' },
  { value: 'U', label: 'U', title: 'Blue',      bg: 'bg-blue-400 text-white' },
  { value: 'B', label: 'B', title: 'Black',     bg: 'bg-gray-800 text-white' },
  { value: 'R', label: 'R', title: 'Red',       bg: 'bg-red-500 text-white' },
  { value: 'G', label: 'G', title: 'Green',     bg: 'bg-green-600 text-white' },
  { value: 'C', label: 'C', title: 'Colorless', bg: 'bg-gray-400 text-white' },
]

const RARITY_OPTIONS = ['', 'common', 'uncommon', 'rare', 'mythic']
const FORMAT_OPTIONS = [
  '', 'standard', 'pioneer', 'modern', 'legacy', 'vintage',
  'commander', 'oathbreaker', 'pauper', 'historic', 'explorer', 'alchemy'
]
const IS_OPTIONS = [
  'legendary', 'permanent', 'spell', 'historic', 'modal',
  'commander', 'foil', 'nonfoil', 'reprint', 'firstprint', 'promo', 'digital'
]
const SORT_OPTIONS = [
  { value: 'name',     label: 'Name' },
  { value: 'released', label: 'Release date' },
  { value: 'set',      label: 'Set' },
  { value: 'rarity',   label: 'Rarity' },
  { value: 'color',    label: 'Color' },
  { value: 'cmc',      label: 'Mana value' },
  { value: 'power',    label: 'Power' },
  { value: 'toughness',label: 'Toughness' },
  { value: 'edhrec',   label: 'EDHREC rank' },
  { value: 'usd',      label: 'Price (USD)' },
]

// ─── Build the Scryfall query string from form state ──────────────────────────

export function buildQuery(q: AdvancedQuery): string {
  const parts: string[] = []

  if (q.name.trim())     parts.push(`name:/${q.name.trim()}/`)
  if (q.text.trim())     parts.push(`o:"${q.text.trim()}"`)
  if (q.typeLine.trim()) parts.push(`t:"${q.typeLine.trim()}"`)
  if (q.artist.trim())   parts.push(`a:"${q.artist.trim()}"`)
  if (q.set.trim())      parts.push(`e:${q.set.trim().toLowerCase()}`)

  if (q.rarity)  parts.push(`r:${q.rarity}`)
  if (q.format)  parts.push(`f:${q.format}`)

  // Colors
  if (q.colors.length > 0) {
    const colorStr = q.colors.join('')
    const prefix = q.colorMode === 'exact' ? 'c=' : q.colorMode === 'atmost' ? 'c<=' : 'c>='
    parts.push(`${prefix}${colorStr}`)
  }

  // Color identity
  if (q.colorIdentity.length > 0) {
    const ciStr = q.colorIdentity.join('')
    const prefix = q.ciMode === 'exact' ? 'id=' : q.ciMode === 'atmost' ? 'id<=' : 'id>='
    parts.push(`${prefix}${ciStr}`)
  }

  // Numeric fields
  if (q.cmc.trim())       parts.push(`cmc${q.cmcOp}${q.cmc.trim()}`)
  if (q.power.trim())     parts.push(`pow${q.powerOp}${q.power.trim()}`)
  if (q.toughness.trim()) parts.push(`tou${q.toughnessOp}${q.toughness.trim()}`)

  // is: / not:
  for (const tag of q.is)  parts.push(`is:${tag}`)
  for (const tag of q.not) parts.push(`not:${tag}`)

  // Scryfall tagger tags
  const tagList = q.tags.split(',').map((t) => t.trim()).filter(Boolean)
  for (const tag of tagList) parts.push(`oracletag:${tag}`)

  return parts.join(' ')
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-ink/35 text-xs font-medium block mb-1.5">{children}</span>
}

function TextInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-surface-elevated border border-surface-border rounded-md px-2.5 py-1.5 text-ink text-xs placeholder-ink/18 focus:outline-none focus:border-accent/50 transition-colors"
    />
  )
}

function OpSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-surface-elevated border border-surface-border rounded-md px-1 py-1.5 text-ink text-xs focus:outline-none focus:border-accent/50 w-14 flex-shrink-0 transition-colors"
    >
      {['=', '<=', '>=', '<', '>'].map((op) => (
        <option key={op} value={op}>{op}</option>
      ))}
    </select>
  )
}

function Select({ value, onChange, options }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-surface-elevated border border-surface-border rounded-md px-2.5 py-1.5 text-ink text-xs focus:outline-none focus:border-accent/50 transition-colors"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label || '— any —'}</option>)}
    </select>
  )
}

function ColorPicker({ selected, onChange, label }: {
  selected: string[]
  onChange: (v: string[]) => void
  label: string
}) {
  const toggle = (c: string) =>
    onChange(selected.includes(c) ? selected.filter((x) => x !== c) : [...selected, c])
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-1.5 flex-wrap">
        {COLOR_OPTIONS.map((c) => (
          <button
            key={c.value}
            title={c.title}
            onClick={() => toggle(c.value)}
            className={`w-7 h-7 rounded-md text-xs font-bold transition-all ${c.bg} ${
              selected.includes(c.value)
                ? 'ring-2 ring-accent ring-offset-1 ring-offset-surface scale-110 shadow-lg'
                : 'opacity-35 hover:opacity-70'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function TagPicker({ selected, onChange, options, label }: {
  selected: string[]
  onChange: (v: string[]) => void
  options: string[]
  label: string
}) {
  const toggle = (t: string) =>
    onChange(selected.includes(t) ? selected.filter((x) => x !== t) : [...selected, t])
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1">
        {options.map((t) => (
          <button
            key={t}
            onClick={() => toggle(t)}
            className={`text-xs rounded-md px-2 py-1 border transition-all ${
              selected.includes(t)
                ? 'bg-accent/15 border-accent/50 text-accent/70 shadow-sm'
                : 'border-surface-border text-ink/28 hover:text-ink/70 hover:border-surface-hover bg-surface-elevated'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  onSearch: (query: string) => void
  loading: boolean
}

export function AdvancedSearch({ onSearch, loading }: Props): React.ReactElement {
  const [q, setQ] = useState<AdvancedQuery>(EMPTY_QUERY)
  const upd = (patch: Partial<AdvancedQuery>) => setQ((prev) => ({ ...prev, ...patch }))

  const query = buildQuery(q)
  const canSearch = query.trim().length > 0

  const handleSearch = () => {
    if (!canSearch) return
    // Append sort options
    let fullQuery = query
    if (q.sortBy !== 'name') fullQuery += ` order:${q.sortBy}`
    if (q.sortDir !== 'auto') fullQuery += ` direction:${q.sortDir}`
    onSearch(fullQuery)
  }

  const handleReset = () => setQ(EMPTY_QUERY)

  return (
    <div className="text-xs flex flex-col">

      {/* Actions — sticky at top of scroll container */}
      <div className="flex gap-2 px-3 py-2.5 sticky top-0 z-10 bg-surface-card border-b border-surface-border flex-shrink-0">
        <button
          onClick={handleSearch}
          disabled={!canSearch || loading}
          className="flex-1 bg-accent hover:bg-accent/90 disabled:opacity-30 disabled:cursor-not-allowed text-ink text-xs font-semibold rounded-md py-2 transition-colors shadow-sm"
        >
          {loading
            ? <span className="flex items-center justify-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse inline-block" />Searching...</span>
            : 'Search'
          }
        </button>
        <button
          onClick={handleReset}
          className="border border-surface-border rounded-md px-3 py-2 text-ink/28 hover:text-ink hover:border-white/25 hover:bg-surface-hover text-xs transition-colors"
        >
          Reset
        </button>
      </div>

      <div className="p-3 space-y-3">

      {/* Name & Text */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Card name</Label>
          <TextInput value={q.name} onChange={(v) => upd({ name: v })} placeholder="e.g. lightning" />
        </div>
        <div>
          <Label>Oracle text</Label>
          <TextInput value={q.text} onChange={(v) => upd({ text: v })} placeholder='e.g. "draw a card"' />
        </div>
      </div>

      {/* Type */}
      <div>
        <Label>Type line</Label>
        <TextInput value={q.typeLine} onChange={(v) => upd({ typeLine: v })} placeholder="e.g. Legendary Creature" />
      </div>

      {/* Colors */}
      <div className="space-y-2 bg-surface-elevated rounded-md p-2.5 border border-surface-border">
        <ColorPicker selected={q.colors} onChange={(v) => upd({ colors: v })} label="Colors" />
        <div className="flex gap-1.5">
          {(['including', 'exact', 'atmost'] as const).map((m) => (
            <button
              key={m}
              onClick={() => upd({ colorMode: m })}
              className={`text-xs rounded-md px-2 py-1 border transition-all ${
                q.colorMode === m
                  ? 'bg-accent/15 border-accent/50 text-accent/70'
                  : 'border-surface-border text-ink/25 hover:text-ink/70 hover:border-surface-hover'
              }`}
            >
              {m === 'including' ? 'including' : m === 'exact' ? 'exactly' : 'at most'}
            </button>
          ))}
        </div>
      </div>

      {/* Color identity */}
      <div className="space-y-2 bg-surface-elevated rounded-md p-2.5 border border-surface-border">
        <ColorPicker selected={q.colorIdentity} onChange={(v) => upd({ colorIdentity: v })} label="Color identity" />
        <div className="flex gap-1.5">
          {(['including', 'exact', 'atmost'] as const).map((m) => (
            <button
              key={m}
              onClick={() => upd({ ciMode: m })}
              className={`text-xs rounded-md px-2 py-1 border transition-all ${
                q.ciMode === m
                  ? 'bg-accent/15 border-accent/50 text-accent/70'
                  : 'border-surface-border text-ink/25 hover:text-ink/70 hover:border-surface-hover'
              }`}
            >
              {m === 'including' ? 'including' : m === 'exact' ? 'exactly' : 'at most'}
            </button>
          ))}
        </div>
      </div>

      {/* Numeric fields */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label>Mana value</Label>
          <div className="flex gap-1">
            <OpSelect value={q.cmcOp} onChange={(v) => upd({ cmcOp: v as any })} />
            <TextInput value={q.cmc} onChange={(v) => upd({ cmc: v })} placeholder="3" />
          </div>
        </div>
        <div>
          <Label>Power</Label>
          <div className="flex gap-1">
            <OpSelect value={q.powerOp} onChange={(v) => upd({ powerOp: v as any })} />
            <TextInput value={q.power} onChange={(v) => upd({ power: v })} placeholder="2" />
          </div>
        </div>
        <div>
          <Label>Toughness</Label>
          <div className="flex gap-1">
            <OpSelect value={q.toughnessOp} onChange={(v) => upd({ toughnessOp: v as any })} />
            <TextInput value={q.toughness} onChange={(v) => upd({ toughness: v })} placeholder="2" />
          </div>
        </div>
      </div>

      {/* Set / Rarity / Format */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label>Set code</Label>
          <TextInput value={q.set} onChange={(v) => upd({ set: v })} placeholder="e.g. MOM" />
        </div>
        <div>
          <Label>Rarity</Label>
          <Select
            value={q.rarity}
            onChange={(v) => upd({ rarity: v })}
            options={RARITY_OPTIONS.map((r) => ({ value: r, label: r || '— any —' }))}
          />
        </div>
        <div>
          <Label>Format</Label>
          <Select
            value={q.format}
            onChange={(v) => upd({ format: v })}
            options={FORMAT_OPTIONS.map((f) => ({ value: f, label: f || '— any —' }))}
          />
        </div>
      </div>

      {/* Artist */}
      <div>
        <Label>Artist</Label>
        <TextInput value={q.artist} onChange={(v) => upd({ artist: v })} placeholder="e.g. Rebecca Guay" />
      </div>

      {/* Scryfall tagger tags */}
      <div>
        <Label>Scryfall tags</Label>
        <TextInput
          value={q.tags}
          onChange={(v) => upd({ tags: v })}
          placeholder="e.g. removal, ramp, card-draw"
        />
        <p className="text-ink/18 text-xs mt-1 leading-relaxed">
          Comma-separated community tags from Scryfall Tagger (e.g. <span className="font-mono text-ink/30">removal</span>, <span className="font-mono text-ink/30">ramp</span>). Each becomes an <span className="font-mono text-ink/30">oracletag:</span> filter.
        </p>
      </div>

      {/* is: tags */}
      <TagPicker
        selected={q.is}
        onChange={(v) => upd({ is: v })}
        options={IS_OPTIONS}
        label="Card is..."
      />

      {/* Sort */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Sort by</Label>
          <Select value={q.sortBy} onChange={(v) => upd({ sortBy: v })} options={SORT_OPTIONS} />
        </div>
        <div>
          <Label>Direction</Label>
          <Select
            value={q.sortDir}
            onChange={(v) => upd({ sortDir: v as any })}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'asc',  label: 'Ascending' },
              { value: 'desc', label: 'Descending' },
            ]}
          />
        </div>
      </div>

      {/* Query preview */}
      <div className="bg-surface rounded-md border border-surface-border px-2.5 py-2">
        <p className="text-ink/20 text-xs mb-1 uppercase tracking-wide font-medium">Query preview</p>
        {query
          ? <span className="text-accent/80 text-xs font-mono break-all leading-relaxed">{query}</span>
          : <span className="text-ink/18 text-xs italic">Fill in fields above to build a query.</span>
        }
      </div>

      </div>{/* end p-3 space-y-3 */}
    </div>
  )
}
