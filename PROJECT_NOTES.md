# Budgeter — Project Notes (handoff from chat, July 2026)

Personal budgeting/accounting app (originally named "Ledger", renamed to
"Budgeter" 2026-07-18; UK terminology throughout — e.g. "Current account"
not "Checking"). Offline-first, runs as a PWA (installable on phone +
desktop from one codebase). No coding experience — explain changes in
plain language as we go.

## Deployment
Live at **https://thravid14.github.io/Budgeter/** (confirmed working
2026-07-18 — all 10+1 nav tabs render, service worker registered, icons
load, EN/ES + light/dark toggles work).

**This folder is a git clone** (`C:\Users\thrav\OneDrive\Desktop\Budgeter`,
set up 2026-07-18, remote `https://github.com/thravid14/Budgeter.git`,
branch `main`), used with **GitHub Desktop** to commit/push instead of the
old manual web-upload flow. The *previous* dev copy at
`C:\Users\thrav\OneDrive\Desktop\Budgeting app\budget-app` (not
git-tracked) is what all the work up to and including the layout
customization pass was done in — verified byte-identical (modulo CRLF)
before switching over. That old folder may still exist; don't assume it's
current, this folder is now the one to edit.

Claude still cannot push directly (no GitHub credentials) — the user
commits/pushes themselves via GitHub Desktop now, instead of re-uploading
via the web UI. The web UI remains available as a fallback (e.g. from a
phone, since GitHub Desktop is desktop-only), and GitHub.com's own
in-browser file editor works too for a quick one-off edit from anywhere.
Per the user (2026-07-18): **work here first and batch-push updates at
the end** rather than after every change — don't suggest committing after
each small edit. After a push, remind the user to fully close and reopen
the app on each device (service worker update lifecycle) rather than
expecting it to update instantly.

## Stack & architecture
- Plain HTML/CSS/JavaScript — no build tools, no npm, no compiling.
- Dexie.js (via CDN script tag) as a friendly wrapper over IndexedDB — the
  browser's built-in offline database. This stays the only thing the app
  reads from day-to-day, even with sync (see below).
- manifest.json + sw.js make it installable and cacheable for offline use.
- No framework, no bundler, deliberately — keeps it beginner-readable.
  Even Firebase (for sync) is loaded via a `<script type="module">` CDN
  import rather than npm, to keep this true.

## File map
- `index.html` — page shell, nav, all view sections, modal container
- `css/styles.css` — all styling. Dark "ledger" theme (see Design section)
- `js/db.js` — ONLY file that touches the database. All CRUD + calculations
  (balances, month totals, category breakdown, bill status, budget
  progress) live here, plus `exportAllData`/`importAllData` used by sync.
- `js/render.js` — takes data from db.js and turns it into HTML. No event
  listeners here — purely draws.
- `js/app.js` — ONLY file with event listeners. Nav switching, modals,
  add/delete forms, wiring buttons to db.js functions.
- `js/sync.js` — ES module (loaded with `type="module"`). Firebase +
  encryption for cross-device sync. Exposes `window.setupSync`,
  `window.syncNow`, `window.forgetSyncOnThisDevice`. See "Sync" below.
- `js/i18n.js` — English/Spanish translation dictionary + `t()`/
  `applyStaticTranslations()`/`setLanguage()`. Loaded before render.js/
  app.js so both can call `t()`. See "What's built so far" item 13 for
  exactly what is/isn't translated.
- `js/settings.js` — nav tab + dashboard panel customization (show/hide,
  reorder). Holds `NAV_REGISTRY`/`DASHBOARD_REGISTRY` (the fixed list of
  what exists, with icons/labels) plus get/save/reset functions for the
  user's chosen order + hidden list (localStorage). `renderNavBar()`
  rebuilds the `<nav>` from this; `applyDashboardLayout()` reorders/hides
  the dashboard's panel wrapper `<div>`s. Loaded before render.js/app.js.
- `manifest.json` — PWA install metadata
- `sw.js` — service worker; caches app files for offline use. **Bump
  CACHE_NAME (currently `budgeter-v14`) any time app files change**, or
  returning users get a stale cached copy.
