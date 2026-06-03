# ASCredit Modern UI

ຮຸ່ນນີ້ປັບ UI ໃຫ້ທັນສະໄໝ ໂທນສີສະບາຍຕາ ແລະແຍກເມນູໃຫ້ໃຊ້ງ່າຍຂຶ້ນ.

## ໂຄງສ້າງ

- `index.html` ໜ້າ Login / Create Account
- `app.html` ໜ້າ Web App ແບບ Sidebar Menu
- `css/styles.css` Modern UI + Noto Sans Lao
- `js/config.js` Supabase config
- `js/auth.js` Login / Signup logic
- `js/app.js` Scoring, Save Lead, Copy Prompt, Menu navigation

## ສິ່ງທີ່ປັບ

- Sidebar menu: Dashboard, ເພີ່ມ Case, ລາຍການລູກຄ້າ, Copy Prompt, ຜູ້ໃຊ້/ສິດ
- Dashboard card ແບບ compact
- Form ແຍກ 4 ສ່ວນ ບໍ່ລາກຍາວ
- Table ມີ search/filter
- AI Analyze ປິດໄວ້, ເຫຼືອ Copy Prompt ເພື່ອປະຫຍັດ token

## Deploy

1. Upload ໄຟລ໌ທັງໝົດໃນ zip ນີ້ໄປ GitHub repo `ascredit`
2. Commit changes
3. Cloudflare Pages ຈະ redeploy ໃໝ່
4. ເປີດ `https://ascredit.pages.dev`


## UI cleanup
- Removed admin/technical instructions from normal user screens.
- Removed AI/API wording from user-facing cards.
- Removed Users/Role placeholder menu from normal UI.


## Statement Analysis V1
Added:
- Statement Analysis page
- Upload Excel/CSV statement
- Column mapping: Date, Description, Debit, Credit, Balance
- Transaction summary engine
- Behavior score and red flags
- Copy Statement Prompt for GPT

Note:
- PDF direct extraction is not included in V1.
- For PDF statement 40-50 pages, convert/export to Excel/CSV first.
- PDF extractor can be added in V2 after the summary engine is stable.


## Statement Analysis V1.1
Improved:
- Added Header Row selector for files converted from PDF.
- Prevented wrong mapping where Date/Debit/Credit all point to the same metadata column.
- Removed PDF from V1 file picker to reduce confusion. PDF direct extraction will be V2.


## Statement Smart Import V2
Changed the UX from manual mapping to smart import:
- User uploads Excel/CSV only.
- System automatically checks whether it is a clean transaction table or PDF-converted Excel.
- System attempts auto-cleaning for PDF-converted Excel.
- Shows import type, transaction count, confidence score, and recommendation.
- Main flow is Upload -> Auto Clean -> Analyze.
- Manual header/column mapping remains available only under Advanced Mapping.

## ASCREDIT PDF Summary Reader V3

This version changes Statement Analysis into a PDF summary-only workflow.

### User flow
1. Upload PDF statement.
2. Cloudflare Worker sends PDF to Gemini.
3. Gemini returns strict JSON only: key statement values, risk flags, questions, confidence score.
4. Web app recalculates: Opening Balance + Total Deposits - Total Withdrawals = Closing Balance.
5. User confirms key totals.
6. Web app generates Credit Memo Prompt.

### Cloudflare Worker setup
Deploy `worker-gemini-pdf-summary.js` as a Cloudflare Worker.

Required Worker secret:
- `GEMINI_API_KEY`

Optional Worker variables:
- `GEMINI_MODEL` default: `gemini-3.5-flash`
- `MAX_OUTPUT_TOKENS` default: `6000`
- `MAX_PDF_BYTES` default: 18 MB
- `ALLOWED_ORIGIN` default: `*`

### Security
Never place GEMINI_API_KEY in frontend files, GitHub, app.js, config.js, or HTML.


## PDF Summary Reader V3.1

Updated UX:
- Removed Worker URL input from frontend.
- The app now uses the public Worker endpoint from `js/config.js`.
- Current configured endpoint:
  `https://ascredits.gogogo-thong.workers.dev/`

Security note:
- This URL is public and safe to store in frontend.
- `GEMINI_API_KEY` must stay only in Cloudflare Worker Secret.
- Never put `GEMINI_API_KEY` in GitHub, `config.js`, `app.js`, or HTML.

If the Worker URL changes, update:
- `js/config.js`
  `window.PDF_WORKER_URL = "...";`


## V3.2 Clean UI
- Removed Cloudflare Worker URL input from frontend.
- Worker URL is configured in code/config.
- User only uploads PDF and clicks AI Read PDF Summary.
- GEMINI_API_KEY remains only in Cloudflare Worker Secret.
