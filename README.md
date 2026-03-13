# FoodSnap

FoodSnap is a mobile-first PWA for ultra-fast manual food logging. It captures only what matters for later AI analysis:

- food name
- direct grams or pieces
- before/after weight difference
- optional note

There is no calorie database, no account system, and no backend. Everything is local and static-hosting friendly.

## Stack

- React
- TypeScript
- Vite
- localStorage for persistence
- `vite-plugin-pwa` for installability and offline asset caching

## Key behavior

- autocomplete suggestions from your own saved foods
- unknown foods accepted immediately and remembered automatically
- direct mode and before/after difference mode
- current session editing, duplication, and deletion
- one-tap plain-text export
- favorite foods and inline food renaming
- offline-capable PWA

## Project structure

```text
.
|-- .github/workflows/deploy.yml
|-- PLAN.md
|-- public/
|   |-- favicon.svg
|   |-- pwa-icon.svg
|   `-- pwa-maskable.svg
|-- src/
|   |-- components/
|   |   |-- EntryComposer.tsx
|   |   |-- ExportPanel.tsx
|   |   |-- FoodLibrary.tsx
|   |   `-- SessionList.tsx
|   |-- lib/
|   |   |-- export.ts
|   |   |-- search.ts
|   |   |-- storage.ts
|   |   |-- types.ts
|   |   `-- utils.ts
|   |-- styles/
|   |   `-- app.css
|   |-- App.tsx
|   |-- main.tsx
|   `-- vite-env.d.ts
|-- index.html
|-- package.json
|-- tsconfig.app.json
|-- tsconfig.json
|-- tsconfig.node.json
`-- vite.config.ts
```

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the dev server:

   ```bash
   npm run dev
   ```

3. Build the production app:

   ```bash
   npm run build
   ```

## Architecture decisions

- Single-screen workflow: the app keeps capture, review, and export on one page to reduce taps.
- `localStorage` instead of IndexedDB: the data volume is small and fast startup matters more than database complexity for the MVP.
- No client-side router: GitHub Pages deployment is simpler and more reliable when the app is a single static entry point.
- PWA via `vite-plugin-pwa`: keeps manifest and service worker generation aligned with the Vite base path.
- Learned food list: every save updates frequency and recency, which drives autocomplete and quick chips.

## GitHub Pages deployment

This repo includes [deploy.yml](/Users/markusschwarz/Programmierung/FoodSnap/.github/workflows/deploy.yml), which builds and publishes the app to GitHub Pages.

### What the workflow handles

- installs dependencies with `npm ci`
- computes the correct base path automatically
- uses `/` for `username.github.io`
- uses `/<repo>/` for project pages
- builds the static app and deploys `dist/`

### Enable deployment in GitHub

1. Push the repository to GitHub.
2. Open the repository settings.
3. Go to `Settings -> Pages`.
4. Under `Build and deployment`, choose `GitHub Actions` as the source.
5. Push to `main`, or run the workflow manually from the Actions tab.

## PWA notes

- The app is installable after the first successful load.
- Static assets are cached for offline reuse.
- Because the app has no backend, all saved data remains in the browser on that device.

## Future extension points

- aliases and synonym groups for foods
- multiple saved sessions or date-based history
- export/import backup files
- optional barcode or voice helpers kept separate from the core flow
