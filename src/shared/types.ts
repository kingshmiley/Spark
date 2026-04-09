// ─── Image Sources ───────────────────────────────────────────────────────────

export type ImageSource =
  | { kind: 'scryfall'; scryfallId: string; imageUri: string; name: string }
  | { kind: 'local'; filePath: string; name: string }
  | { kind: 'builtin'; name: string } // built-in default card back

export interface CardFace {
  imageSource: ImageSource
  cachedPath?: string  // absolute path to locally cached/copied image
  dataUrl?: string     // base64 data URL for display — not saved to project files
}

// ─── Print Card ───────────────────────────────────────────────────────────────

export interface PrintCard {
  id: string // UUID
  quantity: number
  front: CardFace
  back: CardFace | 'default' // 'default' = use global default back
  displayName: string
  scryfallData?: ScryfallCard
}

// ─── Scryfall API ─────────────────────────────────────────────────────────────

export interface ScryfallCard {
  id: string
  name: string
  set: string
  set_name: string
  collector_number: string
  image_uris?: {
    small: string
    normal: string
    large: string
    png: string
    art_crop: string
  }
  card_faces?: Array<{
    name: string
    image_uris?: {
      small: string
      normal: string
      large: string
      png: string
      art_crop: string
    }
  }>
  layout: string
}

// ─── Print Settings ───────────────────────────────────────────────────────────

export type PaperSize = 'letter' | 'a4' | 'legal' | 'tabloid' | 'custom'
export type Orientation = 'portrait' | 'landscape'
export type DuplexMode = 'none' | 'long-edge' | 'short-edge'
export type ColorMode = 'color' | 'grayscale'
export type ScaleMode = 'actual-size' | 'fit-page' | 'fill-page'
export type BleedMethod = 'scale' | 'black' | 'extend'

export interface BleedSettings {
  enabled: boolean
  amountMm: number
  method: BleedMethod // 'scale' = art fills slot, 'black' = art inset + black border, 'extend' = edge pixels smeared outward
}


export interface PrintSettings {
  printerName: string // empty = system default
  paperSize: PaperSize
  customPaperWidthMm: number
  customPaperHeightMm: number
  orientation: Orientation
  dpi: number
  gridCols: number
  gridRows: number
  duplex: DuplexMode
  copies: number
  colorMode: ColorMode
  scale: ScaleMode
  bleed: BleedSettings
  defaultBack: CardFace
  cardWidthMm: number  // default 63.5
  cardHeightMm: number // default 88.9
  cardSpacingMm: number // gap between cards on page
  showCutLines: boolean
  cutMarkersV: boolean  // vertical cuts — markers at top/bottom paper edge
  cutMarkersH: boolean  // horizontal cuts — markers at left/right paper edge
}

// ─── Layout Engine ────────────────────────────────────────────────────────────

export interface CardSlot {
  printCardId: string | null // null = empty/padding slot
  face: 'front' | 'back'
  isEmpty: boolean
}

export interface PageLayout {
  slots: CardSlot[]
  rows: number
  cols: number
  isFrontPage: boolean
  pageIndex: number // 0-based
  pairedPageIndex: number | null // index of the corresponding back/front page
}

// ─── Print Job ────────────────────────────────────────────────────────────────

export interface PrintJob {
  pages: PageLayout[]
  cards: PrintCard[]
  settings: PrintSettings
  outputMode: 'print' | 'pdf'
  pdfOutputPath?: string
}

// ─── Printer Info ─────────────────────────────────────────────────────────────

export interface PrinterInfo {
  name: string
  isDefault: boolean
  description: string
}

// ─── IPC Result Envelope ─────────────────────────────────────────────────────

export interface IpcResult<T = void> {
  ok: boolean
  data?: T
  error?: string
}

// ─── Preset ──────────────────────────────────────────────────────────────────

export interface Preset {
  name: string
  settings: PrintSettings
  createdAt: string
}

// ─── Project Save File ───────────────────────────────────────────────────────

export interface PrintFile {
  version: 1
  cards: PrintCard[]
  settings: PrintSettings
  savedAt: string
}

// ─── Custom Card Library ─────────────────────────────────────────────────────

export interface LibraryCard {
  id: string           // UUID, stable identifier
  name: string         // user-assigned display name
  frontPath: string    // absolute path to front image
  backPath?: string    // absolute path to back image (optional)
  addedAt: string      // ISO date string
}

// ─── Default values ──────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: PrintSettings = {
  printerName: '',
  paperSize: 'letter',
  customPaperWidthMm: 215.9,
  customPaperHeightMm: 279.4,
  orientation: 'portrait',
  dpi: 300,
  gridCols: 3,
  gridRows: 3,
  duplex: 'none',
  copies: 1,
  colorMode: 'color',
  scale: 'actual-size',
  bleed: { enabled: true, amountMm: 1, method: 'extend' },
  defaultBack: {
    imageSource: { kind: 'builtin', name: 'MTG Card Back' }
  },
  cardWidthMm: 63.5,
  cardHeightMm: 88.9,
  cardSpacingMm: 2,
  showCutLines: false,
  cutMarkersV: false,
  cutMarkersH: false,
}

export const PAPER_SIZES_MM: Record<Exclude<PaperSize, 'custom'>, { w: number; h: number }> = {
  letter:  { w: 215.9, h: 279.4 },
  a4:      { w: 210,   h: 297   },
  legal:   { w: 215.9, h: 355.6 },
  tabloid: { w: 279.4, h: 431.8 }
}
