# Steel Sales AI — Web

Frontend MVP built with Next.js, React, TypeScript, Tailwind CSS and Supabase SSR Auth.

## Local development

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Without Supabase environment variables the workspace runs in demo mode. With `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` configured, protected workspace routes require a valid Supabase Auth session.

## Security boundary

The browser must never read the private `staging` schema directly. Live commercial data will be exposed only through app-facing tables/views protected by RLS.
