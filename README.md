# Spark

A Windows desktop application for laying out and printing Magic: The Gathering proxy cards.

## Overview

Spark takes a list of cards, arranges them onto print-ready pages according to your document settings, and sends the result to a printer or exports it as a PDF. Cards can be sourced from Scryfall, imported from a decklist or Archidekt, or supplied as local image files.

## Features

**Cards**
- Search Scryfall by name or with advanced filters (color, type, CMC, rarity, set, format, artist, oracle tags)
- Browse all available printings of a card before adding
- Import a full deck from an Archidekt URL with sideboard and basic land filter options
- Import cards from a plain-text decklist
- Upload custom card images from local files and save them to a reusable library
- Assign custom back images per card or globally
- Adjust quantities and reorder cards via drag and drop
- Save and reopen projects as `.spark` files

**Document**
- Paper size: Letter, A4, Legal, Tabloid, or custom dimensions
- Portrait and landscape orientation
- Configurable card size (default 63.5 × 88.9 mm), spacing, and grid layout
- Bleed: edge extension (recommended), black border, or scale
- Duplex (two-sided) printing with automatic back-page mirroring
- Configurable grid size (columns × rows per page)
- DPI: 150, 300, or 600
- Color or grayscale output
- Scale modes: actual size, fit to page, or fill page

**Output**
- Print via PDF viewer, SumatraPDF, or direct browser print
- Export to PDF
- Keyboard shortcuts: `Ctrl+S` Save · `Ctrl+O` Open · `Ctrl+P` Print

**App**
- Color themes based on MTG color identity
- Named presets with optional default on startup
- Registration offset calibration for duplex alignment
- First-run guided tour with persistent ? tooltips throughout
- Local Scryfall image cache

---

## Installation

**Requirements:** Windows 10 or later. No other software required.

