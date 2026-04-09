import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import type { PrintFile, PrintJob, LibraryCard } from '../../shared/types'

const api = {
  // Scryfall
  scryfallSearch:        (query: string, allPrints?: boolean) => ipcRenderer.invoke(IPC.SCRYFALL_SEARCH, query, allPrints),
  scryfallAutocomplete:  (q: string)                         => ipcRenderer.invoke(IPC.SCRYFALL_AUTOCOMPLETE, q),
  scryfallNamed:      (name: string)                     => ipcRenderer.invoke(IPC.SCRYFALL_NAMED, name),
  scryfallFetchImage: (imageUri: string, id: string, size: string) => ipcRenderer.invoke(IPC.SCRYFALL_FETCH_IMAGE, imageUri, id, size),

  // Files
  readFileAsDataUrl:  (filePath: string)                 => ipcRenderer.invoke(IPC.FILE_READ_DATA_URL, filePath),
  openImageFile:      ()                                 => ipcRenderer.invoke(IPC.FILE_OPEN_IMAGE),
  openExeFile:        ()                                 => ipcRenderer.invoke(IPC.FILE_OPEN_EXE),
  openProject:        ()                                 => ipcRenderer.invoke(IPC.FILE_OPEN_PROJECT),
  saveProject:        (data: PrintFile)                  => ipcRenderer.invoke(IPC.FILE_SAVE_PROJECT, data),
  saveProjectAs:      (data: PrintFile)                  => ipcRenderer.invoke(IPC.FILE_SAVE_PROJECT_AS, data),

  // Printers
  listPrinters:       ()                                 => ipcRenderer.invoke(IPC.PRINTERS_LIST),

  // Output
  executePrint:       (job: PrintJob, method?: string, sumatraPath?: string, registrationOffset?: { x: number; y: number }) => ipcRenderer.invoke(IPC.PRINT_EXECUTE, job, method, sumatraPath, registrationOffset),
  exportPdf:          (job: PrintJob, registrationOffset?: { x: number; y: number }) => ipcRenderer.invoke(IPC.PDF_EXPORT, job, registrationOffset),
  choosePdfPath:      ()                                 => ipcRenderer.invoke(IPC.PDF_CHOOSE_PATH),

  // Cache
  clearCache:         ()                                 => ipcRenderer.invoke(IPC.CACHE_CLEAR),
  getDefaultBackPath: ()                                 => ipcRenderer.invoke(IPC.CACHE_GET_DEFAULT_BACK),

  // App defaults
  loadAppDefaults:    ()                                 => ipcRenderer.invoke(IPC.APP_DEFAULTS_LOAD),
  saveAppDefaults:    (settings: any)                    => ipcRenderer.invoke(IPC.APP_DEFAULTS_SAVE, settings),

  // Presets
  listPresets:        ()                                 => ipcRenderer.invoke(IPC.PRESETS_LIST),
  savePreset:         (preset: any)                      => ipcRenderer.invoke(IPC.PRESETS_SAVE, preset),
  deletePreset:       (name: string)                     => ipcRenderer.invoke(IPC.PRESETS_DELETE, name),

  // Deck sites
  fetchDeck:          (site: string, id: string)         => ipcRenderer.invoke(IPC.DECK_FETCH, { site, id }),

  // Calibration
  printCalibrationSheet: (payload: any)                  => ipcRenderer.invoke(IPC.CALIBRATION_PRINT, payload),

  // Printing favorites
  favoritesGet:       (cardName: string)                      => ipcRenderer.invoke(IPC.FAVORITES_GET, cardName),
  favoritesGetAll:    ()                                      => ipcRenderer.invoke(IPC.FAVORITES_GET_ALL),
  favoritesToggle:    (cardName: string, scryfallId: string)  => ipcRenderer.invoke(IPC.FAVORITES_TOGGLE, cardName, scryfallId),

  // Scryfall collection
  scryfallCollection: (ids: string[])                         => ipcRenderer.invoke(IPC.SCRYFALL_COLLECTION, ids),

  // Custom card library
  libraryList:        ()                                 => ipcRenderer.invoke(IPC.LIBRARY_LIST),
  librarySave:        (card: LibraryCard)                => ipcRenderer.invoke(IPC.LIBRARY_SAVE, card),
  libraryDelete:      (id: string)                       => ipcRenderer.invoke(IPC.LIBRARY_DELETE, id),

  // Window controls
  windowMinimize:     ()                                 => ipcRenderer.invoke(IPC.WINDOW_MINIMIZE),
  windowMaximize:     ()                                 => ipcRenderer.invoke(IPC.WINDOW_MAXIMIZE),
  windowClose:        ()                                 => ipcRenderer.invoke(IPC.WINDOW_CLOSE),
  windowIsMaximized:  ()                                 => ipcRenderer.invoke(IPC.WINDOW_IS_MAXIMIZED),
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
