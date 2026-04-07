/**
 * Converts an absolute local file path to a localfile:// URL that the
 * renderer can load in <img> tags without being blocked by CORS.
 * Handles both Windows backslash paths and forward-slash paths.
 */
export function toLocalFileUrl(filePath: string | undefined | null): string | null {
  if (!filePath) return null
  // Normalize Windows backslashes to forward slashes
  const normalized = filePath.replace(/\\/g, '/')
  // Remove leading slash duplication — localfile:// + /C:/... → localfile:///C:/...
  // net.fetch('file:///' + path) in main expects no leading slash in the path part
  const stripped = normalized.startsWith('/') ? normalized.slice(1) : normalized
  return `localfile://${stripped}`
}
