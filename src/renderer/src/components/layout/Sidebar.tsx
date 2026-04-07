import React, { Suspense } from 'react'
import { useUiStore } from '../../store/uiStore'
import { CardSearch } from '../cards/CardSearch'
import { CustomTab } from '../cards/CustomTab'
import { CardImportExport } from '../cards/CardImportExport'

type ActivePanel = 'cards' | 'document'
type CardTab = 'search' | 'custom' | 'importexport'

const SettingsPanelLazy = React.lazy(() =>
  import('../settings/PrintSettingsPanel').then((m) => ({ default: m.PrintSettingsPanel }))
)

function SearchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="5" cy="5" r="3.5" />
      <line x1="8" y1="8" x2="11" y2="11" />
    </svg>
  )
}

function CustomIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="2" width="10" height="8" rx="1" />
      <circle cx="4" cy="5" r="1" />
      <polyline points="1,9 4,6 6.5,8.5 8.5,6.5 11,9" />
    </svg>
  )
}

function ImportExportIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="6" y1="1" x2="6" y2="8" />
      <polyline points="3,5 6,8 9,5" />
      <line x1="2" y1="11" x2="10" y2="11" />
    </svg>
  )
}

export function Sidebar(): React.ReactElement {
  const { activePanel, setActivePanel, cardTab, setCardTab } = useUiStore()

  const cardTabs: { id: CardTab; label: string; icon: React.ReactNode }[] = [
    { id: 'search',      label: 'Scryfall',  icon: <SearchIcon /> },
    { id: 'custom',      label: 'Custom',    icon: <CustomIcon /> },
    { id: 'importexport',label: 'Decklist', icon: <ImportExportIcon /> },
  ]

  return (
    <div data-tour="left-sidebar" className="w-72 flex-shrink-0 bg-surface-card border-r border-surface-border flex flex-col shadow-panel">
      {/* Top nav — Cards / Document */}
      <div className="flex border-b border-surface-border flex-shrink-0 bg-surface-card">
        {(['cards', 'document'] as ActivePanel[]).map((panel) => (
          <button
            key={panel}
            data-tour={panel === 'document' ? 'document-tab' : undefined}
            onClick={() => setActivePanel(panel as any)}
            className={`flex-1 py-3 text-xs font-semibold tracking-wide uppercase transition-all ${
              activePanel === panel
                ? 'text-accent/80 border-b-2 border-accent bg-accent/5'
                : 'text-ink/25 hover:text-ink/60 hover:bg-surface-elevated'
            }`}
          >
            {panel === 'cards' ? 'Cards' : 'Document'}
          </button>
        ))}
      </div>

      {/* Cards panel */}
      {activePanel === 'cards' && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Segmented pill — Scryfall / Custom / Import/Export */}
          <div data-tour="card-tabs" className="px-3 py-2.5 border-b border-surface-border flex-shrink-0">
            <div className="flex items-center bg-surface-elevated rounded-lg border border-surface-border p-0.5 gap-0.5">
              {cardTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setCardTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-all ${
                    cardTab === tab.id
                      ? 'bg-accent/20 text-accent/70 border border-accent/40 shadow-sm'
                      : 'text-ink/30 hover:text-ink/60 hover:bg-surface-hover border border-transparent'
                  }`}
                >
                  <span className={cardTab === tab.id ? 'text-accent/80' : 'text-ink/25'}>{tab.icon}</span>
                  <span className="truncate">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tab content — full remaining height */}
          <div className="flex-1 min-h-0 flex flex-col">
            {cardTab === 'search'       && <CardSearch />}
            {cardTab === 'custom'       && <div className="flex-1 min-h-0 overflow-y-auto"><CustomTab /></div>}
            {cardTab === 'importexport' && <div className="flex-1 min-h-0 overflow-y-auto"><CardImportExport /></div>}
          </div>
        </div>
      )}

      {activePanel === 'document' && (
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto bg-surface">
          <Suspense fallback={
            <div className="p-6 flex items-center gap-2 text-ink/20 text-xs">
              <span className="w-2 h-2 rounded-full bg-accent/40 animate-pulse" />
              Loading...
            </div>
          }>
            <SettingsPanelLazy />
          </Suspense>
        </div>
      )}
    </div>
  )
}
