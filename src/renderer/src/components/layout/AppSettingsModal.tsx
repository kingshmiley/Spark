import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useUiStore } from '../../store/uiStore'
import { useSettingsStore } from '../../store/settingsStore'
import { usePresetsStore } from '../../store/presetsStore'
import { useAppPrefsStore } from '../../store/appPrefsStore'
import { useTourStore } from '../../store/tourStore'
import { bridge } from '../../api/bridge'
import type { Preset, PrintSettings } from '../../../../shared/types'
import docsContent from '../../assets/docs.md?raw'

const ZOOM_LABELS = ['40%', '55%', '70%', '85%', '100%']

const THEMES = [
  { id: 'spark',    name: 'Spark',    pips: [] },
  { id: 'order',    name: 'Order',    pips: ['white'] },
  { id: 'ambition', name: 'Ambition', pips: ['black'] },
  { id: 'insight',  name: 'Insight',  pips: ['blue'] },
  { id: 'impulse',  name: 'Impulse',  pips: ['red'] },
  { id: 'growth',   name: 'Growth',   pips: ['green'] },
  { id: 'scheme',   name: 'Scheme',   pips: ['blue', 'black'] },
  { id: 'edict',    name: 'Edict',    pips: ['white', 'blue'] },
  { id: 'ruin',     name: 'Ruin',     pips: ['black', 'red'] },
  { id: 'fury',     name: 'Fury',     pips: ['red', 'green'] },
  { id: 'sanctum',  name: 'Sanctum',  pips: ['green', 'white'] },
  { id: 'dogma',    name: 'Dogma',    pips: ['black', 'white'] },
  { id: 'flux',     name: 'Flux',     pips: ['blue', 'red'] },
  { id: 'rot',      name: 'Rot',      pips: ['black', 'green'] },
  { id: 'zeal',     name: 'Zeal',     pips: ['red', 'white'] },
  { id: 'adapt',    name: 'Adapt',    pips: ['green', 'blue'] },
] as const

const PIP_COLORS: Record<string, string> = {
  orange: '#e84010',
  white:  '#f0e0a0',
  blue:   '#4a9eff',
  black:  '#4a3868',
  red:    '#e84040',
  green:  '#4aad5a',
}

type ModalTab = 'theme' | 'presets' | 'preferences' | 'printing' | 'cache' | 'about'

const TABS: { id: ModalTab; label: string }[] = [
  { id: 'theme',       label: 'Theme' },
  { id: 'presets',     label: 'Presets' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'printing',    label: 'Printing' },
  { id: 'cache',       label: 'Cache' },
  { id: 'about',       label: 'About' },
]

