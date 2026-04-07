export const IPC = {
  // Scryfall
  SCRYFALL_SEARCH:       'scryfall:search',       // query: string → IpcResult<ScryfallCard[]>
  SCRYFALL_NAMED:        'scryfall:named',        // name: string → IpcResult<ScryfallCard>
  SCRYFALL_FETCH_IMAGE:  'scryfall:fetch-image',  // imageUri: string, id: string, size: string → IpcResult<string> (cachedPath)

  // Local files
  FILE_OPEN_IMAGE:       'file:open-image',       // void → IpcResult<{filePath:string}>
  FILE_READ_DATA_URL:    'file:read-data-url',    // filePath: string → IpcResult<string> (base64 data URL)
  FILE_OPEN_PROJECT:     'file:open-project',     // void → IpcResult<PrintFile>
  FILE_SAVE_PROJECT:     'file:save-project',     // data: PrintFile → IpcResult
  FILE_SAVE_PROJECT_AS:  'file:save-project-as',  // data: PrintFile → IpcResult

  // Printers
  PRINTERS_LIST:         'printers:list',         // void → IpcResult<PrinterInfo[]>

  // Output
  PRINT_EXECUTE:         'print:execute',         // PrintJob → IpcResult
  PDF_EXPORT:            'pdf:export',            // PrintJob → IpcResult<{outputPath:string}>
  PDF_CHOOSE_PATH:       'pdf:choose-path',       // void → IpcResult<string>

  // Cache
  CACHE_CLEAR:           'cache:clear',           // void → IpcResult
  CACHE_GET_DEFAULT_BACK:'cache:get-default-back',// void → IpcResult<string> (path to bundled back image)

  // App defaults
  APP_DEFAULTS_LOAD:     'app-defaults:load',     // void → IpcResult<PrintSettings>
  APP_DEFAULTS_SAVE:     'app-defaults:save',     // PrintSettings → IpcResult

  // Presets
  PRESETS_LIST:          'presets:list',          // void → IpcResult<Preset[]>
  PRESETS_SAVE:          'presets:save',          // Preset → IpcResult
  PRESETS_DELETE:        'presets:delete',        // name: string → IpcResult

  // Custom card library
  LIBRARY_LIST:          'library:list',           // void → IpcResult<LibraryCard[]>
  LIBRARY_SAVE:          'library:save',           // LibraryCard → IpcResult
  LIBRARY_DELETE:        'library:delete',         // id: string → IpcResult

  // File pickers
  FILE_OPEN_EXE:         'file:open-exe',          // void → IpcResult<{filePath:string}>

  // Deck sites
  DECK_FETCH:            'deck:fetch',             // { site, id } → IpcResult<{ deckName: string, cards: { name: string, quantity: number, categories: string[] }[] }>

  // Calibration
  CALIBRATION_PRINT:     'calibration:print',      // { paperSize, orientation, ... } → IpcResult

  // Window controls
  WINDOW_MINIMIZE:       'window:minimize',
  WINDOW_MAXIMIZE:       'window:maximize',
  WINDOW_CLOSE:          'window:close',
  WINDOW_IS_MAXIMIZED:   'window:is-maximized',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