1. Go to the [Releases](https://github.com/kingshmiley/spark/releases) page and download the latest `.exe` installer.
2. Run the installer and follow the on-screen prompts.
3. Launch Spark from the Start menu or desktop shortcut.

**Windows SmartScreen warning:** On first launch, Windows may display a warning saying "Windows protected your PC." This occurs because the application is not code-signed. Click **More info**, then **Run anyway** to proceed. The warning is a standard Windows behavior for unsigned software and does not indicate a problem with the application.

**Download safety:** Only download Spark from the [Releases](https://github.com/kingshmiley/spark/releases) page of this repository. Do not run installers obtained from any other source.

A guided tour will run automatically on first launch to walk through the main features.

---

## Building from Source

This section is intended for developers who want to run or modify the code directly.

**Requirements**
- [Node.js](https://nodejs.org/) v18 or later
- npm (included with Node.js)
- Git

**Steps**

1. Clone the repository:
   ```
   git clone https://github.com/kingshmiley/spark.git
   cd spark
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start in development mode:
   ```
   npm run dev
   ```

4. To build a Windows installer:
   ```
   npm run package
   ```

The application window will open automatically in development mode.

---

## Usage

### Adding Cards

**Scryfall Search**

Type a card name into the search field in the **Cards → Scryfall** tab. Results are returned as you type.

By default, clicking a result opens a printing picker where you can choose the specific edition to add. Switch to **Direct Add** mode in App Settings → Preferences to add cards immediately without this step.

Select **Advanced Search** for more specific queries. Available filters include color, color identity, type line, CMC, power, toughness, rarity, set, format, artist, and oracle tags.

**Import from Archidekt**

Open the **Decklist** tab and paste an Archidekt deck URL into the URL field at the top. Click **Import** to fetch the deck. Two options are available:

- **Include sideboard & maybeboard** — off by default; enable to include those categories
- **Ignore basic lands** — on by default; disable to include Plains, Island, Swamp, Mountain, Forest, and Wastes

**Decklist Text Import**

Paste a plain-text decklist into the text area in the **Decklist** tab. Each line should follow the format:

```
4x Lightning Bolt
1 Black Lotus
Counterspell
```

Cards are matched against Scryfall automatically. Unrecognized entries are listed after import.

**Custom Images**

Open the **Custom** tab to upload card images from local files. Each custom card can have a separate front and back image assigned. Check **Save to library** when adding a card to store it for easy reuse — saved cards appear below the upload form and can be renamed, re-added to the print list, or removed.

### Managing the Card List

The card list appears on the right side of the window, grouped by page. From here you can:

- Adjust quantities using the **+** and **−** controls
- **Drag rows** to reorder cards
- Click a card to change its printing or assign a custom back image
- Click **→** next to a group header to jump to that page in the preview
- Remove individual cards or clear the entire list

### Configuring the Document

Click the **Document** tab in the left panel to access all print settings. The preview updates immediately as settings are changed. Hover over any **?** button for an explanation of that setting.

### Previewing

The preview area shows an accurate representation of each page as it will print. Use the arrow controls or page dots to navigate between pages. The zoom controls adjust the preview size. The status bar shows the current grid dimensions, cards per page, and total page count.

When duplex is enabled, a spread toggle appears in the preview toolbar. Activating it shows the front and back of each sheet side by side.

### Printing and Exporting

- **Print** (`Ctrl+P`) — sends the document to your printer using the configured print method
- **Export PDF** — saves a print-ready PDF to a location you choose

Use **Save** (`Ctrl+S`) to save the current card list and settings as a `.spark` project file. Use **Open** (`Ctrl+O`) to reload a saved project.

**Print Methods**

Configured in App Settings → Printing:

- **Open in PDF viewer** (default) — generates a PDF and opens it in your default viewer; print from there using Ctrl+P
- **SumatraPDF** — prints directly via SumatraPDF command line; requires pointing Spark to the SumatraPDF executable
- **Direct (browser)** — sends directly through Electron's print engine

---

## Print Settings Reference

### Printer
Selects the target printer. Choose from any printer currently installed on your system, or leave as **System Default**. Use **Refresh list** if a printer was connected after launch.

### Copies
The number of times the full document is printed.

### Color Mode
**Color** prints all images as-is. **Grayscale** converts all images to grayscale before printing.

### Paper Size
Letter (8.5 × 11 in), A4 (210 × 297 mm), Legal (8.5 × 14 in), Tabloid (11 × 17 in), or **Custom** (enter width and height in mm).

### Orientation
**Portrait** or **Landscape**.

### DPI
Controls the resolution of rendered card images.
- **150 DPI** — draft quality, fastest
- **300 DPI** — standard print quality (recommended)
- **600 DPI** — high resolution; increases file size and processing time

### Duplex / Two-Sided
- **Off** — single-sided output
- **Long edge** — flips along the long edge; standard for portrait layouts
- **Short edge** — flips along the short edge; standard for landscape layouts

Back pages are automatically mirror-flipped so card fronts and backs align when the sheet is turned over.

### Scale
- **Actual size** — cards print at exact specified dimensions
- **Fit to page** — grid scales down to fit within the printable area
- **Fill page** — grid scales up to fill the page; edge content may be clipped

### Grid Size
Columns × rows of cards per page. The grid is centered on the page.

### Card Size
Printed dimensions in millimeters. Standard MTG card size is 63.5 × 88.9 mm.

### Card Spacing
Gap between adjacent cards in mm. Default is 2 mm. Set to 0 for edge-to-edge layout.

### Bleed
Extends each card image past its cut line to allow for imprecise trimming.

- **Amount** — how far the image extends past the card edge, in mm (default 1 mm)
- **Edge extension** (recommended) — smears the outermost row of pixels outward; applied at print/export time
- **Black border** — art is inset to its normal dimensions; bleed area is filled with black
- **Scale** — art is scaled up to fill the full slot including bleed area

### Default Card Back
Image used for any card without a custom back assigned. Defaults to the standard MTG card back. Replace with any local image using **Browse image**, or reset with **Reset to standard**.

---

## Registration Offset

If your printer's front and back pages are misaligned when printing duplex, use the registration offset to compensate.

1. Open **App Settings → Printing**
2. Select a paper size and click **Print calibration sheet**
3. Print the sheet duplex, then hold it up to a light source
4. The ghosted crosshair visible through the paper is the back page
5. Measure the distance between the two center dots in millimeters
6. Enter the values into the X and Y offset fields

**Direction guide:**
- Back dot to the right → enter negative X
- Back dot to the left → enter positive X
- Back dot below front dot → enter negative Y
- Back dot above front dot → enter positive Y

---

## App Settings

Open with the **⚙** icon in the top bar.

| Tab | Description |
|-----|-------------|
| Theme | Color themes based on MTG color identity |
| Presets | Save/load named settings snapshots; set a default to auto-load on startup |
| Preferences | Search mode, default zoom, splash screen, and the Replay guided tour button |
| Printing | Print method, SumatraPDF path, and registration offset |
| Cache | Clear locally cached Scryfall card images |
| About | Version info and this documentation |

---

## Presets

Presets store a complete snapshot of document settings under a named profile.

**To save:** Enter a name in the field at the bottom of the Document panel and click **Save**.

**To load or manage:** Open App Settings → **Presets**. Click **★** next to a preset to mark it as the default — it will load automatically on every fresh launch.

---

## Guided Tour

A step-by-step tour walks through the app on first launch. To replay it at any time, go to **App Settings → Preferences → Replay guided tour**.

Persistent **?** tooltips appear throughout the Document settings panel. Hover over them for a quick explanation of each setting.
