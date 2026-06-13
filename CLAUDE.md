# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (Vite, localhost:5173)
npm run build    # Production build → dist/
npm run preview  # Preview production build locally
```

No linting or test suite is configured.

## Architecture

This is a single-page React 18 + Vite app. The entire application lives in **`src/App.jsx`** — there are no separate component files, hooks, or utility modules.

### Backend: Supabase via raw REST

There is no Supabase JS client. All data fetching goes through a thin wrapper `sbFetch(path, opts)` that calls `SUPABASE_URL/rest/v1{path}` directly with the anon key. Credentials come from `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY`.

Two tables:
- `purchase_orders` — `id, po, date, machine, description, total`
- `line_items` — `id, po_id, part_no, name, qty, unit_cost, created_at`

On load, both tables are fetched in parallel and joined in-memory: line items are grouped by `po_id` into a map, then merged onto each order as `.items[]`.

Edit saves by PATCHing the PO row, then DELETEing all its line items and re-inserting them (no partial line item updates).

### Component structure (all in App.jsx)

- **`App`** — root; owns all state (`pos[]`, `tab`, `saving`, `toasts`, `jumpTo`), fetches data, handles save/delete
- **`TabPOLog`** — filterable list of PO cards; owns filter/expand/form-show state
- **`POForm`** — create/edit form with inline validation; used inside TabPOLog
- **`POCard`** — collapsible row showing PO summary + line items table
- **`TabSearch`** — full-text search across all POs/items client-side; `/` key shortcut to focus
- **`TabMonthly`** — aggregates spend by month with a bar chart (pure CSS) and summary table
- **`TabByMachine`** — per-machine spend cards + month×machine crosshatch grid
- **`Modal`** — delete confirmation overlay
- **`Toast`** — fixed-position notification stack (auto-dismissed after 3s)
- **`Highlight`** — inline component that wraps a search term match in `<mark>`

### Constants

`MACHINES` (array of 4 names) and `MACHINE_COLORS` (map to hex) are module-level constants. Adding a new machine requires updating both. All styling is inline — no CSS files or utility classes.

### Cross-tab navigation

`navigateToPO(id)` in `App` switches to the "log" tab and sets `jumpTo` state, which `TabPOLog` picks up via `useEffect` to auto-expand the matching `POCard`.

## Deployment

Deployed to Vercel. `vercel.json` sets `vite` as framework and rewrites all routes to `/` for SPA routing.
