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

## What's new in 3.33
- ⋯ menu rows no longer squeeze together when the keyboard is up: the list scrolls, the quick row hides, and the menu moves up.
- The + tab button sits right after the last tab; tab width follows how many notes are open.
- The Split button is gone from the tab bar (drag a tab to the side to split; a Close button appears inside a split pane).

## What's new in 3.32
- ⋯ search is now universal: tools, insert items, settings pages, looks, flashcards, reminders, storage actions and every menu action. Ctrl+K opens it.
- Whiteboards: the quick row shows Focus instead of Bookmark, and the top bar shows Focus instead of Bookmark and Add page.
- Note bar: Undo/Redo on the left, name in the middle, actions on the right (Add page is now on by default).
- Tabs grow wider (and a bit larger) when only one or two notes are open.
- Keyboard: dialogs, menu and layers panel size to the visible area and scroll; the toolbar and + button hide while the keyboard is up.

## What's new in 3.31
- ⋯ menu always fits the screen (two columns, shrinks to the free height). The active tool square in the toolbar is centred.

## What's new in 3.30
- **⋯ menu:** now a small command palette. Search box and Settings at the top, five quick switches (Pin, Lock, Pen only, Record, Bookmark), then a plain list. Type to find any action.
- **Smoother with big pages:** while you pan, zoom or glide, a heavy page is moved as a picture and redrawn sharp when you stop. A page with 2,500 strokes went from about 150 ms per frame to about 17 ms in my test.
- **Smaller notes:** new handwriting drops points that do not change the line (0.2 px tolerance) and rounds the rest. Settings › Backup › Shrink handwriting does the same for old notes (notes that are open are skipped).
- Faster drawing path from 3.28 stays.

## What's new in 3.29
- **⋯ menu:** Settings is one tap; everything else is in folders (Note, Page, View). Each folder opens its own small window.
- **Note bar:** Settings › Note bar lets you turn actions on or off and reorder them (find, bookmark, record, layers, undo, redo, pages, share, timer, present, focus, pin, lock, add page, fit, ruler). Note name is centred on wide screens.
- **Centre tools:** View folder, or Settings › Toolbar, puts the toolbar back in the middle.
- **Reading dot on Home:** sits beside Settings and is solid.
- **Moving notes:** hold a note or folder and drop it on a folder, a breadcrumb or Home; or use Select, tick several, then Move or Trash. Move list shows folder colours and has New folder.
- **Folder colours:** ⋯ on a folder › Colour and icon. Breadcrumbs show the colour dot.

## What's new in 3.28
- **Home:** left rail (Home, Saved, Cards, Remind, Timer, Graph, Trash, Settings), compact cards with icon badges, smaller top row. The stray "null" text is gone.
- **Note bar:** find, bookmark page, record, layers, undo, redo, pages, share, more. The ⋯ menu is a tile grid with short labels.
- **Layers:** floating panel (stays open while you draw). Each layer can only select, erase or clear its own content.
- **Timer:** drag it anywhere; pause, continue and stop buttons on the timer itself.
- **Looks:** new Studio (default) and Graphite. Old Glass users are moved to Studio once; pick Glass again in Settings › Look.
- Pen: lower-latency canvas and immediate redraw while inking.

## What's new in 3.27

- **Bookmarks:** Home > Bookmarks lists pinned notes and bookmarked pages from every note. The note menu can pin a note and bookmark the current page.
- **Search in a folder:** inside a folder, searching looks in that folder only (chip on Home switches to everywhere).
- **Quiet reading badge:** a tiny dot instead of a text box (Settings > Search > Reading indicator).
- **Fingers still work in Pen only mode:** tap Add page, tap a picture to select it, drag a selection's handles.
- **Eyedropper** in every colour picker: pick a colour from ink, pictures or PDFs.
- **Ruler:** snaps every 15 degrees (30, 45, 60, 90) and shows the angle; each note keeps its own ruler.
- **Layers** (menu > Layers): show, hide, lock, reorder, rename, move a selection to a layer. Hidden layers are left out of exports.
- **Tape** (Highlighter > Style > Tape): an opaque strip that covers text; erase it to uncover.
- **Whiteboard card** (Insert > Whiteboard): a live preview of a board inside a notebook page; tap to open.
- **Extract part of page** (menu): drag a box over a PDF or page and send it to a new notebook, whiteboard or existing note.
- **Storage cleanup:** removes pictures, recordings and files no note uses (Settings > Backup, also weekly).
- Pen icon now shows in Settings > Toolbar.

## What's new in 3.26

