# Auto-Wieliński — Vite + React SPA

Static single-page app converted from TanStack Start (SSR) to a plain
**Vite + React** SPA. Uses TanStack Router for client-side routing and the
Supabase JS client for all data, auth, and the admin panel — entirely in the
browser. No SSR, no server functions, no `dist/server`.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` (copy `.env.example`) with your own Supabase project:

   ```
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
   ```

3. Run locally:

   ```bash
   npm run dev
   ```

## Build

```bash
npm run build
```

Produces a `dist/` folder containing `index.html`, hashed assets, and
`_redirects`. There is **no** `dist/server` folder.

## Deploy to Cloudflare Pages

- Build command: `npm run build`
- Build output directory: `dist`
- `public/_redirects` (`/* /index.html 200`) is copied into `dist/` and
  enables SPA deep-link routing on Cloudflare Pages.
- Add the two `VITE_SUPABASE_*` variables as Pages environment variables.

## Notes / differences from the original

- **In-app user management was removed.** Creating/deleting other admin users
  required the Supabase service-role key, which must never ship in a browser
  SPA. Add new admins/editors directly in your Supabase dashboard (Auth +
  the `user_roles` table). The first signed-up user becomes admin via the
  `handle_new_user` trigger.
- All Supabase access uses the publishable/anon key and is protected by your
  RLS policies. Make sure RLS + the `has_role` function + `user_roles` table
  exist in your project (see your existing schema).
- Admin login lives at `/admin` (no public link), dashboard at `/dashboard`.
