# InkNote

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
- Focus mode, undo / redo, autosave, export to PDF, share a PDF into the app from Android.

## Install on your phone / tablet
The app is plain static files. Host the folder anywhere with HTTPS (GitHub Pages, Netlify Drop, Cloudflare Pages), open the URL in Chrome on Android, then menu → **Install app**.

Quick local test on a computer: `python3 -m http.server 8000` and open http://localhost:8000.

## Turn it into a real APK (optional)
With Node + Android Studio installed:

```bash
npm i -D @capacitor/cli @capacitor/core @capacitor/android
npx cap init InkNote com.example.inknote --web-dir .
npx cap add android
npx cap sync
npx cap open android   # then Build → Build APK
```

## Files
`index.html` UI shell · `styles.css` · `app.js` editor, ink engine, library · `db.js` IndexedDB storage · `pdfout.js` PDF export · `polyfills.js` · `sw.js` offline cache + share target · `vendor/` pdf.js (Apache-2.0)
