# Anota

A GoodNotes-style handwriting app for Android (installable PWA, works offline, no accounts, no servers).

**Features**
- **Tabs:** open several notebooks, whiteboards and PDFs at once and switch between them without losing your place. Tabs are restored when you reopen the app.
- **Folders:** nested folders on the home screen, with breadcrumbs, colours, "Move to…" and search across everything.
- **Notebooks:** ruled / grid / dot / blank paper in white, cream or dark; add, delete and jump between pages.
- **Whiteboard:** infinite canvas with pan and pinch-zoom.
- **PDF:** import any PDF and mark it up. The original is kept intact.
- **Pens:** ballpoint, fountain, brush, pencil, marker, plus a highlighter. Each remembers its own colour and size. Pressure-sensitive with a stylus; fingers get speed-based line weight.
- **Shapes:** pick line, arrow, rectangle, ellipse or triangle and a guide follows your pen. Or draw freehand and hold still to snap it to a perfect shape.
- **Objects:** text boxes, images (gallery or camera) and links. Select to move, resize, recolour, duplicate or delete.
- **Select:** lasso or tap to select, move, copy, recolour and delete.
- **Gestures (Settings → Gestures and pen):** two-finger tap undo, three-finger tap redo, stylus-only palm rejection.
- **S Pen:** hold the pen button to erase while writing; click it while hovering to switch the eraser on or off; the eraser end works too.
- **Split screen:** tap **Split** in the tab bar (or long-press a tab, or a note's ⋮ menu) to open a second note beside the first. Drag the divider to resize. Both sides can show the same note and stay in sync.
- **Jump buttons:** Insert → Jump. Pick a note and tap the spot you want; tapping the button later (finger, or the Move tool) flies you there, in the same note or another.
- **Comments:** Insert → Comment, then tap anywhere. Tap the marker to read, recolour or delete.
- **Rich text:** headings, bullets, bold, underline and strikethrough per line from the toolbar above the text box.
- **Resize anything:** select with the lasso and pull the corner handle (strokes, images, links, comments, groups).
- **Laser pointer** and a **quick brush size** button beside the colour dot.
- **Three looks** (Settings → Look): Glass, Clay and Classic (the original).
- **Pen tip alignment** and an S Pen button tester in Settings.
- Focus mode, undo / redo, autosave, export to PDF, share a PDF into the app from Android.

## Install on your phone / tablet
The app is plain static files. Host the folder anywhere with HTTPS (GitHub Pages, Netlify Drop, Cloudflare Pages), open the URL in Chrome on Android, then menu → **Install app**.

Quick local test on a computer: `python3 -m http.server 8000` and open http://localhost:8000.

## Turn it into a real APK (optional)
With Node + Android Studio installed:

```bash
npm i -D @capacitor/cli @capacitor/core @capacitor/android
npx cap init Anota com.example.inknote --web-dir .
npx cap add android
npx cap sync
npx cap open android   # then Build → Build APK
```

## Files
`index.html` UI shell · `styles.css` · `app.js` editor, ink engine, library · `db.js` IndexedDB storage · `pdfout.js` PDF export · `polyfills.js` · `sw.js` offline cache + share target · `vendor/` pdf.js (Apache-2.0)

## What's new in 3.1

- New app icon, and a "Pen only" finger-input label.
- Pen alignment: type your own X/Y pixel offset, use the practice pad, reset or test the S Pen button.
- S Pen button: pressing it mid-stroke now switches to the eraser, and the test dialog shows live button state.
- Laser pointer: size slider, smoother lines at speed, trail or dot style, presentation mode (menu > Present).
- Up to 3 screens: long-press a tab or a library card and drag it to the screen edge.
- Eraser modes: Stroke, Area (rubs out only the part you touch) and Highlighter-only.
- Scribble to erase, and "hold on a closed loop" to select what is inside (Settings).
- Shapes: diamond, pentagon, hexagon, star, optional fill; hold-to-perfect recognises 5-8 sided polygons.
- Digital ruler with degree readout and snapping (Insert > Ruler).
- Zoom window: write large, it lands small, and slides along as you write (Insert > Zoom).
- Elements: save ink/text for reuse, plus emoji stamps (Insert > Elements).
- Paper: Cornell and music staff, line spacing, custom line colour.
- Pages: duplicate, reorder, bookmark (with a bookmarks filter and page ribbon).
- Folder emoji icons, Quick note (+ menu), whiteboard minimap.

Not included yet: audio recording, text search inside notes, handwriting recognition and AI, cloud sync, collaboration.

## What's new in 3.6
- Dialogs (Settings included) keep their buttons pinned at the bottom; only the content scrolls.
- Settings > S Pen: Hold-still delay slider (0.3 to 2 s) for shape perfecting / loop select.
- Pages sheet > Select: pick pages and send them to a new whiteboard named after the note. Each page background is its own picture you can delete.
- Tabs: hold a tab and slide it along the bar to reorder (drag it down instead to open in split screen). The tab strip scrolls; Home, +, and Split stay fixed.

## What's new in 3.5
- Pen tip alignment: fixed the drawing surface being sized while the editor's opening animation was still shrinking it (about 1.5%), which made the ring and ink drift off the tip, more so towards the right. Pointer positions are now also mapped by the canvas's real on-screen size.
- Select tool panel redesigned (icon tiles, quick presets) and it stays open while you choose. Panels that rebuild themselves no longer close by accident.
- Brush size: a custom slot (star) next to the quick sizes, one per pen, saved with "Save size as custom".

## What's new in 3.4
- Selection: the rotate handle now sits beside the box (left when the box is near the right edge); the option bar can be dragged by its grip; Copy (editable, pastes into any note via Insert > Paste or Ctrl+V, and also lands on the system clipboard as a picture), Save image (PNG), Copy text, Duplicate.
- Select tool: tap it again to choose what it can pick up (ink, highlighter, shapes, text, images, other).
- Library: Trash (30 days, restores exactly as it was, nothing is copied so it costs no extra storage), tags, sorting (modified / created / name), pinning, duplicate, copy typed text.
- Links: type `[[Note title]]` in a text box (or Insert > Note link); tap it to open or create the note. Menu > Tags and links shows backlinks; the Graph chip in the library draws your notes as a network.
- Lists: bullets, numbered and to-do lists in text boxes (Enter continues the list); tap a checkbox to tick it.
- Audio: Insert > Audio records a voice note into the page with inline play, pause and seek.

## What's new in 3.3
- Look: stray "null" removed; two new themes, **Midnight** and **Paper**.
- Pen tip alignment: Settings > Pen tip alignment > Calibrate (9 taps), then nudge until the blue ring sits on the grey Android hover ring.
- Large files: PDFs are loaded lazily, rendered at low resolution first, with a memory budget, so big files no longer crash.
- Faster start (modulepreload, cache-first service worker) and faster PDF rendering.
- Toolbar: choose which tools show and their order, size (Auto / Normal / Compact; Auto is compact on small screens), and an optional **Hold and drag** mode (hold the toolbar, drag it anywhere, drop it at a side to stand it up).
- Import `.doc` and `.rtf` (text only; `.docx` keeps formatting).

## What's new in 3.2

- Icon zoomed in (no black borders on the tablet home screen).
- Pen offset and calibration removed; the pen writes exactly where it touches.
- Laser drawn as one smooth ribbon (no squares); dot-only mode removed.
- Presentation mode ends when you leave the note or the app.
- S Pen button: also handles the long-press/context-menu style of click, and works whatever pointer type the tablet reports. Settings > S Pen button test shows what your tablet sends.
- Rotate: handle above a selection (snaps to 15 degrees) plus a quick 90 degree Rotate button; works on images, text, video cards and ink.
- Word (.docx) import: converts to pages you can annotate like a PDF (text, lists, tables, pictures).
- Custom theme: pick a background and an accent colour (Settings > Look > Custom).
- Video links: Insert > Video (YouTube, Vimeo or a direct video file) plays on the page.
- Code clean-up and bug fixes.