export function AppSettingsModal(): React.ReactElement | null {
  const { appSettingsOpen, setAppSettingsOpen } = useUiStore()
  const { settings, setSettings } = useSettingsStore()
  const { presets, loadPresets, savePreset, deletePreset } = usePresetsStore()
  const { confirmClearAll, defaultZoomIndex, showSplash, defaultPresetName, printMethod, sumatraPath, theme, searchMode,
          registrationOffsetX, registrationOffsetY,
          setConfirmClearAll, setDefaultZoomIndex, setShowSplash, setDefaultPresetName, setPrintMethod, setSumatraPath, setTheme, setSearchMode,
          setRegistrationOffset, setTourCompleted } = useAppPrefsStore()
  const startTour = useTourStore((s) => s.startTour)

  const { appSettingsTab } = useUiStore()

  const [activeTab, setActiveTab] = useState<ModalTab>('theme')
  const [calibStatus, setCalibStatus] = useState<string | null>(null)
  const [calibPaperSize, setCalibPaperSize] = useState<string>(() => useSettingsStore.getState().settings.paperSize)
  const [sumatraWarning, setSumatraWarning] = useState<string | null>(null)
  const [cacheStatus, setCacheStatus] = useState<string | null>(null)
  const [defaultsStatus, setDefaultsStatus] = useState<string | null>(null)
  const [newPresetName, setNewPresetName] = useState('')
  const [presetStatus, setPresetStatus] = useState<string | null>(null)
  const [expandedPreset, setExpandedPreset] = useState<string | null>(null)

  React.useEffect(() => {
    if (appSettingsOpen) {
      loadPresets()
      if (appSettingsTab) setActiveTab(appSettingsTab as ModalTab)
    }
  }, [appSettingsOpen])

  if (!appSettingsOpen) return null

  const handleClearCache = async () => {
    setCacheStatus('Clearing...')
    const result = await bridge.clearCache()
    setCacheStatus(result.ok ? 'Cache cleared.' : (result.error ?? 'Failed to clear cache.'))
    setTimeout(() => setCacheStatus(null), 3000)
  }

  const handleSetPresetAsDefault = async (preset: Preset) => {
    const result = await bridge.saveAppDefaults(preset.settings)
    if (result.ok) {
      setDefaultPresetName(preset.name)
      setDefaultsStatus(`"${preset.name}" set as default.`)
      setTimeout(() => setDefaultsStatus(null), 2500)
    }
  }

  const rehydrateDefaultBack = async (s: PrintSettings): Promise<PrintSettings> => {
    const back = s.defaultBack
    if (back.imageSource.kind === 'builtin') {
      // Always re-fetch built-in back — dataUrl is never saved to disk
      const pathResult = await bridge.getDefaultBackPath()
      if (pathResult.ok && pathResult.data) {
        const du = await bridge.readFileAsDataUrl(pathResult.data)
        if (du.ok && du.data) {
          return { ...s, defaultBack: { ...back, cachedPath: pathResult.data, dataUrl: du.data } }
        }
      }
    } else if (back.cachedPath) {
      // Custom back — rehydrate from its cached path
      const du = await bridge.readFileAsDataUrl(back.cachedPath)
      if (du.ok && du.data) {
        return { ...s, defaultBack: { ...back, dataUrl: du.data } }
      }
    }
    return s
  }

  const handleRestoreDefaults = async () => {
    const result = await bridge.loadAppDefaults()
    if (result.ok && result.data) {
      const loaded = await rehydrateDefaultBack(result.data)
      setSettings(loaded)
      setDefaultsStatus('Defaults restored.')
      setTimeout(() => setDefaultsStatus(null), 2500)
    }
  }

  const handleLoadPreset = async (preset: Preset) => {
    const loadedSettings = await rehydrateDefaultBack(preset.settings)
    setSettings(loadedSettings)
    setAppSettingsOpen(false)
  }

  const handleSavePreset = async () => {
    const name = newPresetName.trim()
    if (!name) return
    await savePreset(name, settings)
    setNewPresetName('')
    setPresetStatus(`"${name}" saved.`)
    setTimeout(() => setPresetStatus(null), 2000)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={() => setAppSettingsOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-14 pb-6 pointer-events-none">
        <div className="w-[520px] max-h-full bg-surface-card border border-surface-border rounded-lg shadow-preview flex flex-col pointer-events-auto overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-surface-elevated flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="text-ink/50 text-base">⚙</span>
              <span className="text-ink/85 text-sm font-semibold">App Settings</span>
            </div>
            <button
              onClick={() => setAppSettingsOpen(false)}
              className="w-6 h-6 flex items-center justify-center rounded text-ink/25 hover:text-ink hover:bg-surface-hover transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>

          {/* Tab row */}
          <div className="flex border-b border-surface-border bg-surface-elevated flex-shrink-0 px-2 pt-2 gap-0.5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-all border-b-2 ${
                  activeTab === tab.id
                    ? 'text-accent-secondary/90 border-accent-secondary bg-accent-secondary/5'
                    : 'text-ink/30 border-transparent hover:text-ink/60 hover:bg-surface-hover'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">

            {/* ── Theme ─────────────────────────────────── */}
            {activeTab === 'theme' && (
              <div>
                <p className="text-ink/35 text-xs leading-relaxed mb-4">
                  Choose a color theme based on your MTG color identity.
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`flex items-center justify-between px-3 py-2 rounded-md border text-xs transition-all ${
                        theme === t.id
                          ? 'bg-accent/15 border-accent/50 text-accent/80'
                          : 'bg-surface-elevated border-surface-border text-ink/50 hover:text-ink/80 hover:border-surface-hover'
                      }`}
                    >
                      <span className="font-medium">{t.name}</span>
                      <div className="flex gap-1">
                        {t.pips.map((pip) => (
                          <span
                            key={pip}
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: PIP_COLORS[pip] }}
                          />
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Presets ───────────────────────────────── */}
            {activeTab === 'presets' && (
              <div>
                <p className="text-ink/35 text-xs leading-relaxed mb-4">
                  Save and load document setting presets for different print configurations.
                </p>

                {presets.length === 0 && (
                  <p className="text-ink/20 text-xs italic mb-4">No saved presets yet. Save one below.</p>
                )}

                {presets.length > 0 && (
                  <div className="space-y-1.5 mb-4">
                    {presets.map((preset) => {
                      const isDefault = defaultPresetName === preset.name
                      const isExpanded = expandedPreset === preset.name
                      const s = preset.settings
                      const paper = s.paperSize === 'custom'
                        ? `${s.customPaperWidthMm}×${s.customPaperHeightMm}mm`
                        : s.paperSize.charAt(0).toUpperCase() + s.paperSize.slice(1)
                      const duplex = s.duplex === 'none' ? 'None' : s.duplex === 'long-edge' ? 'Long edge' : 'Short edge'
                      return (
                        <div key={preset.name} className="bg-surface-elevated border border-surface-border rounded-md overflow-hidden transition-colors hover:border-surface-hover">
                          <div className="flex items-center gap-2 px-3 py-2.5">
                            <button
                              onClick={() => handleSetPresetAsDefault(preset)}
                              title={isDefault ? 'Current default' : 'Set as default'}
                              className={`w-4 h-4 flex items-center justify-center rounded transition-all flex-shrink-0 text-sm leading-none ${isDefault ? 'text-accent' : 'text-ink/15 hover:text-accent/50'}`}
                            >★</button>
                            <span className="flex-1 text-ink/70 text-xs font-medium truncate">{preset.name}</span>
                            <button
                              onClick={() => setExpandedPreset(isExpanded ? null : preset.name)}
                              className="text-xs text-ink/30 hover:text-ink/60 px-1.5 py-0.5 rounded transition-colors flex-shrink-0"
                              title="View settings"
                            >{isExpanded ? '▴' : '▾'}</button>
                            <button
                              onClick={() => handleLoadPreset(preset)}
                              className="text-xs text-accent/80 hover:text-accent/70 border border-accent/30 rounded px-2 py-0.5 hover:bg-accent/10 hover:border-accent/50 transition-all flex-shrink-0"
                            >Load</button>
                            <button
                              onClick={() => deletePreset(preset.name)}
                              className="w-5 h-5 flex items-center justify-center text-ink/15 hover:text-red-400 hover:bg-red-400/10 rounded transition-all flex-shrink-0"
                              title="Delete preset"
                            >×</button>
                          </div>
                          {isExpanded && (
                            <div className="border-t border-surface-border px-3 py-2.5 grid grid-cols-2 gap-x-4 gap-y-1">
                              {[
                                ['Paper', `${paper} · ${s.orientation}`],
                                ['Grid', `${s.gridCols}×${s.gridRows}`],
                                ['DPI', `${s.dpi}`],
                                ['Duplex', duplex],
                                ['Bleed', s.bleed.enabled ? `${s.bleed.amountMm}mm · ${s.bleed.method}` : 'Off'],
                                ['Color', s.colorMode],
                                ['Cards', `${s.cardWidthMm}×${s.cardHeightMm}mm`],
                                ['Spacing', `${s.cardSpacingMm}mm`],
                              ].map(([label, value]) => (
                                <div key={label} className="flex gap-1.5">
                                  <span className="text-ink/30 text-xs w-14 flex-shrink-0">{label}</span>
                                  <span className="text-ink/60 text-xs">{value}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                    placeholder="Save current settings as preset..."
                    className="flex-1 bg-surface-elevated border border-surface-border rounded-md px-2.5 py-1.5 text-ink text-xs placeholder-ink/20 focus:outline-none focus:border-accent/50 min-w-0 transition-colors"
                  />
                  <button
                    onClick={handleSavePreset}
                    disabled={!newPresetName.trim()}
                    className="text-xs bg-surface-elevated border border-surface-border rounded-md px-2.5 py-1.5 text-ink/45 hover:text-ink hover:border-white/25 disabled:opacity-30 transition-colors flex-shrink-0"
                  >Save</button>
                </div>
                {presetStatus && <p className="text-accent/80 text-xs mt-1">{presetStatus}</p>}

                <div className="border-t border-surface-border mt-6 pt-5">
                  <p className="text-ink/35 text-xs leading-relaxed mb-3">
                    The default preset is loaded automatically on every fresh launch.
                    Save a preset above, then mark it with ★ to set it as your default.
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleRestoreDefaults}
                      disabled={!defaultPresetName}
                      className="text-xs border border-accent/30 rounded-md px-3 py-1.5 text-accent/60 hover:text-accent hover:border-accent/60 hover:bg-accent/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Restore default preset
                    </button>
                    {defaultPresetName && (
                      <span className="text-ink/30 text-xs">— {defaultPresetName}</span>
                    )}
                    {defaultsStatus && <span className="text-accent/80 text-xs">{defaultsStatus}</span>}
                  </div>
                </div>
              </div>
            )}

            {/* ── Preferences ───────────────────────────── */}
            {activeTab === 'preferences' && (
              <div className="space-y-5">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="pref-confirm-clear"
                    checked={confirmClearAll}
                    onChange={(e) => setConfirmClearAll(e.target.checked)}
                    className="accent-[var(--accent-primary)] mt-0.5 flex-shrink-0"
                  />
                  <div>
                    <label htmlFor="pref-confirm-clear" className="text-ink/70 text-xs cursor-pointer font-medium">
                      Confirm before clearing card list
                    </label>
                    <p className="text-ink/30 text-xs mt-0.5">Show a confirmation prompt when "Clear all" is clicked.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="pref-show-splash"
                    checked={showSplash}
                    onChange={(e) => setShowSplash(e.target.checked)}
                    className="accent-[var(--accent-primary)] mt-0.5 flex-shrink-0"
                  />
                  <div>
                    <label htmlFor="pref-show-splash" className="text-ink/70 text-xs cursor-pointer font-medium">
                      Show splash screen on startup
                    </label>
                    <p className="text-ink/30 text-xs mt-0.5">Display the Spark logo animation when the app opens.</p>
                  </div>
                </div>

                <div>
                  <label className="text-ink/70 text-xs font-medium block mb-1.5">Card search mode</label>
                  <div className="flex gap-1">
                    {([
                      { value: 'select-printing', label: 'Choose printing', desc: 'Click a card to pick from all available printings.' },
                      { value: 'direct-add',      label: 'Direct add',      desc: 'Click a card to add it instantly using the shown printing.' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setSearchMode(opt.value)}
                        className={`flex-1 text-xs rounded-md py-1 border transition-all ${
                          searchMode === opt.value
                            ? 'bg-accent/15 border-accent/50 text-accent/70'
                            : 'border-surface-border text-ink/30 hover:text-ink/70 hover:border-surface-hover bg-surface-elevated'
                        }`}
                        title={opt.desc}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-ink/25 text-xs mt-1.5">
                    {searchMode === 'select-printing'
                      ? 'Click a result to browse all printings of that card, then pick one to add.'
                      : 'Click a result to add it directly — no intermediate step.'}
                  </p>
                </div>

                <div>
                  <label className="text-ink/70 text-xs font-medium block mb-1.5">Default preview zoom</label>
                  <div className="flex gap-1">
                    {ZOOM_LABELS.map((label, i) => (
                      <button
                        key={i}
                        onClick={() => setDefaultZoomIndex(i)}
                        className={`flex-1 text-xs rounded-md py-1 border transition-all ${
                          defaultZoomIndex === i
                            ? 'bg-accent/15 border-accent/50 text-accent/70'
                            : 'border-surface-border text-ink/30 hover:text-ink/70 hover:border-surface-hover bg-surface-elevated'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-surface-border pt-5">
                  <p className="text-ink/35 text-xs mb-3">
                    Replay the guided tour to walk through the app again from the beginning.
                  </p>
                  <button
                    onClick={() => {
                      setTourCompleted(false)
                      setAppSettingsOpen(false)
                      setTimeout(() => startTour(), 200)
                    }}
                    className="text-xs border border-surface-border rounded-md px-3 py-1.5 text-ink/50 hover:text-ink hover:border-white/25 hover:bg-surface-elevated transition-colors"
                  >
                    Replay guided tour
                  </button>
                </div>
              </div>
            )}

            {/* ── Printing ──────────────────────────────── */}
            {activeTab === 'printing' && (
              <div className="space-y-6">

                {/* Print method */}
                <div>
                  <p className="text-ink/35 text-xs leading-relaxed mb-3">
                    Choose how Spark sends documents to your printer.
                  </p>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="printMethod"
                        value="viewer"
                        checked={printMethod === 'viewer'}
                        onChange={() => setPrintMethod('viewer')}
                        className="accent-[var(--accent-primary)] mt-0.5 flex-shrink-0"
                      />
                      <div>
                        <span className="text-ink/70 text-xs font-medium">Open in PDF viewer (default)</span>
                        <p className="text-ink/30 text-xs mt-0.5">
                          Generates a PDF and opens it in your default viewer. Print from there using Ctrl+P.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="printMethod"
                        value="sumatra"
                        checked={printMethod === 'sumatra'}
                        onChange={() => setPrintMethod('sumatra')}
                        className="accent-[var(--accent-primary)] mt-0.5 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-ink/70 text-xs font-medium">Use SumatraPDF (direct print)</span>
                        <p className="text-ink/30 text-xs mt-0.5">
                          Sends directly to the printer via SumatraPDF command line. No dialog — prints immediately.
                        </p>
                        {printMethod === 'sumatra' && (
                          <div className="mt-2 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className={`flex-1 text-xs truncate px-2 py-1 rounded border ${
                                sumatraPath
                                  ? 'text-accent/70 border-accent/30 bg-accent/8'
                                  : 'text-ink/25 border-surface-border bg-surface-elevated'
                              }`}>
                                {sumatraPath || 'No executable selected'}
                              </span>
                              <button
                                onClick={async () => {
                                  const r = await bridge.openExeFile()
                                  if (r.ok && r.data) {
                                    const path = r.data.filePath
                                    const filename = path.split(/[\\/]/).pop()?.toLowerCase() ?? ''
                                    setSumatraPath(path)
                                    setSumatraWarning(
                                      filename.includes('sumatra')
                                        ? null
                                        : 'This doesn\'t look like SumatraPDF. Printing may not work as expected.'
                                    )
                                  }
                                }}
                                className="text-xs border border-surface-border rounded px-2 py-1 text-ink/50 hover:text-ink hover:border-white/25 bg-surface-elevated flex-shrink-0 transition-colors"
                              >
                                Browse...
                              </button>
                            </div>
                            {sumatraWarning && (
                              <p className="text-yellow-400/70 text-xs">{sumatraWarning}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-surface-border" />

                {/* Registration offset */}
                <div>
                  <p className="text-ink/60 text-xs font-semibold mb-1">Registration Offset</p>
                  <p className="text-ink/30 text-xs mb-3 leading-relaxed">
                    Compensates for duplex printing misalignment. Only applied when printing two-sided.
                  </p>
                  <div className="space-y-2.5">
                    {([['X', 'Horizontal', registrationOffsetX], ['Y', 'Vertical', registrationOffsetY]] as const).map(([axis, label, val]) => (
                      <div key={axis} className="flex items-center gap-3">
                        <span className="text-ink/40 text-xs w-20 flex-shrink-0">{label} ({axis})</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setRegistrationOffset(
                              axis === 'X' ? Math.round((val - 0.1) * 10) / 10 : registrationOffsetX,
                              axis === 'Y' ? Math.round((val - 0.1) * 10) / 10 : registrationOffsetY
                            )}
                            className="w-6 h-6 flex items-center justify-center rounded border border-surface-border text-ink/40 hover:text-ink hover:border-white/25 bg-surface-elevated text-xs transition-colors"
                          >−</button>
                          <input
                            type="number"
                            value={val}
                            step={0.1}
                            onChange={(e) => {
                              const n = parseFloat(e.target.value) || 0
                              setRegistrationOffset(
                                axis === 'X' ? n : registrationOffsetX,
                                axis === 'Y' ? n : registrationOffsetY
                              )
                            }}
                            className="w-16 text-center bg-surface-elevated border border-surface-border rounded px-1 py-1 text-ink text-xs focus:outline-none focus:border-accent/50 transition-colors"
                          />
                          <button
                            onClick={() => setRegistrationOffset(
                              axis === 'X' ? Math.round((val + 0.1) * 10) / 10 : registrationOffsetX,
                              axis === 'Y' ? Math.round((val + 0.1) * 10) / 10 : registrationOffsetY
                            )}
                            className="w-6 h-6 flex items-center justify-center rounded border border-surface-border text-ink/40 hover:text-ink hover:border-white/25 bg-surface-elevated text-xs transition-colors"
                          >+</button>
                          <span className="text-ink/30 text-xs ml-1">mm</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setRegistrationOffset(0, 0)}
                    disabled={registrationOffsetX === 0 && registrationOffsetY === 0}
                    className="mt-3 text-xs border border-surface-border rounded px-2.5 py-1 text-ink/40 hover:text-ink hover:border-white/25 bg-surface-elevated disabled:opacity-30 transition-colors"
                  >
                    Reset to 0
                  </button>

                  <div className="mt-4 pt-3 border-t border-surface-border">
                    <p className="text-ink/40 text-xs mb-2">Not sure of your offset? Print a calibration sheet.</p>
                    <div className="flex items-center gap-2">
                      <select
                        value={calibPaperSize}
                        onChange={(e) => setCalibPaperSize(e.target.value)}
                        className="bg-surface-elevated border border-surface-border rounded px-2 py-1.5 text-ink/60 text-xs focus:outline-none focus:border-accent/50 transition-colors"
                      >
                        <option value="letter">Letter</option>
                        <option value="a4">A4</option>
                        <option value="legal">Legal</option>
                        <option value="tabloid">Tabloid</option>
                      </select>
                      <button
                        onClick={async () => {
                          setCalibStatus('Generating...')
                          const { settings: s } = useSettingsStore.getState()
                          const r = await bridge.printCalibrationSheet({
                            paperSize: calibPaperSize,
                            orientation: s.orientation,
                            customPaperWidthMm: s.customPaperWidthMm,
                            customPaperHeightMm: s.customPaperHeightMm,
                          })
                          setCalibStatus(r.ok ? null : (r.error ?? 'Failed'))
                        }}
                        className="text-xs border border-accent/35 text-accent/65 hover:text-accent/80 hover:border-accent/60 rounded px-3 py-1.5 hover:bg-accent/8 transition-all"
                      >
                        Print calibration sheet
                      </button>
                    </div>
                    {calibStatus && <p className="text-ink/40 text-xs mt-1.5">{calibStatus}</p>}
                  </div>
                </div>

              </div>
            )}

            {/* ── Cache ─────────────────────────────────── */}
            {activeTab === 'cache' && (
              <div>
                <p className="text-ink/35 text-xs leading-relaxed mb-4">
                  Scryfall card images are cached locally to speed up loading.
                  Clear the cache to free disk space — images will be re-downloaded as needed.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleClearCache}
                    className="text-xs border border-surface-border rounded-md px-3 py-1.5 text-ink/50 hover:text-ink hover:border-white/25 hover:bg-surface-elevated transition-colors"
                  >
                    Clear image cache
                  </button>
                  {cacheStatus && (
                    <span className={`text-xs ${cacheStatus.startsWith('Cache cleared') ? 'text-accent/80' : 'text-ink/40'}`}>
                      {cacheStatus}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* ── About ─────────────────────────────────── */}
            {activeTab === 'about' && (
              <div className="flex flex-col gap-4 min-h-0">
                {/* App info */}
                <div className="space-y-3 flex-shrink-0">
                  {[
                    ['App', 'Spark'],
                    ['Version', '1.0.0 Beta'],
                    ['Card data', 'Scryfall API'],
                    ['Platform', 'Windows (Electron)'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="text-ink/30 text-xs">{label}</span>
                      <span className="text-ink/60 text-xs font-medium">{value}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-surface-border flex-shrink-0" />

                {/* Docs */}
                <div className="overflow-y-auto flex-1 min-h-0 pr-1" style={{ maxHeight: 340 }}>
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => <h1 className="text-ink/80 text-base font-semibold mb-3 mt-1">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-ink/70 text-sm font-semibold mt-5 mb-2 border-b border-surface-border pb-1">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-ink/60 text-xs font-semibold mt-4 mb-1.5 uppercase tracking-wide">{children}</h3>,
                      p: ({ children }) => <p className="text-ink/50 text-xs leading-relaxed mb-2">{children}</p>,
                      ul: ({ children }) => <ul className="space-y-0.5 mb-2 pl-3">{children}</ul>,
                      li: ({ children }) => <li className="text-ink/50 text-xs leading-relaxed list-disc list-outside ml-2">{children}</li>,
                      strong: ({ children }) => <strong className="text-ink/70 font-semibold">{children}</strong>,
                      code: ({ children }) => <code className="text-accent/70 bg-surface-elevated px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                      pre: ({ children }) => <pre className="bg-surface-elevated border border-surface-border rounded-md px-3 py-2 text-xs text-ink/50 font-mono overflow-x-auto mb-2">{children}</pre>,
                      hr: () => <hr className="border-surface-border my-4" />,
                    }}
                  >
                    {docsContent}
                  </ReactMarkdown>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  )
}
