# Spark

A Windows desktop app for creating print-ready Magic: The Gathering proxy cards.

---

## Adding Cards

### Scryfall Search

Type a card name in the **Cards → Scryfall** tab. Results appear as you type.

Clicking a result opens a **printing picker** so you can choose the exact edition before adding. To skip this step and add cards instantly, switch to **Direct Add** mode in App Settings → Preferences.

Use **Advanced Search** to filter by color, color identity, type line, CMC, power, toughness, rarity, set, format, artist, or oracle tag.

### Import from Archidekt

Open the **Decklist** tab and paste an Archidekt deck URL into the URL field, then click **Import**. Options let you include or exclude the sideboard/maybeboard and ignore basic lands.

You can also paste a plain-text decklist directly:

```
4x Lightning Bolt
1 Black Lotus
Counterspell
```

Cards are matched against Scryfall automatically. Unrecognized names are reported after import.

### Custom Images

Open the **Custom** tab to upload card images from local files. Each card can have separate front and back images. Check **Save to library** to keep the card for future sessions — saved cards appear in the library below the upload form and can be renamed, re-added, or removed.

---

## Managing the Card List

The card list is on the right side of the window. Cards are grouped by page.

- Adjust quantities with **+** and **−**
- **Drag rows** to reorder
- Click a card to change its printing or assign a custom back image
- Click **→** next to a group header to jump to that page in the preview

---

## Document Settings

Click the **Document** tab in the left panel to access all print settings. The preview updates in real time. Hover over any **?** button for an explanation of that setting.

Key settings:

- **Paper size** — Letter, A4, Legal, Tabloid, or custom (mm)
- **Grid** — columns × rows of cards per page
- **DPI** — 150 (draft), 300 (standard), 600 (high quality)
- **Scale** — Actual size, Fit to page, or Fill page
- **Duplex** — Off, Long edge, or Short edge for two-sided printing
- **Bleed** — Extends images past the cut line; **Edge extension** (recommended) smears outermost pixels outward, **Black border** fills the bleed area with black, **Scale** enlarges the art to fill the slot
- **Card spacing** — Gap between cards in mm (2mm default)
- **Default card back** — Image used for cards without a custom back; defaults to the standard MTG card back

---

## Preview

The preview shows exactly how your cards will be laid out. Use the arrow controls or page dots to navigate. Zoom in with the **+/−** controls or click the fit button to auto-zoom.

When duplex is enabled, click the **spread icon** in the preview toolbar to view front and back sheets side by side.

---

## Printing and Exporting

- **Export PDF** — saves a print-ready PDF to a location you choose
- **Print** — sends the document to your printer

The print method (PDF viewer, SumatraPDF, or direct browser print) can be configured in **App Settings → Printing**.

**Keyboard shortcuts:** `Ctrl+S` Save · `Ctrl+O` Open · `Ctrl+P` Print

Project files use the `.spark` format and can be reopened later with **Open**.

---

## App Settings

Open with the **⚙** button in the top bar.

- **Theme** — Choose a color theme based on your MTG color identity
- **Presets** — Save and load named snapshots of your document settings; mark one as the default to auto-load on startup
- **Preferences** — Search mode, default zoom, splash screen, and confirmation behavior. Also contains the **Replay guided tour** button
- **Printing** — Choose between PDF viewer (default), SumatraPDF, or direct print. Configure **Registration Offset** to compensate for duplex misalignment; print a calibration sheet to measure your offset
- **Cache** — Clear the local Scryfall image cache

---

## Registration Offset

If your printer's front and back pages are slightly misaligned when printing duplex, use the registration offset to correct it.

1. Go to **App Settings → Printing** and click **Print calibration sheet**
2. Print the sheet duplex and hold it up to a light source
3. Measure the distance between the two center dots
4. Enter the values (in mm) into the X and Y offset fields

Positive X shifts the back page right; positive Y shifts it down.

---

## Presets

Save a complete snapshot of your document settings under a name. Load, delete, or set a default in **App Settings → Presets**. The default preset loads automatically on every fresh launch.