- `icons/` — generated app icons (192px, 512px)

## Data model
**accounts**: id, name, type, startingBalance — type is one of `current`
  (Current account), `savings` (Savings account), `credit` (Credit card),
  `cash` (Cash). Older data may still have `bank`/`card` from before the
  2026-07-18 UK terminology pass; `accountTypeLabel()` in render.js maps
  those to sensible labels for backward compatibility. Credit card debt is
  just a negative `startingBalance`/running balance — no special handling
  needed (net worth/liabilities tracking is still a separate future item).
**categories**: id, name, kind (income/expense), color
**transactions**: id, date (YYYY-MM-DD string), amount (always positive),
  kind (income/expense), accountId, categoryId, note, billId (nullable —
  links a transaction to the bill that generated it)
**bills**: id, name, amount, categoryId, accountId, dueDay (1-31)
  — a bill is a recurring template. "Paid" is never stored as a flag;
  paid/unpaid status is derived by checking whether a transaction with
  that billId exists in the current month (see `getBillsWithStatus` in db.js).
**transfers**: id, date, amount, fromAccountId, toAccountId, note — moves
  money between two of the user's own accounts. Kept separate from
  transactions (rather than a third `kind`) because it touches two accounts
  at once. Not counted as income/expense; `getAccountBalance` adds/subtracts
  it directly. Shown merged into the ledger lists (dashboard recent +
  Transactions page) via `combineLedgerEntries` in render.js.
**budgets**: id, categoryId, amount — a recurring monthly £ limit per
  (expense) category, one row per category like bills are one row per bill.
  Progress against it is computed fresh each month by `getBudgetsWithProgress`,
  comparing to that month's actual category spend (reuses
  `getCategoryBreakdown`). One budget per category enforced in the UI, not
  the schema.

No new tables were needed for Trends or Net worth (2026-07-18) — both are
computed on the fly from existing transactions/transfers/accounts:
- `getMonthlyTrends(numMonths)` — income/expense/net per month, oldest first.
- `getAccountBalance(accountId, asOfDateStr)` — the existing balance
  function gained an optional as-of-date filter (backward compatible,
  omit it for "now"), used to reconstruct historical balances.
- `getNetWorthAsOf(dateStr)` / `getNetWorthTrend(numMonths)` — splits
  accounts into assets (everything) vs liabilities (`type === 'credit'`,
  or legacy `'card'`) as of a given date, and replays that over the last
  N month-ends for the trend view.

## Sync (built 2026-07-18) — zero-knowledge, encrypted, Firebase-backed
User's requirement: sync between phone/desktop, but **no third party may
ever be able to read the data**. Design:
- User picks a passphrase once per device (Sync nav tab). It is stored
  locally (localStorage) so they don't retype it each visit, and **never
  sent anywhere**.
- The passphrase is run through PBKDF2 (Web Crypto API, 250,000
  iterations, SHA-256) twice with different salts to derive two
  independent values: an AES-256-GCM encryption key, and a "syncId" hex
  string used as the Firestore document address. Same passphrase on two
  devices → same syncId → they find each other's data.
- The whole local database is exported (`exportAllData` in db.js),
  JSON-stringified, AES-GCM encrypted client-side, and only *then*
  uploaded to Firestore at `syncData/{syncId}`. Firebase only ever stores
  ciphertext — it cannot read balances, names, or amounts.
- Sync model is **whole-database snapshot, "newest wins"** — not
  per-record merging. `syncNow()` compares the cloud doc's `updatedAt`
  against this device's last-known-synced time: pulls if the cloud is
  newer, otherwise pushes. This is a deliberate v1 simplification: if a
  user edits offline on both devices before either syncs, the later sync
  wins and the other device's unsynced edits in that window are
  overwritten. Acceptable since this is a single-person app used on one
  device at a time. Flagged to the user as a known limitation, not silently.
- **No password recovery, by design** — since the passphrase never leaves
  the device, nobody (not the developer, not Firebase/Google) can recover
  synced data if it's forgotten. User explicitly accepted this trade-off
  on 2026-07-18. Local device data is unaffected either way.
