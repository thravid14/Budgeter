# Budgeter — What's Built (plain-language log)

*Last updated: 20 July 2026 — fixing real-world usage reports as they come in.*

## Post-launch fixes (found during real usage)

- **Phone screen zooming in like a webpage.** The app was letting you pinch-zoom like a regular website, and tapping into any text box would auto-zoom in (a standard phone-browser behaviour when text is a bit too small). Fixed by turning off pinch-zoom (this app is meant to feel like an installed app, not a webpage) and making sure every text box is large enough that phones don't feel the need to zoom in.
- **Added ISA as an account type**, alongside Current account, Savings account, Credit card, and Cash — with its own icon, so an ISA/deposit account is visually distinct from an everyday savings account on the Accounts page. It counts as an asset on the Net Worth page, same as a normal savings account.
- **Bills now pay themselves automatically.** Instead of tapping "Mark paid" every month, once a bill's due date arrives, Budgeter creates the transaction and deducts it from the chosen account for you — dated on the actual due date, not whenever you happened to open the app. It shows up everywhere instantly (balance, Dashboard, Trends, Budgets), and you get a quick notification telling you what was paid. **Important limit to understand:** this only runs while the app is actually open — there's no way for a browser app to act while fully closed, so it catches up the next time you open it on or after the due date, not necessarily the exact moment it's due. "Undo" still works if something looks wrong, and you can still mark a bill paid early yourself if you've already paid it ahead of the due date.
- **Trends and Net Worth "By month" tables were unlabelled** — just rows of numbers with no indication of which figure meant what. Added proper column headers (Income/Expenses/Net, and Assets/Liabilities/Net worth).
- **Numbers now use thousands separators** (£12,345.67 instead of £12345.67) everywhere in the app, for readability.
- **Net Worth chart heading was cramped** ("Net worth over time last 6 months" squashed onto one line) — split into a proper two-line heading matching the rest of the app.
- **Net Worth showing the identical figure for every month** — this wasn't random; it's because the calculation doesn't yet know when each account was actually opened, so it currently projects today's balance backward across months that don't have their own transaction history. Rather than hide this, Budgeter now shows a plain-language note explaining why when it happens — it naturally goes away and shows real month-to-month change as more dated transactions build up.
- **New "+ Add starter categories" button** on the Categories page — adds a ready-made set of 18 common income/expense categories (Salary, Groceries, Rent/Mortgage, Utilities, Council Tax, Transport, and more — see the button for the full list) each with their own colour, in one click. Safe to click more than once — it skips anything you've already got, so it won't create duplicates. The original "+ Add category" button is untouched, for anything custom you still want to add yourself.
- **Clarified how Transfers work vs Categories** — a "Transfer to Revolut" entry had been set up as a recurring *Bill*, which isn't right: Bills always create an expense from one account and never credit the destination, so it was quietly understating that account's balance and overstating monthly spending — and would now have kept doing that automatically every month once bill auto-pay landed. The fix is to use the dedicated **"+ Transfer"** button for *any* movement between your own accounts (including into savings/ISA) instead — it correctly moves money between both accounts without touching income/expense totals. (The "Transfer to Revolut" bill entries themselves need deleting manually from your device — Budgeter can't reach your live data from here — see the Bills page, delete any entry with that name, then re-create it as a Standing Order below instead.)
- **New "Standing Orders" page** — the proper fix for the Revolut situation above. This is a recurring *transfer* between two of your own accounts (the UK banking term for it), e.g. moving £200 into savings on the 1st of every month. It works exactly like Bills — set it up once, it pays itself automatically from then on, shows Due/Overdue/Paid status, and Undo is there if something looks wrong — but instead of creating an expense, it moves money between both accounts correctly, so it never distorts your income/expense totals. Same open-app limitation as Bills: it catches up next time you open Budgeter on or after the due date, not necessarily the exact moment.

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
- Pays itself automatically once the due date arrives; tapped/paid by mistake? Hit Undo.

### Standing Orders
- Same idea as Bills, but for recurring transfers between two of your own accounts (e.g. £200 into savings on the 1st of every month) instead of an expense.
- Pays itself automatically, shows due/overdue/paid status, Undo included — never counted as income or spending.

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