- **Record while you write:** menu > Record while writing. Tap your handwriting later and the audio plays from that moment; words not yet spoken fade.
- **Lock with PIN or fingerprint:** lock a note from its menu. Locked notes hide their thumbnail and search text. Settings > Lock also has an app lock and a re-lock timer. It is a privacy gate, not encryption.
- **Handwriting to typed text:** select handwriting, tap To text, check it, then replace the ink or add the text below.
- **Flashcards:** select a question, tap Flashcard, select the answer, tap Finish card. Study from Home > Cards (Again / Hard / Good / Easy).
- **Reminders and a timer:** note menu > Remind me, and Home > Reminders / Timer. Notifications fire in the Android app even when it is closed.
- **Drive sync:** Settings > Backup > Sync. Pick one file in Google Drive; every device merges it, keeping the version of each note edited last.
- **Share to Anota (Android):** share pictures or PDFs from any app into a new or open note.
- **Home-screen widget (Android):** a random picture from notes you allowed (note menu > Show on home widget). Locked notes are never shown. Tap the picture to jump to it.
- New app icon.

## What's new in 3.25
- **PDF links and contents.** Tap a chapter on a PDF's contents page (or any link inside the PDF) and Anota jumps to that page. A quick tap with the pen or mouse works too and leaves no dot. Web links open in the browser. **Contents** in the ••• menu lists the PDF's own bookmarks.
- **Samsung Notes backgrounds.** Page colour, ruled and dotted paper, a picture used as the page background, and notes made on an imported PDF (ink lands on the right PDF page) now come across.
- **Reading chip.** Solid so it shows over notes. On the Home screen it sits at the bottom left while notes are being read; inside a note it stays under the note name.

## What's new in 3.24
- **Samsung Notes import.** Open a `.sdocx` file from Import (the same button as PDF). Pages come over in Samsung's order with pen strokes (pressure and colour kept) and pictures, as ink you can still edit. Not brought over yet: typed text, shapes, tables, page templates and the PDF behind a Samsung PDF note. The reader follows the community reverse-engineering of the format (twangodev/sdocx, GPL-3.0); it is read-only, Anota does not write `.sdocx`.

## What's new in 3.23
- **Faster drawing.** Pressure-sensitive pen strokes are drawn in far fewer steps: busy pages draw about 2.3 times faster.
- **Safer.** A content security policy blocks anything but Anota's own code; links only open as web, mail or phone links (also ones that arrive in an imported backup); embedded videos are sandboxed. The Android app turns off Android's automatic app backup so notes only leave the tablet where you send them.
- **Android app (3.21 to 3.22).** Google ML Kit reads handwriting; notes back up automatically to a folder you pick; the reading chip sits under the note name.

## What's new in 3.20
- **Single letters.** Letters written one by one (an A-to-Z row, i and j side by side, w and x...) are now read one at a time at the line's height, so case is kept and neighbours are no longer glued together. i and l are told apart by the dot.
- **Short searches** (one or two letters) only match a whole read word, so searching "a" no longer lights up every word containing an a.
- **Faster reading**: fewer re-reads of unsure lines, and reading starts 0.6 s after you stop writing (was 1.1 s).
- Test: letters a–z written separately in two print fonts: 23–26 of 26 found, with 1–4 stray highlights per alphabet (before: ~1 of 26 when letters were spaced out).

## What's new in 3.19
- **English-only reading.** Vietnamese reading is removed (the app is smaller and the reader faster). Search still ignores accents and capitals in typed text. Notes are re-read once after updating.
- **Sharper English matching.** Slanted writing is straightened before it is read; matching is stricter for short words so unrelated words stop matching (0 wrong matches in 8,800 test searches), while still tolerating look-alike letters.
- Test results (pen-stroke fonts, sizes 24–70, varied slant and pen width, 76 words and phrases): printed writing found 639 of 642 times; ornate cursive about 65%.

## What's new in 3.18
- **Zoom slider** on the right edge (plus/minus buttons too). Settings › Touch › Zoom slider turns it off.
- **The ••• menu** is two columns and sits right under the top bar, so Gestures and pen is always visible on a tablet.
- **Handwriting reading**: every line also gets a Vietnamese-only second reading; the most confident text is shown (accents kept when found) and the other readings stay searchable. Notes are re-read once after updating.

## What's new in 3.17
- **Find bar** now sits under the top bar on the right (no longer over the note name). Drag the grip on its left to move it anywhere; it remembers the spot. Double-tap the grip to put it back.
- **Handwriting reading rebuilt for accuracy.** Each line is read on its own (the engine is much better at one line than a whole page); accents, dots and i-dots stay with their line; unsure lines are read again at other sizes and every reading is searchable. Matching tolerates look-alike letters (rn/m, cl/d, i/l/1, o/0…) and words split in two by the reader.
- Tested with real pen-stroke fonts (print, script, Vietnamese with accents) at sizes 30–80: printed English 100%, Vietnamese 29/30, ornate cursive roughly 60–70%.