- Firebase project: `budgeter-sync` (user's own free-tier Firebase
  project). Auth is Anonymous (just gates the Firestore rules against
  drive-by scripts — it doesn't identify the user personally). Firestore
  rules should be:
  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /syncData/{docId} {
        allow read, write: if request.auth != null;
      }
    }
  }
  ```
- Firebase JS SDK is loaded from `https://www.gstatic.com/firebasejs/12.16.0/...`
  as ES module imports directly in `js/sync.js` — **not** via `npm install
  firebase` (this project has no npm/build step; bump the version number
  in the import URLs if the SDK needs updating later).

## Design (visual direction — polish pass still pending, deliberately deferred)
"Midnight ledger" theme — deep forest-ink background, warm gold accent,
dotted leader lines between transaction name and amount (like an old
invoice). Tokens are CSS variables at the top of styles.css:
- Newsreader (serif, headings) / Inter (sans, body) / IBM Plex Mono (numbers)
- --bg #0F1B14, --gold #C9A227, --income #5FB88A, --expense #C1543C
User has explicitly said: **UI/UX professional polish pass is saved for
the end**, after more functionality is built. Don't polish speculatively.

## What's built so far
1. Core CRUD: accounts, categories, transactions (add/list/delete)
2. Dashboard: total balance, month income/expense, category breakdown bars,
   recent transactions, upcoming bills panel
3. Transactions page with filters (account/category/month)
4. Bills: recurring expenses with due-day tracking, live status
   (Paid / Due in Nd / Overdue), "Mark paid" (creates linked transaction),
   "Undo" (removes it)
5. Responsive: sidebar nav on desktop, bottom tab bar on mobile (CSS
   breakpoint at 720px)
6. Transfers between accounts: "+ Transfer" button on Transactions page,
   shown merged into ledger lists in a neutral colour, doesn't affect
   income/expense totals or total balance
