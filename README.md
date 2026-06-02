# LaoCreditAssist MVP

Web app ຜູ້ຊ່ວຍວິເຄາະສິນເຊື່ອເບື້ອງຕົ້ນ.

Core idea: **Rule ຕັດສິນ, AI ອະທິບາຍ, ຄົນອະນຸມັດ**.

## Features

- Login / Signup with Supabase Auth
- Customer lead form
- Loan monthly payment calculation
- Cash available calculation
- Debt burden ratio
- 100-point scoring rule
- Risk level: Low / Medium / High / Very High
- Recommendation text
- AI prompt generator for case explanation
- Pipeline table
- Dashboard summary
- Row-level security: each user sees only own leads

## Files

```text
lao-credit-assist/
├── index.html
├── app.html
├── css/styles.css
├── js/config.js
├── js/auth.js
├── js/app.js
└── sql/supabase_schema.sql
```

## Setup Supabase

1. Create Supabase project.
2. Go to SQL Editor.
3. Copy and run `sql/supabase_schema.sql`.
4. Go to Project Settings > API.
5. This package already includes the provided Supabase Project URL and anon/public key in `js/config.js`.
6. Do not put `service_role` keys or AI API keys in frontend files.

## Run locally

Because this is a static app, use a small local server:

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Deploy to Cloudflare Pages

1. Push this folder to GitHub.
2. Cloudflare Pages > Create project.
3. Connect GitHub repository.
4. Framework preset: None.
5. Build command: leave empty.
6. Output directory: `/` or leave default depending on Cloudflare prompt.
7. Deploy.

## Deploy to Vercel

1. Push to GitHub.
2. Import project in Vercel.
3. Framework preset: Other.
4. Build command: leave empty.
5. Output directory: leave empty.
6. Deploy.

## Important credit policy note

This app is for pre-screening and analysis support only. It should not be used as the final approval engine. Final approval must follow your institution policy, compliance, and authorized credit committee/manager decision.


## After receiving this configured package

1. Run `sql/supabase_schema.sql` in Supabase SQL Editor first.
2. Upload the full folder to GitHub.
3. Deploy to Cloudflare Pages or Vercel.
4. Open the deployed site and create a test account.
5. Add 1 test customer lead and confirm it appears in the pipeline table.

## Security reminder

The Supabase anon/public key is expected to be used in frontend apps when Row Level Security is enabled. Never place `service_role`, Claude API, or OpenAI API keys in `js/config.js` or any browser-side file.
