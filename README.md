# ascredit - CreditFlow Assistant

Web app frontend for Lao credit lead pre-screening and AI analysis.

## Files in this package

- `index.html` - Login / signup page
- `app.html` - Main app page
- `css/styles.css` - UI styles
- `js/config.js` - Supabase URL, anon key, and AI Worker URL
- `js/auth.js` - Authentication logic
- `js/app.js` - Lead analysis, scoring, save, dashboard, AI Analyze button
- `worker-ai-analyze.js` - Cloudflare Worker code for Claude API proxy

## Important

SQL is intentionally separated. Use the separate file:

- `supabase_schema.sql`

Only run it in Supabase if the table/policies are not already created.

## Deploy steps

1. Upload this package to your GitHub repo.
2. Deploy the repo with Cloudflare Pages.
3. For AI Analyze, create/update your Cloudflare Worker with `worker-ai-analyze.js`.
4. Add Worker secret: `ANTHROPIC_API_KEY`.
5. Make sure `js/config.js` has your correct `AI_WORKER_URL`.

## Supabase

The current app expects a table named `credit_leads` with RLS policies. If you already ran the SQL, do not run it again unless you need to reset/update the schema.
