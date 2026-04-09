import React, { useEffect, useState } from 'react'
import { useSettingsStore } from '../../store/settingsStore'
import { usePresetsStore } from '../../store/presetsStore'
import { useUiStore } from '../../store/uiStore'
import { bridge } from '../../api/bridge'
import type { PrintSettings } from '../../../../shared/types'
import { TourHint } from '../layout/TourHint'

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3.5 border-b border-surface-border last:border-b-0">
      <div className="flex items-center gap-1 w-24 flex-shrink-0 pt-1.5">
        <span className="text-ink/40 text-xs leading-snug font-medium">{label}</span>
        {hint && <TourHint text={hint} />}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function Select<T extends string>({
  value, onChange, options
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="bg-surface-elevated border border-surface-border rounded px-2 py-1 text-ink text-sm focus:outline-none focus:border-accent/60 w-full"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function NumberInput({ value, onChange, min, max, step, unit }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; unit?: string
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step ?? 1}
        className="bg-surface-elevated border border-surface-border rounded px-2 py-1 text-ink text-sm w-16 focus:outline-none focus:border-accent/60"
      />
      {unit && <span className="text-ink/30 text-xs">{unit}</span>}
    </div>
  )
}

export function PrintSettingsPanel(): React.ReactElement {
  const { settings, availablePrinters, updateSettings, resetToDefaults, loadPrinters } = useSettingsStore()
  const { savePreset } = usePresetsStore()
  const openAppSettingsTab = useUiStore((s) => s.openAppSettingsTab)
  const [newPresetName, setNewPresetName] = useState('')
  const [presetStatus, setPresetStatus] = useState<string | null>(null)

  useEffect(() => { loadPrinters() }, [])

  const upd = (patch: Partial<PrintSettings>) => updateSettings(patch)

  const handleSavePreset = async () => {
    const name = newPresetName.trim()
    if (!name) return
    await savePreset(name, settings)
    setNewPresetName('')
    setPresetStatus(`"${name}" saved.`)
    setTimeout(() => setPresetStatus(null), 2000)
  }

  const pickDefaultBack = async () => {
    const result = await bridge.openImageFile()
    if (!result.ok || !result.data) return
    const path = result.data.filePath
    const du = await bridge.readFileAsDataUrl(path)
    updateSettings({
      defaultBack: {
        imageSource: { kind: 'local', filePath: path, name: 'Custom Default Back' },
        cachedPath: path,
        dataUrl: du.ok ? du.data : undefined
      }
    })
  }

  const defaultBackLabel = () => {
    const src = settings.defaultBack.imageSource
    if (src.kind === 'builtin') return 'Standard MTG back (default)'
    if (src.kind === 'local') return src.filePath.split(/[\\/]/).pop() ?? src.filePath
    return src.name
  }

  const resetDefaultBack = async () => {
    const pathResult = await bridge.getDefaultBackPath()
    if (pathResult.ok && pathResult.data) {
      const duResult = await bridge.readFileAsDataUrl(pathResult.data)
      updateSettings({
        defaultBack: {
          imageSource: { kind: 'builtin', name: 'MTG Card Back' },
          cachedPath: pathResult.data,
          dataUrl: duResult.ok ? duResult.data : undefined
        }
      })
    } else {
      updateSettings({ defaultBack: { imageSource: { kind: 'builtin', name: 'MTG Card Back' } } })
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-4 py-4">

        <div className="flex items-center gap-2 mb-5">
          <div className="w-1 h-4 bg-accent-secondary/50 rounded-full flex-shrink-0" />
          <h3 className="text-ink/50 text-xs font-semibold uppercase tracking-wider">Document Settings</h3>
        </div>

        {/* Printer */}
        <Row label="Printer">
          <Select
            value={settings.printerName}
            onChange={(v) => upd({ printerName: v })}
            options={[
              { value: '', label: 'System Default' },
              ...availablePrinters.map((p) => ({ value: p.name, label: p.name + (p.isDefault ? ' (default)' : '') }))
            ]}
          />
          <button onClick={loadPrinters} className="text-ink/30 hover:text-ink text-xs mt-1">Refresh list</button>
        </Row>

        {/* Copies */}
        <Row label="Copies">
          <NumberInput value={settings.copies} onChange={(v) => upd({ copies: Math.max(1, v) })} min={1} max={99} />
        </Row>

        {/* Color */}
        <Row label="Color mode">
          <Select
            value={settings.colorMode}
            onChange={(v) => upd({ colorMode: v })}
            options={[{ value: 'color', label: 'Color' }, { value: 'grayscale', label: 'Grayscale' }]}
          />
        </Row>

        {/* Paper size */}
        <Row label="Paper size">
          <Select
            value={settings.paperSize}
            onChange={(v) => upd({ paperSize: v })}
            options={[
              { value: 'letter', label: 'Letter (8.5 × 11 in)' },
              { value: 'a4',     label: 'A4 (210 × 297 mm)' },
              { value: 'legal',  label: 'Legal (8.5 × 14 in)' },
              { value: 'tabloid',label: 'Tabloid (11 × 17 in)' },
              { value: 'custom', label: 'Custom...' }
            ]}
          />
          {settings.paperSize === 'custom' && (
            <div className="flex gap-2 mt-2">
              <NumberInput value={settings.customPaperWidthMm}  onChange={(v) => upd({ customPaperWidthMm: v })}  step={0.1} unit="mm W" />
              <NumberInput value={settings.customPaperHeightMm} onChange={(v) => upd({ customPaperHeightMm: v })} step={0.1} unit="mm H" />
            </div>
          )}
        </Row>

        {/* Orientation */}
        <Row label="Orientation">
          <Select
            value={settings.orientation}
            onChange={(v) => upd({ orientation: v })}
            options={[{ value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]}
          />
        </Row>

        {/* DPI */}
        <Row label="DPI" hint="Controls image quality. 300 DPI is standard for home printing. 150 DPI is faster to generate but may look soft. 600 DPI is high quality but produces larger files and slower renders.">
          <Select
            value={String(settings.dpi)}
            onChange={(v) => upd({ dpi: parseInt(v) })}
            options={[
              { value: '150', label: '150 DPI (draft)' },
              { value: '300', label: '300 DPI (standard)' },
              { value: '600', label: '600 DPI (high quality)' }
            ]}
          />
        </Row>

        {/* Duplex */}
        <Row label="Duplex / 2-sided" hint="Two-sided printing puts card fronts on one side and backs on the other. Long edge is standard for portrait layouts. Short edge is for landscape. Your printer must support duplex for this to work automatically.">
          <Select
            value={settings.duplex}
            onChange={(v) => upd({ duplex: v })}
            options={[
              { value: 'none',       label: 'Off (single-sided)' },
              { value: 'long-edge',  label: 'Long edge (standard portrait flip)' },
              { value: 'short-edge', label: 'Short edge (landscape flip)' }
            ]}
          />
          {settings.duplex !== 'none' && (
            <p className="text-ink/30 text-xs mt-1">
              Back pages are mirror-flipped so cards align when the sheet is turned over.
            </p>
          )}
          <button
            onClick={() => openAppSettingsTab('printing')}
            className="mt-2 text-xs border border-surface-border rounded px-2.5 py-1 text-ink/50 hover:text-ink hover:border-white/25 bg-surface-elevated transition-colors"
          >
            Registration offset...
          </button>
        </Row>

        {/* Scale */}
        <Row label="Scale" hint="Actual size prints cards at exact real-world dimensions. Fit to page shrinks cards so the full grid fits within the printable area. Fill page scales cards up to fill the page, which may clip the outermost margins.">
          <Select
            value={settings.scale}
            onChange={(v) => upd({ scale: v })}
            options={[
              { value: 'actual-size', label: 'Actual size (exact dimensions)' },
              { value: 'fit-page',    label: 'Fit to page' },
              { value: 'fill-page',   label: 'Fill page (may clip)' }
            ]}
          />
        </Row>

        {/* Grid size */}
        <Row label="Grid size">
          <div className="flex items-center gap-2">
            <NumberInput value={settings.gridCols} onChange={(v) => upd({ gridCols: Math.max(1, Math.round(v)) })} min={1} max={10} />
            <span className="text-ink/30 text-xs">×</span>
            <NumberInput value={settings.gridRows} onChange={(v) => upd({ gridRows: Math.max(1, Math.round(v)) })} min={1} max={10} />
          </div>
          <p className="text-ink/20 text-xs mt-1">Columns × rows of cards per page</p>
        </Row>

        {/* Card dimensions */}
        <Row label="Card size">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-ink/30 text-xs w-14">Width</span>
              <NumberInput value={settings.cardWidthMm} onChange={(v) => upd({ cardWidthMm: v })} step={0.1} unit="mm" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-ink/30 text-xs w-14">Height</span>
              <NumberInput value={settings.cardHeightMm} onChange={(v) => upd({ cardHeightMm: v })} step={0.1} unit="mm" />
            </div>
          </div>
          <p className="text-ink/20 text-xs mt-1">Standard MTG: 63.5 × 88.9 mm</p>
        </Row>

        {/* Card spacing */}
        <Row label="Card spacing" hint="Gap between cards on the page. A small gap (1–3mm) makes individual cards easier to cut. Set to 0 for edge-to-edge layout.">
          <NumberInput value={settings.cardSpacingMm} onChange={(v) => upd({ cardSpacingMm: Math.max(0, v) })} step={0.5} unit="mm" />
        </Row>

        {/* Bleed */}
        <Row label="Bleed" hint="Bleed extends the printed image slightly past the cut line so trimmed edges don't show a white border. Edge extension is recommended — it smears the outermost pixels outward. Black border insets the art and fills the bleed area with black.">
          <div className="flex items-center gap-2 mb-1.5">
            <input
              type="checkbox"
              id="bleed-enabled"
              checked={settings.bleed.enabled}
              onChange={(e) => upd({ bleed: { ...settings.bleed, enabled: e.target.checked } })}
              className="accent-[var(--accent-primary)]"
            />
            <label htmlFor="bleed-enabled" className="text-ink/70 text-xs cursor-pointer">Enable bleed</label>
          </div>
          {settings.bleed.enabled && (
            <>
              <NumberInput
                value={settings.bleed.amountMm}
                onChange={(v) => upd({ bleed: { ...settings.bleed, amountMm: Math.max(0.5, v) } })}
                min={0.5}
                max={10}
                step={0.5}
                unit="mm each side"
              />
              <div className="mt-2">
                <label className="text-ink/40 text-xs block mb-1">Bleed style</label>
                <Select
                  value={settings.bleed.method ?? 'black'}
                  onChange={(v) => upd({ bleed: { ...settings.bleed, method: v } })}
                  options={[
                    { value: 'extend', label: 'Edge extension — outermost pixels smeared outward (recommended)' },
                    { value: 'black',  label: 'Black border — art inset, black fill at edges' },
                    { value: 'scale',  label: 'Scale — art fills full slot including bleed area' },
                  ]}
                />
              </div>
              <p className="text-ink/25 text-xs mt-1">
                Extends the printed image beyond the cut line. Trim marks show the true card edge.
              </p>
              {(settings.bleed.method ?? 'black') === 'extend' && (
                <p className="text-ink/40 text-xs mt-1.5">
                  Preview shows the bleed area as black — edge extension is applied at print/export time.
                </p>
              )}
            </>
          )}
        </Row>

        {/* Cut lines / markers */}
        <Row label="Cut lines" hint="Cut lines show the card boundary inside the bleed area. Cut markers are short tick marks at the paper edge showing where to cut with a guillotine cutter — they appear in both the preview and the printed output.">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="show-cut-lines"
                checked={settings.showCutLines !== false}
                onChange={(e) => upd({ showCutLines: e.target.checked })}
                className="accent-[var(--accent-primary)]"
              />
              <label htmlFor="show-cut-lines" className="text-ink/70 text-xs cursor-pointer">Show cut lines in preview</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="cut-markers-v"
                checked={settings.cutMarkersV === true}
                onChange={(e) => upd({ cutMarkersV: e.target.checked })}
                className="accent-[var(--accent-primary)]"
              />
              <label htmlFor="cut-markers-v" className="text-ink/70 text-xs cursor-pointer">Vertical cut markers (top/bottom edge)</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="cut-markers-h"
                checked={settings.cutMarkersH === true}
                onChange={(e) => upd({ cutMarkersH: e.target.checked })}
                className="accent-[var(--accent-primary)]"
              />
              <label htmlFor="cut-markers-h" className="text-ink/70 text-xs cursor-pointer">Horizontal cut markers (left/right edge)</label>
            </div>
          </div>
        </Row>

        {/* Default card back */}
        <Row label="Default card back">
          <div className="space-y-1.5">
            <p className="text-ink/60 text-xs truncate">{defaultBackLabel()}</p>
            <div className="flex gap-2">
              <button
                onClick={pickDefaultBack}
                className="text-xs bg-surface-elevated border border-surface-border rounded px-2 py-1 text-ink/60 hover:text-ink hover:border-surface-hover transition-colors"
              >
                Browse image...
              </button>
              <button
                onClick={resetDefaultBack}
                className="text-xs bg-surface-elevated border border-surface-border rounded px-2 py-1 text-ink/60 hover:text-ink hover:border-surface-hover transition-colors"
              >
                Reset to standard
              </button>
            </div>
          </div>
        </Row>

        {/* Reset */}
        <div className="pt-5 pb-2">
          <button
            onClick={resetToDefaults}
            className="text-ink/25 hover:text-ink/60 text-xs border border-surface-border rounded-md px-3 py-2 hover:border-surface-hover transition-colors w-full"
          >
            Reset all settings to defaults
          </button>
        </div>
      </div>

      {/* Save as preset — sticky footer */}
      <div className="border-t border-surface-border px-5 py-4 bg-surface-card flex-shrink-0">
        <p className="text-ink/25 text-xs mb-2.5">Save current settings as a preset — manage presets in ⚙ App Settings</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
            placeholder="Preset name..."
            className="flex-1 bg-surface-elevated border border-surface-border rounded-md px-2.5 py-1.5 text-ink text-xs placeholder-ink/20 focus:outline-none focus:border-accent/50 min-w-0 transition-colors"
          />
          <button
            onClick={handleSavePreset}
            disabled={!newPresetName.trim()}
            className="text-xs bg-surface-elevated border border-surface-border rounded-md px-2.5 py-1.5 text-ink/45 hover:text-ink hover:border-white/25 disabled:opacity-30 transition-colors flex-shrink-0"
          >
            Save
          </button>
        </div>
        {presetStatus && <p className="text-accent/80 text-xs mt-1.5">{presetStatus}</p>}
      </div>
    </div>
  )
}
