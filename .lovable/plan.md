# Re-deliver the static SPA export (with src/ and public/)

## What's actually going on
The current `/mnt/documents/spa-export.zip` **does** contain the complete app:
- 83 files under `src/` (routes, components, hooks, lib, integrations, assets, `main.tsx`, `router.tsx`, `styles.css`)
- `public/_redirects`
- `package.json`, `vite.config.ts`, `index.html`, `tsconfig.json`, `components.json`, `.env.example`

The catch: everything is nested inside a top-level `spa-export/` folder in the archive. After extraction it lands in `spa-export/spa-export/...`, which makes the `src/` folder look missing if you open the wrong level. This is a packaging issue, not missing code.

## What I'll do (in build mode)

1. **Refresh the export source** at `/mnt/documents/spa-export/` so it reflects all agreed changes:
   - Static Vite + React SPA (no SSR, no `dist/server`)
   - Client-side Supabase queries only (no `createServerFn`)
   - **No in-app user management** (Users tab + `users.functions.ts` excluded)
   - `public/_redirects` with `/* /index.html 200` for Cloudflare Pages SPA routing
   - `.env.example` with `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` placeholders

2. **Verify it builds** in a clean `/tmp` dir: `npm install` + `npm run build`, confirming output is a `dist/` with `index.html` + assets and **no `dist/server/`**.

3. **Repackage the ZIP correctly** so the archive root contains `src/`, `public/`, `package.json`, etc. directly (no double-nested `spa-export/spa-export/`). I'll create a fresh `spa-export-v2.zip` to avoid confusion with the old one.

4. **Confirm contents** by listing the ZIP (showing `src/...` and `public/...` entries) before handing it over.

## Deliverable
- `/mnt/documents/spa-export-v2.zip` — extracts straight to the project root with a visible `src/` and `public/` folder.

## Your steps after download
1. Extract the ZIP.
2. Copy `.env.example` to `.env` and fill in your Supabase URL + anon key.
3. `npm install` then `npm run build`.
4. Deploy to Cloudflare Pages: build command `npm run build`, output dir `dist`.

## Technical notes
- The export uses TanStack Router for client-side routing (no TanStack Start/SSR). If you'd prefer a full swap to React Router, that's a separate, larger change — tell me and I'll fold it in.
- This work happens entirely under `/mnt/documents/`; your live Lovable project stays untouched.