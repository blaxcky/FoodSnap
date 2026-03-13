# FoodSnap Implementation Plan

## Product Shape

FoodSnap will be a static, mobile-first React + TypeScript PWA focused on one job: capture food items and weights faster than a calorie app. The app will not calculate calories. It will store entries locally, optimize repeat logging, and export plain text for later use in ChatGPT or another AI tool.

## Architecture

### Stack

- Vite for fast static builds and GitHub Pages-friendly output
- React + TypeScript for the UI and typed domain logic
- `localStorage` for MVP persistence to avoid backend or IndexedDB complexity
- `vite-plugin-pwa` for manifest + service worker generation

### App Structure

- `src/App.tsx`
  - top-level app shell
  - persistent state orchestration
  - editing state and cross-section coordination
- `src/components/EntryComposer.tsx`
  - fast entry form
  - direct mode and difference mode
  - keyboard flow and autocomplete
- `src/components/SessionList.tsx`
  - current session items
  - edit, duplicate, delete actions
- `src/components/ExportPanel.tsx`
  - plain-text export in multiple formats
  - copy action
- `src/components/FoodLibrary.tsx`
  - remembered foods
  - favorite toggle and rename support
- `src/lib/*`
  - data types
  - storage helpers
  - search ranking
  - export formatting

## UX Plan

### Main Screen

Single-screen layout optimized for phone use:

1. Header with a short purpose statement and session count
2. Entry composer pinned near the top with:
   - food input
   - direct/difference mode toggle
   - amount inputs
   - optional note
   - save/update action
3. Quick chips for recent and favorite foods
4. Current session list
5. Export panel
6. Compact food memory management section

### Interaction Rules

- `Enter` in food field moves to the next numeric field
- `Enter` in the final numeric field saves the entry
- saving resets the form and focuses the food input again
- autocomplete suggestions appear while typing
- selecting a suggestion should require one tap and continue the flow
- editing an entry reuses the same composer instead of opening a modal

## Data Model

### Food Profile

- `id`
- `name`
- `normalizedName`
- `usageCount`
- `lastUsedAt`
- `createdAt`
- `isFavorite`
- `lastUnit`

### Session Entry

- `id`
- `foodId`
- `foodName`
- `mode` (`direct` or `difference`)
- `amount`
- `unit`
- `beforeWeight` (difference mode only)
- `afterWeight` (difference mode only)
- `note`
- `createdAt`
- `updatedAt`

### Persisted State

- `foods`
- `currentSession`
- `exportFormat`
- version number for future migration safety

## Core Logic

### Food Memory

- unknown foods are accepted immediately
- saving an entry upserts the food into the food memory
- food ranking for autocomplete combines:
  - exact match / starts-with / contains relevance
  - favorite boost
  - usage count
  - recent use recency

### Entry Modes

- direct mode:
  - amount + unit (`g` by default, `pcs` optional)
- difference mode:
  - before + after
  - consumed amount auto-calculated
  - invalid negative results blocked

### Export

- simple:
  - `36g Nutella`
  - `3 Eggs`
- raw difference:
  - `Nutella 812g -> 776g = 36g`

## PWA + Deployment

### PWA

- manifest with install metadata and icons
- service worker for offline static asset caching
- app should load from cache after initial visit

### GitHub Pages

- Vite `base` configured from `VITE_BASE_PATH`
- workflow computes `/` for user/org pages and `/<repo>/` for project pages
- no client-side router needed, which avoids SPA fallback issues on Pages

## Verification

Before closing the task:

1. install dependencies
2. run a production build
3. confirm output includes the generated PWA assets
4. confirm workflow and README match the actual build commands

## Extension Points

Likely future additions after MVP:

- aliases and synonym groups
- multiple saved sessions or meal buckets
- import/export backup file
- optional voice capture or barcode helper as separate features
