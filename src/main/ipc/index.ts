import { registerScryfallHandlers } from './scryfall.handler'
import { registerFileHandlers } from './file.handler'
import { registerPrinterHandlers } from './printers.handler'
import { registerPrintHandlers } from './print.handler'
import { registerCacheHandlers } from './cache.handler'
import { registerAppSettingsHandlers } from './appSettings.handler'
import { registerLibraryHandlers } from './library.handler'
import { registerDecksiteHandlers } from './decksite.handler'
import { registerCalibrationHandlers } from './calibration.handler'

export function registerAllHandlers(): void {
  registerScryfallHandlers()
  registerFileHandlers()
  registerPrinterHandlers()
  registerPrintHandlers()
  registerCacheHandlers()
  registerAppSettingsHandlers()
  registerLibraryHandlers()
  registerDecksiteHandlers()
  registerCalibrationHandlers()
}
