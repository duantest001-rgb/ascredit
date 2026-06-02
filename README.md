# LaoCreditAssist / ascredit

Static web app for credit lead pre-screening with Supabase Auth/Data.

## Current mode
AI Analyze is disabled to save Claude API tokens.
The app now works as:

- Input customer/loan data
- Calculate monthly payment, debt burden, score, and risk level
- Save lead to Supabase
- Generate and copy a prompt/case summary
- Paste the copied prompt into ChatGPT or your Custom GPT for long credit analysis

## Files
- `index.html` login/signup page
- `app.html` main app
- `css/styles.css` layout and Lao font
- `js/config.js` Supabase config
- `js/auth.js` login/signup logic
- `js/app.js` credit analysis, save lead, copy prompt

## Deploy
Upload/commit these files to GitHub and redeploy Cloudflare Pages.
No Cloudflare Worker is required for the disabled-AI version.

## Notes
Keep Supabase anon key in `js/config.js` only.
Do not put Claude API key in GitHub or frontend files.