7. Real monthly budgets: "Budgets" nav page, £ limit per expense category
   with a progress bar (reuses the dashboard's breakdown bar style), turns
   red when over budget
8. UK terminology pass: app renamed Ledger → Budgeter; account types are
   Current account / Savings account / Credit card / Cash; "Colour" not
   "Color" in UI text (internal DB name and CSS class names left as-is —
   cosmetic only, not user-facing, renaming risked orphaning local data)
9. Encrypted cross-device sync (see "Sync" section above)
10. Mobile nav fix (2026-07-18): bottom tab bar now scrolls horizontally
    instead of squeezing tabs off-screen — `.nav-btn` had no `min-width`,
    so once there were more tabs than fit, the extras were invisible and
    unreachable with no scroll. Fixed with `overflow-x: auto` + fixed-size
    (not shrinking) tabs.
11. Trends page: income vs expense bar chart + monthly list, last 6 months
    (CSS-only chart, no charting library)
12. Net worth page: Assets/Liabilities/Net worth summary + 6-month trend,
    reconstructed retroactively from transaction/transfer history
13. Polish pass (started 2026-07-18, in progress — user is choosing/
    customizing which items, going one at a time):
    - UK date formatting everywhere (`formatUKDate`/`formatUKDateTime` in
      render.js — DD/MM/YY, not ISO or locale-default)
    - Light/dark theme toggle (top-right button, persisted in
      localStorage as `budgeter_theme`, applied via `data-theme` attr
      before CSS loads to avoid a flash)
    - App icons regenerated to match the Budgeter brand mark (generated
      via an offscreen canvas + Web Crypto-adjacent PNG export, not hand
      drawn — see git history if they need regenerating again)
    - Account-type icons on the Accounts page (`accountTypeIcon()` in
      render.js)
    - Trends/Net worth charts: gridlines, on-bar value labels (net worth
      chart only — two-bar trends chart left plain to avoid label
      clutter), grow-in entrance animation
    - Dashboard: small net-worth sparkline under the balance figure,
      tightened panel/card spacing
    - Toast/snackbar confirmations on every save/delete/pay-bill action
      (`showToast()` in app.js)
    - Modal keyboard handling: Esc closes, Tab is trapped inside while
      open, focus returns to the triggering element after close
    - Modal close animation (previously vanished instantly; now fades/
      scales out to match the open animation)
    - Mobile fix: the fixed theme-toggle button was overlapping the
      Transactions page's "+ Add transaction" button at certain widths
      (720px-and-under, wider than a phone) — fixed with reserved
      `.view-header` padding on mobile; also enlarged the small delete
      "✕" buttons to 34px on mobile for easier tapping
    - CSV export/import for transactions (`btn-export-csv`/
      `btn-import-csv` on the Transactions page; `transactionsToCSV`/
      `parseTransactionsCSV`/`parseCSV`/`csvEscape` in render.js).
      Scope is **transactions only**, not a full bank-statement importer:
      columns are Date, Type, Amount, Account, Category, Note; import
      matches Account/Category **by name** against existing ones and
      **skips (does not auto-create)** rows referencing an unknown
      account/category, reporting why each skipped row was rejected.
    - Help section: new "Help" nav tab explaining what each of the other
      9 tabs does, plus a "Field guide" (`<dl>`) for less-obvious fields
      (Starting balance, Account type, Due day, Category colour, Sync
      passphrase). Deliberately a dedicated page rather than per-field
      tooltips scattered across 7 modals — much lower risk, one place to
      maintain.
    - Share options on Net worth/Budgets/Transactions: an icon button
      generates a **rollup summary**, not a line-by-line dump — especially
      for Transactions, where sharing every individual entry by default
      would be an easy way to overshare in a privacy-focused app. Full
      detail is still available via CSV export, which requires a
      deliberate separate action. Uses `navigator.share()` where available
      (mostly mobile), falls back to clipboard copy, then to `alert()` as
      a last resort. Builder functions: `buildNetWorthShareText`/
      `buildBudgetsShareText`/`buildTransactionsShareText` in render.js;
      `shareOrCopy()` in app.js.
    - Spanish language pack (i18n), scope agreed with the user in advance
      (not full coverage — see below): new `js/i18n.js`, loaded before
      render.js/app.js. Nested `translations.en`/`translations.es`
      dictionary, `t(path, params)` lookup with `{param}` interpolation
      and English fallback for missing keys, `applyStaticTranslations()`
      walks `[data-i18n]`/`[data-i18n-placeholder]` elements. Language
      toggle button (top-left, next to the theme toggle), persisted as
      `budgeter_lang` in localStorage, applied via `document.documentElement.lang`
      too. `monthLabel`/`monthShortLabel` in render.js pass `'es-ES'` to
      `toLocaleDateString` when Spanish is active, so month names (e.g.
      "julio de 2026") localize automatically.
      **Covered**: nav, all page headers/subtitles, buttons, empty states,
      bill status labels, budget progress text, all 16 toast messages, the
      6 "Add X" modal *titles*, and the entire Help page.
      **Not covered (explicit, user-agreed scope boundary)**: the 6 "Add X"
      modal forms' field labels/placeholders (Name, Amount, Category, Date,
      Colour, etc.), and `alert()`/`confirm()` dialog text. Both stay in
      English regardless of selected language — a clearly bounded follow-up
      if wanted later, not an oversight.
      User-entered data (category/account names, transaction notes) is
      never auto-translated — only the app's own UI chrome is.
      CSV export/import column headers also stay in English regardless of
      language, for file consistency (the importer doesn't inspect header
      text anyway, so this is cosmetic-only, not a functional constraint).
14. Layout customization (2026-07-18), a new "Settings" nav tab (pinned
    last, always visible — Dashboard is pinned first, always visible —
    so the user can never hide their way into a dead end):
    - Show/hide + reorder any of the other 9 nav tabs, via checkboxes and
      up/down move buttons (not drag-and-drop — deliberately simpler and
      more reliable, especially on mobile touch)
    - Show/hide + reorder the 4 dashboard blocks (summary cards, upcoming
      bills, spending by category, recent transactions)
    - Persisted in localStorage (`budgeter_nav_settings` /
      `budgeter_dashboard_settings`), a "Reset to defaults" button clears
      both. Nav is now rendered entirely by JS (`renderNavBar()` in
      settings.js) from a registry rather than static HTML, so nav clicks
      are handled via event delegation on `#nav` (app.js) instead of
      per-button listeners bound at load. Fully translated (EN/ES) like
      the rest of the polish pass.
