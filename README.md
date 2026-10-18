# Anota

A GoodNotes-style handwriting app for Android (installable PWA, works offline, no accounts, no servers).

**Features**
- Notebooks: ruled / grid / dot / blank paper in white, cream or dark; multiple pages, add / delete / jump via the page sheet
- Infinite whiteboard with pan and pinch-zoom
- Import any PDF and annotate it (highlight, write, draw); original PDF is kept intact
- Pen (pressure-sensitive with a stylus), highlighter, stroke eraser, lasso select / move / duplicate / delete, shapes (line, arrow, rectangle, ellipse)
- Stylus-only mode (palm rejection) turns on automatically when a stylus is detected
- Undo / redo, autosave to on-device storage, export to PDF (uses the Android share sheet)
- Share a PDF from any Android app to Anota (once installed)

## Install on your phone / tablet
The app is plain static files. Host the folder anywhere with HTTPS (GitHub Pages, Netlify Drop, Cloudflare Pages), open the URL in Chrome on Android, then menu → **Install app**.

Quick local test on a computer: `python3 -m http.server 8000` and open http://localhost:8000.

## Turn it into a real APK (optional)
With Node + Android Studio installed:

```bash
npm i -D @capacitor/cli @capacitor/core @capacitor/android
npx cap init Anota com.example.Anota --web-dir .
npx cap add android
npx cap sync
npx cap open android   # then Build → Build APK
```

## Files
`index.html` UI shell · `styles.css` · `app.js` editor, ink engine, library · `db.js` IndexedDB storage · `pdfout.js` PDF export · `polyfills.js` · `sw.js` offline cache + share target · `vendor/` pdf.js (Apache-2.0)
