import React, { useState, useRef, useEffect } from 'react'
import type { PrintCard } from '../../../../shared/types'
import { bridge } from '../../api/bridge'
import { useDeckStore } from '../../store/deckStore'
import { buildPrintCard } from '../../utils/scryfallUtils'

const BASIC_LANDS = new Set([
  'Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes',
  'Snow-Covered Plains', 'Snow-Covered Island', 'Snow-Covered Swamp',
  'Snow-Covered Mountain', 'Snow-Covered Forest',
])

function isExcludedCategory(cat: string, includeMaybeSideboard: boolean): boolean {
  const lower = cat.toLowerCase()
  if (lower.includes('acquire')) return true
  if (!includeMaybeSideboard && (lower.includes('sideboard') || lower.includes('maybe'))) return true
  return false
}

// ─── Export ───────────────────────────────────────────────────────────────────

function exportAsText(cards: PrintCard[]): string {
  return cards.map((c) => `${c.quantity}x ${c.displayName}`).join('\n')
}

// ─── URL detection ────────────────────────────────────────────────────────────

function parseArchidektUrl(input: string): string | null {
  const match = input.match(/archidekt\.com\/decks\/(\d+)/)
  return match ? match[1] : null
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CardImportExport(): React.ReactElement {
  const cards = useDeckStore((s) => s.cards)
  const addCard = useDeckStore((s) => s.addCard)

  const [mode, setMode] = useState<'export' | 'import'>('export')

  // URL import state
  const [deckUrl, setDeckUrl] = useState('')
  const [includeMaybeSideboard, setIncludeMaybeSideboard] = useState(false)
  const [ignoreBasicLands, setIgnoreBasicLands] = useState(true)
  const [urlImporting, setUrlImporting] = useState(false)
  const [urlStatus, setUrlStatus] = useState<string | null>(null)

  // Text import state
  const [importText, setImportText] = useState('')
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [copied, setCopied] = useState(false)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current) }, [])

  const exportText = exportAsText(cards)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(exportText)
    setCopied(true)
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = setTimeout(() => setCopied(false), 1800)
  }

  const handleUrlImport = async () => {
    const archidektId = parseArchidektUrl(deckUrl.trim())
    if (!archidektId) {
      setUrlStatus('Could not read a valid Archidekt URL.')
      return
    }

    setUrlImporting(true)
    setUrlStatus('Fetching deck...')

    const deckResult = await bridge.fetchDeck('archidekt', archidektId)
    if (!deckResult.ok || !deckResult.data) {
      setUrlStatus(deckResult.error ?? 'Failed to fetch deck.')
      setUrlImporting(false)
      return
    }

    const { deckName, cards: deckCards } = deckResult.data

    // Apply category and basic land filters
    const filtered = deckCards.filter((c) => {
      if (ignoreBasicLands && BASIC_LANDS.has(c.name)) return false
      if (c.categories.length === 0) return true
      return c.categories.some((cat) => !isExcludedCategory(cat, includeMaybeSideboard))
    })

    if (filtered.length === 0) {
      setUrlStatus('No cards matched the current filter settings.')
      setUrlImporting(false)
      return
    }

    setUrlStatus(`Importing ${filtered.length} card${filtered.length !== 1 ? 's' : ''} from "${deckName}"...`)

    let added = 0
    const failed: string[] = []

    for (const { name, quantity } of filtered) {
      const result = await bridge.scryfallNamed(name)
      if (!result.ok || !result.data) { failed.push(name); continue }
      const pc = await buildPrintCard(result.data)
      if (!pc) { failed.push(name); continue }
      addCard({ ...pc, quantity })
      added++
    }

    setUrlImporting(false)
    const parts: string[] = []
    if (added > 0) parts.push(`Added ${added} card${added !== 1 ? 's' : ''} from "${deckName}"`)
    if (failed.length > 0) parts.push(`Not found: ${failed.join(', ')}`)
    setUrlStatus(parts.join(' · '))
    if (added > 0) setDeckUrl('')
  }

  const handleImport = async () => {
    const lines = importText.split('\n')
    const parsed = lines
      .map((line) => {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) return null
        const match = trimmed.match(/^(\d+)[xX]?\s+(.+)$/)
        if (match) return { qty: parseInt(match[1]), name: match[2].trim() }
        return { qty: 1, name: trimmed }
      })
      .filter(Boolean) as { qty: number; name: string }[]

    if (parsed.length === 0) {
      setImportStatus('No valid card names found.')
      return
    }

    setImporting(true)
    setImportStatus(`Searching ${parsed.length} card${parsed.length !== 1 ? 's' : ''}...`)

    let added = 0
    const failed: string[] = []

    for (const { qty, name } of parsed) {
      const result = await bridge.scryfallNamed(name)
      if (!result.ok || !result.data) { failed.push(name); continue }
      const pc = await buildPrintCard(result.data)
      if (!pc) { failed.push(name); continue }
      addCard({ ...pc, quantity: qty })
      added++
    }

    setImporting(false)
    const parts: string[] = []
    if (added > 0) parts.push(`Added ${added} card${added !== 1 ? 's' : ''}`)
    if (failed.length > 0) parts.push(`Not found: ${failed.join(', ')}`)
    setImportStatus(parts.join(' · '))
    if (added > 0) setImportText('')
  }

  return (
    <div className="p-3 space-y-3">
      {/* Mode toggle */}
      <div className="flex bg-surface-elevated rounded-lg border border-surface-border p-0.5 gap-0.5">
        {(['export', 'import'] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setImportStatus(null); setUrlStatus(null) }}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${
              mode === m
                ? 'bg-accent/20 text-accent/70 border border-accent/40'
                : 'text-ink/30 hover:text-ink/60 border border-transparent'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Export */}
      {mode === 'export' && (
        <>
          {cards.length === 0 ? (
            <p className="text-ink/25 text-xs">No cards in the current list.</p>
          ) : (
            <>
              <textarea
                readOnly
                value={exportText}
                rows={Math.min(cards.length + 1, 10)}
                className="w-full bg-surface-elevated border border-surface-border rounded-md px-2.5 py-2 text-ink/70 text-xs font-mono resize-none focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="w-full text-xs border border-accent/35 text-accent/65 hover:text-accent/70 hover:border-accent/70 rounded-md py-1.5 hover:bg-accent/8 transition-all"
              >
                {copied ? 'Copied!' : 'Copy to clipboard'}
              </button>
            </>
          )}
        </>
      )}

      {/* Import */}
      {mode === 'import' && (
        <>
          {/* URL import */}
          <div className="space-y-2">
            <p className="text-ink/40 text-xs font-medium">Import from Archidekt</p>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={deckUrl}
                onChange={(e) => { setDeckUrl(e.target.value); setUrlStatus(null) }}
                placeholder="https://archidekt.com/decks/123456/..."
                className="flex-1 bg-surface-elevated border border-surface-border rounded-md px-2.5 py-1.5 text-ink text-xs focus:outline-none focus:border-accent/50 placeholder-ink/15 transition-colors"
              />
              <button
                onClick={handleUrlImport}
                disabled={!deckUrl.trim() || urlImporting}
                className="px-3 py-1.5 text-xs bg-accent hover:bg-accent/90 text-ink font-semibold rounded-md disabled:opacity-30 transition-colors flex-shrink-0"
              >
                {urlImporting ? '...' : 'Import'}
              </button>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMaybeSideboard}
                  onChange={(e) => setIncludeMaybeSideboard(e.target.checked)}
                  className="accent-[color:var(--accent-primary)]"
                />
                <span className="text-ink/40 text-xs">Include sideboard & maybeboard</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ignoreBasicLands}
                  onChange={(e) => setIgnoreBasicLands(e.target.checked)}
                  className="accent-[color:var(--accent-primary)]"
                />
                <span className="text-ink/40 text-xs">Ignore basic lands</span>
              </label>
            </div>
            {urlStatus && (
              <p className="text-ink/45 text-xs leading-relaxed">{urlStatus}</p>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-surface-border" />
            <span className="text-ink/20 text-xs">or paste a decklist</span>
            <div className="flex-1 h-px bg-surface-border" />
          </div>

          {/* Text import */}
          <div className="space-y-2">
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={'4x Lightning Bolt\n1x Black Lotus\nCounterspell'}
              rows={6}
              className="w-full bg-surface-elevated border border-surface-border rounded-md px-2.5 py-2 text-ink text-xs font-mono resize-none focus:outline-none focus:border-accent/50 placeholder-ink/15 transition-colors"
            />
            <button
              onClick={handleImport}
              disabled={!importText.trim() || importing}
              className="w-full bg-accent hover:bg-accent/90 text-ink font-semibold rounded-md py-2 text-sm disabled:opacity-30 transition-colors"
            >
              {importing ? 'Importing...' : 'Import cards'}
            </button>
            {importStatus && (
              <p className="text-ink/45 text-xs leading-relaxed">{importStatus}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
