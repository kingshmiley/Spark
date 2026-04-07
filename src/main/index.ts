import { app, BrowserWindow, shell, protocol, ipcMain } from 'electron'
import { join } from 'path'
import { readFileSync } from 'fs'
import { registerAllHandlers } from './ipc/index'
import { ensureDefaultBack } from './ipc/cache.handler'

// Must be called before app is ready — registers the custom scheme so the
// renderer can load local cached images without being blocked by CORS.
protocol.registerSchemesAsPrivileged([
  { scheme: 'localfile', privileges: { secure: true, supportFetchAPI: true, corsEnabled: true } }
])

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#111927',
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    title: 'Spark',
    show: false
  })

  // Window control IPC handlers — scoped to this window
  ipcMain.handle('window:minimize',     () => win.minimize())
  ipcMain.handle('window:maximize',     () => { win.isMaximized() ? win.unmaximize() : win.maximize() })
  ipcMain.handle('window:close',        () => win.close())
  ipcMain.handle('window:is-maximized', () => win.isMaximized())

  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    win.webContents.openDevTools()
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  // Handle localfile:// requests by reading the file directly from disk.
  // This avoids net.fetch's file:// quirks on Windows.
  protocol.handle('localfile', (request) => {
    const raw = decodeURIComponent(request.url.slice('localfile://'.length))
    // Restore Windows backslashes for the fs module
    const filePath = raw.replace(/\//g, '\\')
    try {
      const data = readFileSync(filePath)
      const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
      const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg'
      return new Response(data, { headers: { 'content-type': mime } })
    } catch {
      return new Response('File not found', { status: 404 })
    }
  })

  registerAllHandlers()
  try { ensureDefaultBack() } catch { /* non-fatal — renderer will show error if missing */ }
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
