import { create } from 'zustand'

// ─── Step definitions ─────────────────────────────────────────────────────────

export interface TourStep {
  id: string
  target: string | null         // data-tour attribute value; null = centered modal
  title: string
  body: string
  preferSide?: 'left' | 'right' // override auto-positioning of the callout
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    target: null,
    title: 'Welcome to Spark',
    body: 'Spark helps you create print-ready proxy cards for Magic: The Gathering. This short tour will walk you through everything — it only takes a minute.',
  },
  {
    id: 'left-sidebar',
    target: 'left-sidebar',
    title: 'Adding Cards',
    body: 'This is your card panel. Search Scryfall by name, browse your local custom image library, or import a full decklist by text or Archidekt URL.',
    preferSide: 'right',
  },
  {
    id: 'card-tabs',
    target: 'card-tabs',
    title: 'Three Ways to Add Cards',
    body: 'Scryfall searches the full card database. Custom lets you use your own local images. Decklist imports a whole deck at once — paste a list or drop in an Archidekt link.',
    preferSide: 'right',
  },
  {
    id: 'card-list',
    target: 'card-list',
    title: 'Your Print List',
    body: 'Cards you add appear here, grouped by page. Adjust quantities with +/−, drag rows to reorder, or click a card to change its printing or assign a custom card back.',
    preferSide: 'left',
  },
  {
    id: 'print-preview',
    target: 'print-preview',
    title: 'Print Preview',
    body: 'This shows exactly how your cards will be laid out on the page, updated in real time. Zoom in to check spacing, or switch to Spread view to preview front and back sheets side by side.',
    preferSide: 'left',
  },
  {
    id: 'document-tab',
    target: 'document-tab',
    title: 'Document Settings',
    body: 'Click Document to configure paper size, grid layout, DPI, bleed, duplex printing, and card dimensions. Hover over any ? button for a quick explanation of each setting.',
    preferSide: 'right',
  },
  {
    id: 'output',
    target: 'output-buttons',
    title: 'Print or Export',
    body: 'When your layout looks right, Export PDF saves a print-ready file. Print sends it directly to your printer. The print method (PDF viewer, SumatraPDF, or direct) can be configured in App Settings.',
    preferSide: 'left',
  },
  {
    id: 'done',
    target: null,
    title: "You're all set!",
    body: 'Hover over any ? button throughout the app for quick tips. You can replay this tour anytime from App Settings → Preferences.',
  },
]

// ─── Store ────────────────────────────────────────────────────────────────────

interface TourState {
  isActive: boolean
  currentStep: number
  startTour: () => void
  endTour: () => void
  nextStep: () => void
  prevStep: () => void
}

export const useTourStore = create<TourState>((set) => ({
  isActive: false,
  currentStep: 0,

  startTour: () => set({ isActive: true, currentStep: 0 }),
  endTour:   () => set({ isActive: false, currentStep: 0 }),
  nextStep:  () => set((s) => ({ currentStep: s.currentStep + 1 })),
  prevStep:  () => set((s) => ({ currentStep: Math.max(0, s.currentStep - 1) })),
}))