15. Theme colour customization (2026-07-18): 3 native colour pickers
    (Accent/Income/Expense) on the Settings page, under the same panel
    group as the layout settings. Overrides the `--gold`/`--income`/
    `--expense` CSS variables via inline style on `<html>` (which beats
    the stylesheet regardless of light/dark mode — one custom set applies
    to both, not a separate override per theme), persisted in localStorage
    (`budgeter_custom_colors`), cleared by the same "Reset to defaults"
    button. Charts/bars automatically pick this up since they already
    read these same variables — no separate "chart colour" system needed.
    **Deliberately excludes a customizable Background colour** — since
    the light/dark themes each have their own fixed, already-tuned text
    colours, letting the user freely pick a background risks bad contrast
    (e.g. light text becoming unreadable on a newly-light background) that
    would need real auto-contrast logic to handle safely; not worth the
    complexity for a personal app. Per-category colours (chosen when
    creating a category) are separate and untouched by this — confirmed
    in testing that a custom accent colour doesn't affect a category's own
    chosen colour in the breakdown chart.

## Researched context (Quicken/Simplifi, July 2026)
What separates "budgeting" from real "accounting" in existing apps:
transfers between accounts (built), net worth incl. liabilities (built),
recurring transactions (built — see Bills), reconciliation against bank
statements, real monthly budgets with progress (built), trend reports over
time (built), CSV import/export (built, transactions only).

## Roadmap — discussed, not yet built (reprioritized 2026-07-18)
1. Bank statement reconciliation — not requested/built; CSV import is
   deliberately narrower (round-trips the app's own export format only)
2. Follow-up i18n coverage (modal field labels, alert/confirm text) — only
   if the user asks; explicitly out of scope for the pass done 2026-07-18

The full user-chosen polish pass (see item 13 above) plus layout
customization (item 14) are complete as of 2026-07-18: UK dates,
light/dark theme, regenerated icons, account-type icons, chart polish,
dashboard sparkline/spacing, toast confirmations, modal keyboard handling
+ close animation, mobile touch-target/overlap fixes, CSV export/import,
Help section, Share options, Spanish i18n, and nav/dashboard
show-hide-reorder — all done one item at a time and verified in-browser
per the user's explicit preference for completable, individually-verified
steps over one large batch.

Done: transfers between accounts, real monthly budgets, theme colour
customization, UK terminology
pass, encrypted sync, mobile nav fix, trends, net worth, GitHub Pages
hosting, CSV export/import for transactions, full polish pass incl.
Spanish i18n (see "What's built so far" above and "Deployment" at the top).

## User context
- No prior coding experience — explain plainly, avoid jargon without
  unpacking it, don't assume familiarity with dev tools/terminal
- UK English/terminology throughout — watch for Americanisms
- Cross-device sync with zero third-party data access was a hard
  requirement, not a nice-to-have — keep this in mind for any future sync
  changes (e.g. don't introduce a plaintext-on-server fallback casually)
- Currently testing by opening index.html directly (file://) — no local
  server in use. Python wasn't available on their desktop; VS Code +
  Live Server extension was suggested as the no-terminal alternative if
  ever needed, but not currently set up
- Prefers building functionality before visual polish
- Initially deployed via GitHub's web upload UI only, briefly called
  GitHub Desktop "invasive" — but asked to set it up the same day once
  the actual data-access facts were explained (it only touches the repo
  folder you open in it, same GitHub servers either way, no third party
  beyond what the web UI already uses). Now using GitHub Desktop, cloned
  into `C:\Users\thrav\OneDrive\Desktop\Budgeter` (2026-07-18) — see
  "Deployment" above
- Wants a second person to be able to use the app on their own separate
  device with a blank slate, isolated from the user's data — already
  works with zero extra setup (each device's IndexedDB is independently
  scoped), just needs different Sync passphrases if either uses Sync at all
- Values individually-verified, one-task-at-a-time delivery over large
  batched changes (explicitly requested 2026-07-18)
