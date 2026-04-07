import Jimp from 'jimp'
import { readFileSync } from 'fs'

// Cache processed images for the lifetime of the app — same image + same bleed = same result
const cache = new Map<string, Buffer>()

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

  const img = await Jimp.read(imagePath)
  const w = img.bitmap.width
  const h = img.bitmap.height

  // Bleed in pixels, proportional to the card's physical dimensions
  const bx = Math.ceil((bleedAmountMm / cardWidthMm)  * w)
  const by = Math.ceil((bleedAmountMm / cardHeightMm) * h)

  if (bx <= 0 && by <= 0) {
    const raw = readFileSync(imagePath)
    cache.set(key, raw)
    return raw
  }

  const out = new Jimp(w + 2 * bx, h + 2 * by, 0x000000ff)

  // Original image at center
  out.composite(img, bx, by)

  // Left / right edge strips (1px wide, stretched to bx wide)
  if (bx > 0) {
    const left  = img.clone().crop(0,     0, 1, h).resize(bx, h, Jimp.RESIZE_NEAREST_NEIGHBOR)
    const right = img.clone().crop(w - 1, 0, 1, h).resize(bx, h, Jimp.RESIZE_NEAREST_NEIGHBOR)
    out.composite(left,  0,      by)
    out.composite(right, w + bx, by)
  }

  // Top / bottom edge strips (1px tall, stretched to by tall)
  if (by > 0) {
    const top    = img.clone().crop(0, 0,     w, 1).resize(w, by, Jimp.RESIZE_NEAREST_NEIGHBOR)
    const bottom = img.clone().crop(0, h - 1, w, 1).resize(w, by, Jimp.RESIZE_NEAREST_NEIGHBOR)
    out.composite(top,    bx, 0)
    out.composite(bottom, bx, h + by)
  }

  // Corners (1×1 px stretched to bx×by)
  if (bx > 0 && by > 0) {
    const tl = img.clone().crop(0,     0,     1, 1).resize(bx, by, Jimp.RESIZE_NEAREST_NEIGHBOR)
    const tr = img.clone().crop(w - 1, 0,     1, 1).resize(bx, by, Jimp.RESIZE_NEAREST_NEIGHBOR)
    const bl = img.clone().crop(0,     h - 1, 1, 1).resize(bx, by, Jimp.RESIZE_NEAREST_NEIGHBOR)
    const br = img.clone().crop(w - 1, h - 1, 1, 1).resize(bx, by, Jimp.RESIZE_NEAREST_NEIGHBOR)
    out.composite(tl, 0,      0)
    out.composite(tr, w + bx, 0)
    out.composite(bl, 0,      h + by)
    out.composite(br, w + bx, h + by)
  }

  const buffer = await out.getBufferAsync(Jimp.MIME_JPEG)
  cache.set(key, buffer)
  return buffer
}

export function clearExtendCache(): void {
  cache.clear()
}