## What's new in 3.16
- **Share** button in the top bar (and in the menu): this page or the whole note, as a PDF or as pictures. Uses your device's share sheet, or downloads on a computer.
- The button beside the note name now opens a **side directory** of all folders and notes, with search, so you can jump between notes without going back to the home screen. (The Home tab is still there.)
- The ••• menu is grouped (Note, Page, View, Pen and touch) and "Rename" is gone: tap the title instead.

## What's new in 3.15
- **PDF find** now highlights the exact word (it used to box a whole line, which went wrong on two-column pages) and uses the page's crop box so boxes line up.
- **Whiteboard templates** are now movable, resizable objects placed in the middle of your view (including tables you build).
- **Handwriting search**: searching now saves what you just wrote first, whiteboard writing far apart is read in separate blocks at its own size, and unsure readings are retried at other sizes.
- The "Reading handwriting…" chip sits above the minimap.

## What's new in 3.14
- **Templates.** Nine built in (weekly, daily, monthly calendar, meeting notes, to-do, study notes, habit tracker, meal planner, board). Start a notebook or whiteboard from one, or use ••• › Add template page. Templates are a drawing layer under your ink, so they never get selected or erased by accident, stay sharp at any zoom and follow dark paper.
- **Your own templates.** "Build a table" (title, columns, rows, row names, tick boxes) and ••• › Save this page as a template (keeps ink, text and pictures). They live under Templates › Mine and are included in backups.
- **PDF.** Find in a PDF reads pages a few at a time while you search (no scan on open); Insert › Select text lets you drag over words, then Copy, Highlight or Find. Opening a long PDF is quicker: page sizes are measured in the background.
- **Handwriting reader.** Reads only the paragraphs you changed, starts sooner, shows a "Reading handwriting…" chip, and Settings › Search has "Run test" and "Read now" so you can see it work.

## What's new in 3.13
- **Backup and restore** (Settings > Backup): one `.anota` file with every note, folder, PDF, picture, recording, the Trash and your settings. Add-to-my-notes (newest edit wins) or Replace-everything restore. Share to Drive from the share sheet. Asks the browser to protect the data from automatic clean-up.
- **Search inside notes**: the library search now finds typed text, PDF text, handwriting and text inside pictures, with a snippet and the page number; tapping a result opens the note on the match.
- **Find in note** (menu, or Ctrl+F): highlights every match, next / previous, jumps to the spot. Ignores case and accents (`viet` finds `Việt`).
- **Handwriting and picture reading** (Settings > Search): on-device Tesseract engine, English, runs in the background only while you are not writing, off switch included. Engine files live in `vendor/ocr/` (Apache-2.0, see LICENSE).

## What's new in 3.12
- Settings redesigned: a side menu (Look, Toolbar, S Pen, Drawing, Touch, About) so each page is short; turns into a top strip on narrow screens.
- Hold-on-a-loop shapes are never filled now.
- Shape recognition prefers basic shapes: circle, oval, square, rectangle, rounded rectangle, triangle, diamond, pentagon, hexagon.
- Selections now have 8 handles: corners resize evenly, edge handles stretch ink, shapes and images in one direction (bottom-right corner and the rotate handle work as before).

## What's new in 3.11
- Pen-tip tool icon is now a small bare icon (no box). Still switchable in Settings > S Pen.

## What's new in 3.10
- H1/H2/H3 buttons are back in the text bar.
- Note graph is much larger (wide dialog, scaled layout).
- Hold still after drawing a wobbly line and it smooths into a curve (Settings > S Pen to turn off).
- Small icon of the current tool floats beside the S Pen tip while hovering (can be hidden).

## What's new in 3.9
- Cleaner Insert menu: grouped into Add / Lists and links / Tools.
- One Note link: pick a note, then optionally turn it into a jump to a chosen spot inside it. Jump targets also show up in the note graph.
- Settings > S Pen: hide the app's blue pen-tip ring.
- Removed the H1/H2/H3 buttons from the text bar.

## What's new in 3.8
- Home tab is now just the house icon.
- Fixed the one-frame black flash on PC: the canvas was being cleared by no-op resize events and painted blank before redraw. Resizes are now skipped when nothing changed and repaint immediately when they do.

## What's new in 3.7
- Note graph: drag the dots around (they stay where you drop them), tap one to open it, Tidy up resets the layout.
- Lists redesigned: nested bullets (filled, hollow, square), bold numbers, rounded to-do boxes that fill when ticked. Tab / Shift+Tab (or the indent buttons) nest items; Enter keeps the level, an empty item steps out. Insert has To-do, Bullets and Numbered.
- Fixed the tab bar on tablets (touch panning was blocked) and the selection bar jumping/flickering on PC.

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
