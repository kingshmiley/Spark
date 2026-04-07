import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, createWriteStream, rmSync, renameSync, unlinkSync } from 'fs'
import axios from 'axios'

// Lazy getters so app.getPath() is only called after app is ready
function getCacheDir(): string  { return join(app.getPath('userData'), 'image-cache') }
function getScryfallDir(): string { return join(getCacheDir(), 'scryfall') }

export function ensureCacheDirs(): void {
  for (const dir of [getCacheDir(), getScryfallDir()]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }
}

export function getScryfallCachePath(id: string, size: string): string {
  return join(getScryfallDir(), `${id}-${size}.jpg`)
}

// In-flight download promises keyed by destination path — prevents concurrent
// duplicate downloads from creating a race condition on the same file.
const inFlight = new Map<string, Promise<string>>()

export async function fetchAndCacheScryfallImage(
  imageUri: string,
  id: string,
  size: string
): Promise<string> {
  ensureCacheDirs()
  const dest = getScryfallCachePath(id, size)
  if (existsSync(dest)) return dest

  // If a download for this path is already in progress, wait for it
  const existing = inFlight.get(dest)
  if (existing) return existing

  const promise = (async () => {
    // Write to a temp file first, then rename atomically to avoid partial reads
    const tmp = dest + '.tmp'
    try {
      const response = await axios.get(imageUri, { responseType: 'stream', timeout: 30000 })
      await new Promise<void>((resolve, reject) => {
        const writer = createWriteStream(tmp)
        response.data.pipe(writer)
        writer.on('finish', resolve)
        writer.on('error', reject)
      })
      renameSync(tmp, dest)
    } catch (err) {
      try { unlinkSync(tmp) } catch { /* ignore */ }
      throw err
    } finally {
      inFlight.delete(dest)
    }
    return dest
  })()

  inFlight.set(dest, promise)
  return promise
}

export function clearCache(): void {
  const dir = getCacheDir()
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
}

export { getCacheDir }
