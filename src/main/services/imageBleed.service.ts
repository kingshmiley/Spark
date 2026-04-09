import Jimp from 'jimp'

// Cache processed images for the lifetime of the app — same image + same bleed = same result
const cache = new Map<string, Buffer>()

// Pixels trimmed from each edge before any processing — removes the thin black
// frame line present on showcase/full-art cards.
const TRIM_PX = 6

// How many pixels to paint over at each corner of the card face.
const CORNER_FILL_SIZE = 4
// How far inward to sample the replacement color — past ornate frame decorations.
const CORNER_FILL_SAMPLE = 14

/**
 * Fills the four corners of an image (in place) with the color sampled
 * CORNER_FILL_SAMPLE pixels inward from each corner. Eliminates the black
 * rounded-corner pixel that appears at card image corners when printed as flat
 * rectangles, without overwriting ornate frame details near the corner.
 */
function fillCorners(img: Jimp): void {
  const w = img.bitmap.width
  const h = img.bitmap.height
  if (Math.min(w, h) <= CORNER_FILL_SAMPLE * 4) return
  const f = CORNER_FILL_SIZE
  const s = CORNER_FILL_SAMPLE
  img.composite(new Jimp(f, f, img.getPixelColor(s,         s)),         0,     0)
  img.composite(new Jimp(f, f, img.getPixelColor(w - 1 - s, s)),         w - f, 0)
  img.composite(new Jimp(f, f, img.getPixelColor(s,         h - 1 - s)), 0,     h - f)
  img.composite(new Jimp(f, f, img.getPixelColor(w - 1 - s, h - 1 - s)), w - f, h - f)
}

/**
 * Returns a buffer of the card image with TRIM_PX pixels cropped from each
 * edge and rounded-corner pixels filled. Used by the PDF service for
 * non-extend bleed modes.
 */
export async function trimCardImage(imagePath: string): Promise<Buffer> {
  const key = `trim:${imagePath}`
  if (cache.has(key)) return cache.get(key)!

  const img = await Jimp.read(imagePath)
  const w = img.bitmap.width
  const h = img.bitmap.height
  img.crop(TRIM_PX, TRIM_PX, w - TRIM_PX * 2, h - TRIM_PX * 2)
  fillCorners(img)

  const ext = imagePath.toLowerCase().split('.').pop()
  const mime = ext === 'png' ? Jimp.MIME_PNG : Jimp.MIME_JPEG
  const buffer = await img.getBufferAsync(mime)
  cache.set(key, buffer)
  return buffer
}

/**
 * Returns a buffer of the image with its edge pixels extended outward to fill
 * the bleed area. bleedAmountMm and cardWidth/HeightMm are used to compute
 * the correct pixel bleed from the image's actual dimensions.
 */
export async function extendEdges(
  imagePath: string,
  bleedAmountMm: number,
  cardWidthMm: number,
  cardHeightMm: number
): Promise<Buffer> {
  const key = `${imagePath}:${bleedAmountMm}:${cardWidthMm}:${cardHeightMm}`
  if (cache.has(key)) return cache.get(key)!

  const raw = await Jimp.read(imagePath)
  const img = raw.clone().crop(
    TRIM_PX, TRIM_PX,
    raw.bitmap.width  - TRIM_PX * 2,
    raw.bitmap.height - TRIM_PX * 2
  )
  fillCorners(img)

  const w = img.bitmap.width
  const h = img.bitmap.height

  // Bleed in pixels, proportional to the card's physical dimensions
  const bx = Math.ceil((bleedAmountMm / cardWidthMm)  * w)
  const by = Math.ceil((bleedAmountMm / cardHeightMm) * h)

  if (bx <= 0 && by <= 0) {
    const buf = await img.getBufferAsync(Jimp.MIME_JPEG)
    cache.set(key, buf)
    return buf
  }

  // Guard: how many pixels from each corner to replace with the inward sample.
  // ~2% of the shorter image dimension, capped at 12px.
  const guard = Math.min(Math.floor(Math.min(w, h) * 0.02), 12)

  const out = new Jimp(w + 2 * bx, h + 2 * by, 0x000000ff)
  out.composite(img, bx, by)

  // ── Left / right strips ────────────────────────────────────────────────────
  const left  = img.clone().crop(0,     0, 1, h).resize(bx, h, Jimp.RESIZE_NEAREST_NEIGHBOR)
  const right = img.clone().crop(w - 1, 0, 1, h).resize(bx, h, Jimp.RESIZE_NEAREST_NEIGHBOR)

  if (guard > 0 && h > guard * 4) {
    left.composite(new Jimp(bx, guard, img.getPixelColor(guard,         guard)),         0, 0)
    left.composite(new Jimp(bx, guard, img.getPixelColor(guard,         h - 1 - guard)), 0, h - guard)
    right.composite(new Jimp(bx, guard, img.getPixelColor(w - 1 - guard, guard)),         0, 0)
    right.composite(new Jimp(bx, guard, img.getPixelColor(w - 1 - guard, h - 1 - guard)), 0, h - guard)
  }

  if (bx > 0) {
    out.composite(left,  0,      by)
    out.composite(right, w + bx, by)
  }

  // ── Top / bottom strips ────────────────────────────────────────────────────
  const top    = img.clone().crop(0, 0,     w, 1).resize(w, by, Jimp.RESIZE_NEAREST_NEIGHBOR)
  const bottom = img.clone().crop(0, h - 1, w, 1).resize(w, by, Jimp.RESIZE_NEAREST_NEIGHBOR)

  if (guard > 0 && w > guard * 4) {
    top.composite(new Jimp(guard, by, img.getPixelColor(guard,         guard)),         0,         0)
    top.composite(new Jimp(guard, by, img.getPixelColor(w - 1 - guard, guard)),         w - guard, 0)
    bottom.composite(new Jimp(guard, by, img.getPixelColor(guard,         h - 1 - guard)), 0,         0)
    bottom.composite(new Jimp(guard, by, img.getPixelColor(w - 1 - guard, h - 1 - guard)), w - guard, 0)
  }

  if (by > 0) {
    out.composite(top,    bx, 0)
    out.composite(bottom, bx, h + by)
  }

  // ── Corners ────────────────────────────────────────────────────────────────
  // Crop from a deeper inward offset so corner bleed avoids any residual dark
  // frame pixels without affecting the card face trim.
  const cornerOffset = 6  // extra pixels inward on top of TRIM_PX (total: 12px from original edge)
  if (bx > 0 && by > 0) {
    const tl = img.clone().crop(cornerOffset,          cornerOffset,          bx, by).resize(bx, by, Jimp.RESIZE_NEAREST_NEIGHBOR)
    const bl = img.clone().crop(cornerOffset,          h - by - cornerOffset, bx, by).resize(bx, by, Jimp.RESIZE_NEAREST_NEIGHBOR)
    const tr = img.clone().crop(w - bx - cornerOffset, cornerOffset,          bx, by).resize(bx, by, Jimp.RESIZE_NEAREST_NEIGHBOR)
    const br = img.clone().crop(w - bx - cornerOffset, h - by - cornerOffset, bx, by).resize(bx, by, Jimp.RESIZE_NEAREST_NEIGHBOR)
    out.composite(tl, 0,      0)
    out.composite(bl, 0,      h + by)
    out.composite(tr, w + bx, 0)
    out.composite(br, w + bx, h + by)
  }

  const buffer = await out.getBufferAsync(Jimp.MIME_JPEG)
  cache.set(key, buffer)
  return buffer
}

export function clearExtendCache(): void {
  cache.clear()
}
