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
