# Auto-Wieliński — static SPA (Vite + React)

A static single-page app (no SSR). Front-end talks directly to Supabase, and
privileged work (image upload, user management) runs in Supabase Edge Functions.
Deployable to Cloudflare Pages or any static host.

## 1. Local setup

```bash
npm install
cp .env.example .env   # then fill in your Supabase values
npm run dev            # http://localhost:8080
npm run build          # outputs to dist/
```

## 2. Environment variables

Set these in `.env` for local dev and in your host's build settings:

- `VITE_SUPABASE_URL` — your project URL (`https://<ref>.supabase.co`)
- `VITE_SUPABASE_PUBLISHABLE_KEY` — anon / publishable key
- `VITE_SUPABASE_PROJECT_ID` — project ref (optional)

These are public client keys — safe to expose. Never put the service-role key here.

## 3. Database

Run `database-setup.sql` (provided separately) in your Supabase SQL Editor.
It creates the `profiles`, `user_roles`, `cars` tables, RLS policies, grants,
the `car-media` storage bucket, and the first-admin bootstrap trigger.
Then enable **Email** auth (Authentication → Providers) so the first admin can
register at `/admin`.

## 4. Edge Functions

Deploy both functions and set their secrets:

```bash
supabase functions deploy upload-to-r2
supabase functions deploy manage-users
```

`upload-to-r2` secrets: `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (plus auto-provided
`SUPABASE_URL`, `SUPABASE_ANON_KEY`).

`manage-users` uses auto-provided `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` — no extra secrets needed.

## 5. Deploy to Cloudflare Pages

- Build command: `npm run build`
- Build output directory: `dist`
- Add the `VITE_*` environment variables in the Pages project settings.

`public/_redirects` provides the SPA fallback so deep links / refreshes work.

## 6. First admin

Visit `/admin`. If no admin exists yet, a one-time registration option appears.
Create the first account — it automatically becomes the admin. The option then
disappears. Manage further accounts from the dashboard "Użytkownicy" tab.
