# LaoCreditAssist / ASCredit

Static web app for credit lead pre-screening with Supabase Auth/Data and Cloudflare Worker + Claude AI.

## Latest changes

- Lao font fixed with Noto Sans Lao.
- Status/dropdown display changed to Lao while keeping database values stable.
- Login/Create Account messages improved in Lao.
- Shows clear warning for wrong email/password.
- Password show/hide toggle added.
- Press Enter to login from the login screen.

## Deploy

1. Upload files to GitHub repo root.
2. Deploy via Cloudflare Pages.
3. Keep `worker-ai-analyze.js` as reference code for Cloudflare Worker.
4. Do not put Claude API key in GitHub. Store it as Worker secret `ANTHROPIC_API_KEY`.

## Important files

- `index.html` login page
- `app.html` main app
- `css/styles.css` font and UI
- `js/auth.js` login/signup logic
- `js/app.js` credit analysis and AI button
- `js/config.js` Supabase + AI Worker URL
- `worker-ai-analyze.js` Cloudflare Worker code


## AI Analyze Fix Notes
- `js/config.js` uses the real Worker URL: `https://ascredits.gogogo-thong.workers.dev`
- `worker-ai-analyze.js` uses `claude-haiku-4-5-20251001`.
- After replacing files in GitHub, redeploy Cloudflare Pages.
- After replacing Worker code, redeploy Cloudflare Worker.
