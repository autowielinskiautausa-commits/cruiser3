# Auto-Wieliński — self-hosted static SPA

Ta paczka jest przeznaczona pod Twój własny hosting i Twoje własne Supabase/R2. Nie zawiera pliku `.env` z Lovable i nie używa Lovable Cloud jako źródła ogłoszeń.

## Cloudflare Pages

- Build command: `npm run build`
- Build output directory: `dist`
- Framework preset: Vite / None

W Cloudflare Pages ustaw zmienne build-time:

```env
VITE_SUPABASE_URL=https://TWOJ_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=TWOJ_ANON_LUB_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID=TWOJ_PROJECT_REF
```

Nie wrzucaj do repo pliku `.env` ze starego eksportu. Ten build ma korzystać z wartości ustawionych w Cloudflare Pages dla Twojego własnego Supabase.

## Edge Functions w Twoim Supabase

W katalogu `supabase/functions/` są funkcje `upload-to-r2`, `delete-from-r2`, `manage-users`.

Dla `upload-to-r2` i `delete-from-r2` ustaw sekrety R2: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`.
