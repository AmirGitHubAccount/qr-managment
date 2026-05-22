# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # installs deps and auto-copies sql-wasm.wasm to public/
npm start          # dev server at http://localhost:3000
npm run build      # production build → build/
npm test           # run tests (Jest via react-scripts)
```

If `public/sql-wasm.wasm` is missing after install, copy it manually:
```bash
cp node_modules/sql.js/dist/sql-wasm.wasm public/
```

## Architecture

Create React App (React 18, React Router 6 HashRouter). No UI component libraries — plain CSS files colocated with each component/page. Hebrew RTL throughout (`lang="he" dir="rtl"`).

**Routing** (`src/App.js`): `HashRouter` with a `ProtectedLayout` wrapper that redirects to `/login` when unauthenticated. Three protected routes: `/` (ProductList), `/products/:id` (ProductPage), `/settings` (Settings).

**Auth** (`src/context/AuthContext.js`): Firebase Auth state via `onAuthStateChanged`. `user === undefined` means still loading (shows spinner); `user === null` means unauthenticated.

**Firebase** (`src/firebase.js`): Target project `qr-managment` — handles Auth and Firestore (`products` collection). A second Firebase app (`acepk-source`) is initialized lazily inside `snapshotImport.js` to read the source inventory; it is read-only with no authentication.

**Data model** — `products/{id}` in Firestore:
- `id`, `name`, `code`, `tags` — from the source inventory snapshot
- `qrCode` — base64 PNG data URL (stored in Firestore, ~20 KB each)
- `qrUrl`, `qrGeneratedAt`, `importedAt` — metadata

**QR utilities** (`src/utils/qrUtils.js`): generates QR codes using the base URL from `REACT_APP_QR_BASE_URL` (falls back to the default configured URL). One size: 300px.

**Snapshot import pipeline** (`src/utils/snapshotImport.js`): runs entirely in the browser. Password is entered by the admin at import time — not stored anywhere in the code.
1. Fetch chunked binary blobs from Firestore (`Snapshots/main/chunks/chunk_0..N`)
2. Reassemble into a single `Uint8Array`
3. Decrypt: encrypted binary format v1 — magic header (3 B) + version (1 B) + salt (16 B) + AES-GCM nonce (12 B) + ciphertext+tag. PBKDF2-HMAC-SHA256, 600k iterations
4. GZip decompress with `pako.ungzip`
5. Parse SQLite with `sql.js` (WASM) — `SELECT id, code, tags FROM CommonItem`
6. Batch-write to Firestore in chunks of 400 (`writeBatch`)

The PBKDF2 step (~600k iterations) runs on the main thread and freezes the UI for 10–30 seconds.

**Print stickers** (`src/components/PrintStickers.js`): opens a new popup window, writes a full HTML document with an A4 CSS grid (3 columns), injects base64 QR images, and triggers `window.print()`. Falls back to generating QR on-the-fly if `qrCode` is not stored on the product.

## Deployment

GitLab Pages via `.gitlab-ci.yml` — push to `main` triggers build → `public/` artifact. `index.html` is copied to `404.html` to support HashRouter on direct URL loads.

The `homepage` field in `package.json` sets the asset path prefix (`/qr-managment/`). The directory name in the URL is intentionally `qr-managment` (one 'e') — this is the Firebase project ID and the GitLab repo name; do not "fix" the spelling.
