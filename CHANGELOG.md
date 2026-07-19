# Budgeter — What's Built (plain-language log)

*Last updated: 19 July 2026 — fixing real-world usage reports as they come in.*

## Post-launch fixes (found during real usage)

- **Phone screen zooming in like a webpage.** The app was letting you pinch-zoom like a regular website, and tapping into any text box would auto-zoom in (a standard phone-browser behaviour when text is a bit too small). Fixed by turning off pinch-zoom (this app is meant to feel like an installed app, not a webpage) and making sure every text box is large enough that phones don't feel the need to zoom in.
- **Added ISA as an account type**, alongside Current account, Savings account, Credit card, and Cash — with its own icon, so an ISA/deposit account is visually distinct from an everyday savings account on the Accounts page. It counts as an asset on the Net Worth page, same as a normal savings account.
- **Bills now pay themselves automatically.** Instead of tapping "Mark paid" every month, once a bill's due date arrives, Budgeter creates the transaction and deducts it from the chosen account for you — dated on the actual due date, not whenever you happened to open the app. It shows up everywhere instantly (balance, Dashboard, Trends, Budgets), and you get a quick notification telling you what was paid. **Important limit to understand:** this only runs while the app is actually open — there's no way for a browser app to act while fully closed, so it catches up the next time you open it on or after the due date, not necessarily the exact moment it's due. "Undo" still works if something looks wrong, and you can still mark a bill paid early yourself if you've already paid it ahead of the due date.

*Update needs pushing to GitHub Desktop for these to reach your phone/desktop installs.*

This page lists everything Budgeter can do, and every real problem that was caught and fixed while building it — written so it makes sense whether you're technical or not. If you ever want the more technical version (file structure, how the code is organised), that lives in `PROJECT_NOTES.md` in the same folder — this page is the friendly one.

## What is Budgeter?

Budgeter is a personal money-tracking app, built just for you. It works offline, installs like a normal app on your phone and desktop, and can sync between your devices with encryption strong enough that nobody else — not the developer, not the cloud provider — can ever see your financial data.

## Everything it can do

### Tracking your money
- **Accounts** — add as many current accounts, savings accounts, credit cards, or cash accounts as you like. Each starts with a balance, and the app works out the running balance automatically from everything you add afterwards.
- **Transactions** — log income and expenses, tag each with a category, add a note if you want.
- **Categories** — make your own (Groceries, Salary, whatever suits you), each with its own colour used throughout the charts.
- **Transfers** — move money between your own accounts (e.g. Current → Savings) without it being wrongly counted as income or spending.

### Bills
- Set up a recurring bill once (rent, subscriptions, utilities) with an amount and due date.
- Each month it automatically shows as due, overdue, or paid — no need to re-enter it.
- One tap marks it paid (creates a real transaction); tapped by mistake? Hit Undo.

### Budgets
- Set a monthly spending limit for any category (e.g. £200 for Groceries).
- A progress bar fills up as you spend, turning red if you go over.

### Reports
- **Trends** — income vs expenses over the last 6 months, as a chart and a simple list.
- **Net Worth** — what you own minus what you owe, tracked over time, with credit card balances automatically counted as debts.
- **Dashboard** — your home screen: total balance (with a mini trend line), this month's income/expenses, upcoming bills, spending by category, and recent activity.

### Keeping your devices in sync
- Turn on Sync and set a passphrase — your data is scrambled on your device *before* it's ever sent anywhere. Enter the same passphrase on your other device to unlock it there.
- Nobody else can read it, ever — but that also means if you forget the passphrase, the synced copy can't be recovered. That trade-off was your deliberate choice, made with full knowledge of the risk.

### Backing up and moving your data
- Export all your transactions to a CSV file (a spreadsheet) any time — a good backup, or for opening in Excel/Google Sheets.
- Import a CSV back in later. The app checks every row (valid date, amount, matching account/category) before adding it, and tells you exactly which rows it skipped and why, rather than guessing.

### Making it your own
- **Light or dark mode**, switch any time.
- **English or Spanish**, switch any time — covers every screen, button, and message. (A few smaller corners — the text inside "add new item" pop-up forms, and confirmation pop-ups like "Delete this transaction?" — are still English-only for now, a deliberate choice to keep that piece of work manageable, not an oversight.)
- **Settings page** — choose which tabs show in your menu and in what order, choose which sections appear on your Dashboard, and pick your own accent/income/expense colours used throughout the app and its charts. One button resets everything back to default.
- **Share** — generate a short summary of your net worth, budgets, or transactions to share with someone, without handing over your entire transaction history.
- **Help page**, built into the app — explains what every tab and tricky field means, in plain English.

### If someone else wants to use it too
If another person opens the app on their *own* phone or computer, they automatically get a completely empty, separate copy — no setup needed, and their data never touches yours unless you both deliberately turn on Sync with the same passphrase.

## Real problems that were found and fixed

Nothing below made it to your live app unfixed — these were all caught and corrected during building and testing:

- **Mobile menu got stuck.** Once there were more tabs than fit on a phone screen, the extra ones became invisible with no way to reach them. Fixed by making the menu scroll sideways.
- **One button was covering another.** At certain screen widths, the light/dark mode switch sat right on top of the "Add transaction" button, making it hard to tap. Fixed by giving the page header more breathing room on smaller screens.
- **Delete buttons were too small on mobile.** Given that deleting is permanent, the tiny "✕" buttons next to each transaction were tightened up to be much easier to tap accurately on a touchscreen.
- **A tiny typo in a technical setting** (a backslash where a forward slash should've been, in the CSV file-picker's behind-the-scenes configuration) was caught and corrected before it could cause any issue.

Beyond fixing things, every feature above was actually tested in a real browser before being called "done" — including proving the encryption for Sync genuinely round-trips correctly, and checking the real, live website after it went up on GitHub Pages.

## Privacy, in plain terms

This was treated as a hard requirement the whole way through: your financial data lives only on your own devices. If you turn Sync on, it's scrambled with your own secret passphrase before it ever leaves your device — nobody else holds a key to it. The app's own *source code* is publicly visible on GitHub (that's simply how free GitHub Pages hosting works), but that's just the blueprint — what you actually enter into the app stays yours alone.

## Where things stand now

Everything originally discussed has been built, tested, and pushed live. This is a deliberate pause point: the plan is to actually use the app for a while and come back later with real feedback, bug reports, or new ideas once you've lived with it day to day.

**Known gaps — left as deliberate choices, not oversights:**
- A few pop-up forms and confirmation messages stay in English even with Spanish turned on (see "Making it your own" above).
- Importing a bank's own CSV export won't work directly — only re-importing a file this app exported itself.
- No option yet to customise the Dashboard's background colour — left out deliberately, since a badly-chosen background could make text hard to read.
- Bank statement reconciliation (matching your records against an actual bank statement) was never built — not requested.
