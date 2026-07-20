/*
  db.js
  ------
  This file is the ONLY place that talks to the database.
  Everything else in the app calls these functions instead of touching
  the database directly.

  We use Dexie.js, a friendly wrapper around IndexedDB (the database
  built into every browser, working fully offline).
*/

// Internal database name only — kept as 'LedgerDB' (the app's old name) so
// existing local data isn't orphaned under a new, empty database.
const db = new Dexie('LedgerDB');

// v1: original schema
db.version(1).stores({
  accounts: '++id, name',
  categories: '++id, name, kind',
  transactions: '++id, date, kind, accountId, categoryId'
});

// v2: adds Bills (recurring expenses) + links transactions to the bill that generated them
db.version(2).stores({
  accounts: '++id, name',
  categories: '++id, name, kind',
  transactions: '++id, date, kind, accountId, categoryId, billId',
  bills: '++id, name, categoryId, accountId'
});

// v3: adds Transfers (moving money between your own accounts — not income or
// expense) and Budgets (a recurring monthly £ limit per category, like Bills
// is a recurring template rather than a per-month row)
db.version(3).stores({
  accounts: '++id, name',
  categories: '++id, name, kind',
  transactions: '++id, date, kind, accountId, categoryId, billId',
  bills: '++id, name, categoryId, accountId',
  transfers: '++id, date, fromAccountId, toAccountId',
  budgets: '++id, categoryId'
});

// v4: adds Standing Orders — a recurring TRANSFER between your own accounts
// (e.g. £200 to Savings on the 1st), the UK banking term for exactly this,
// as distinct from a Bill (a recurring payment to someone else). Same
// "no stored paid flag" pattern as Bills, just for transfers instead of
// transactions — transfers.standingOrderId links a transfer back to the
// standing order that generated it.
db.version(4).stores({
  accounts: '++id, name',
  categories: '++id, name, kind',
  transactions: '++id, date, kind, accountId, categoryId, billId',
  bills: '++id, name, categoryId, accountId',
  transfers: '++id, date, fromAccountId, toAccountId, standingOrderId',
  budgets: '++id, categoryId',
  standingOrders: '++id, name, fromAccountId, toAccountId'
});

// v5: adds Savings Goals — a target amount tied to one of the user's own
// accounts (e.g. "ISA deposit target: £5,000" tied to their ISA account).
// Deliberately doesn't track its own separate ledger of contributions —
// progress is simply that account's current balance vs. the target, so any
// Transfer or Standing Order that moves money into the account (e.g. a
// monthly Standing Order into savings) automatically counts, with no extra
// wiring needed.
db.version(5).stores({
  accounts: '++id, name',
  categories: '++id, name, kind',
  transactions: '++id, date, kind, accountId, categoryId, billId',
  bills: '++id, name, categoryId, accountId',
  transfers: '++id, date, fromAccountId, toAccountId, standingOrderId',
  budgets: '++id, categoryId',
  standingOrders: '++id, name, fromAccountId, toAccountId',
  savingsGoals: '++id, accountId'
});

/* ---------------- Accounts ---------------- */

async function addAccount({ name, type, startingBalance }) {
  return db.accounts.add({
    name,
    type,
    startingBalance: Number(startingBalance) || 0
  });
}

async function getAccounts() {
  return db.accounts.toArray();
}

async function deleteAccount(id) {
  return db.accounts.delete(id);
}

/* ---------------- Categories ---------------- */

async function addCategory({ name, kind, color }) {
  return db.categories.add({ name, kind, color });
}

async function getCategories() {
  return db.categories.toArray();
}

async function deleteCategory(id) {
  return db.categories.delete(id);
}

/* ---------------- Transactions ---------------- */

async function addTransaction({ date, amount, kind, accountId, categoryId, note, billId }) {
  return db.transactions.add({
    date,
    amount: Number(amount) || 0,
    kind,
    accountId: Number(accountId),
    categoryId: Number(categoryId),
    note: note || '',
    billId: billId ? Number(billId) : null
  });
}

async function getTransactions() {
  return db.transactions.orderBy('date').reverse().toArray();
}

async function deleteTransaction(id) {
  return db.transactions.delete(id);
}

/* ---------------- Transfers (money moving between your own accounts) ----------------
   A transfer is not income or expense — it just moves money from one of your
   accounts to another (e.g. Checking -> Savings). It's kept in its own table
   instead of the transactions table because it affects two accounts at once,
   not one.
*/

async function addTransfer({ date, amount, fromAccountId, toAccountId, note, standingOrderId }) {
  return db.transfers.add({
    date,
    amount: Number(amount) || 0,
    fromAccountId: Number(fromAccountId),
    toAccountId: Number(toAccountId),
    note: note || '',
    standingOrderId: standingOrderId ? Number(standingOrderId) : null
  });
}

async function getTransfers() {
  return db.transfers.orderBy('date').reverse().toArray();
}

async function deleteTransfer(id) {
  return db.transfers.delete(id);
}

/* ---------------- Standing Orders (recurring transfers) ----------------
   A "standing order" is a template for moving money between two of your
   own accounts on a repeating schedule (e.g. £200 to Savings on the 1st).
   Exactly the Bills pattern, but for Transfers instead of Transactions —
   "done" isn't a stored flag, we check whether a transfer with this
   standingOrderId exists in the given month.
*/

async function addStandingOrder({ name, amount, fromAccountId, toAccountId, dueDay }) {
  return db.standingOrders.add({
    name,
    amount: Number(amount) || 0,
    fromAccountId: Number(fromAccountId),
    toAccountId: Number(toAccountId),
    dueDay: Math.min(31, Math.max(1, Number(dueDay) || 1))
  });
}

async function getStandingOrders() {
  return db.standingOrders.toArray();
}

async function deleteStandingOrder(id) {
  return db.standingOrders.delete(id);
}

// Marks a standing order as done for the given month by creating a real transfer linked to it.
async function markStandingOrderDone(standingOrderId, dateStr) {
  const so = await db.standingOrders.get(standingOrderId);
  if (!so) return;
  return addTransfer({
    date: dateStr,
    amount: so.amount,
    fromAccountId: so.fromAccountId,
    toAccountId: so.toAccountId,
    note: so.name,
    standingOrderId: so.id
  });
}

// Un-marks a standing order as done for a given month by deleting the transfer(s) it created.
async function markStandingOrderUndone(standingOrderId, monthStr) {
  const transfers = await db.transfers.where('standingOrderId').equals(standingOrderId).toArray();
  const inMonth = transfers.filter(tr => tr.date.startsWith(monthStr));
  for (const tr of inMonth) {
    await db.transfers.delete(tr.id);
  }
}

// Returns standing orders with computed status for a given month: done/due/overdue, due date, days until due.
async function getStandingOrdersWithStatus(monthStr) {
  const [standingOrders, transfers] = await Promise.all([getStandingOrders(), db.transfers.toArray()]);
  const [year, month] = monthStr.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  return standingOrders.map(so => {
    const day = Math.min(so.dueDay, daysInMonth);
    const dueDate = new Date(year, month - 1, day);
    const doneTx = transfers.find(tr => tr.standingOrderId === so.id && tr.date.startsWith(monthStr));
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysUntilDue = Math.round((dueDate - today) / msPerDay);

    let status;
    if (doneTx) status = 'paid';
    else if (daysUntilDue < 0) status = 'overdue';
    else status = 'unpaid';

    return { ...so, dueDate, daysUntilDue, status, paidTx: doneTx };
  }).sort((a, b) => a.dueDate - b.dueDate);
}

// Auto-executes any standing order whose due date (this month) has arrived
// and hasn't already run — same reasoning as runAutoPayBills(): only looks
// at the current month, dates the transfer on the actual due date, and only
// runs while the app is actually open. Idempotent — safe to call repeatedly.
async function runAutoPayStandingOrders() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const daysInMonth = new Date(year, month, 0).getDate();

  const [standingOrders, transfers] = await Promise.all([getStandingOrders(), db.transfers.toArray()]);
  const justPaid = [];

  for (const so of standingOrders) {
    const day = Math.min(so.dueDay, daysInMonth);
    const dueDate = new Date(year, month - 1, day);
    const alreadyDone = transfers.some(tr => tr.standingOrderId === so.id && tr.date.startsWith(monthStr));
    if (alreadyDone || dueDate > today) continue;

    const dueDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    await markStandingOrderDone(so.id, dueDateStr);
    justPaid.push(so);
  }
  return justPaid;
}

/* ---------------- Bills (recurring expenses) ----------------
   A "bill" is a template (Rent, Netflix, etc). Each month, it's either
   unpaid, or has an actual transaction logged against it (paid).
   We don't store "paid" as a flag on the bill itself — instead we check
   whether a transaction with this billId exists in the given month.
   That keeps bills and transactions as the single source of truth.
*/

async function addBill({ name, amount, categoryId, accountId, dueDay, isSubscription }) {
  return db.bills.add({
    name,
    amount: Number(amount) || 0,
    categoryId: Number(categoryId),
    accountId: Number(accountId),
    dueDay: Math.min(31, Math.max(1, Number(dueDay) || 1)),
    isSubscription: !!isSubscription
  });
}

async function getBills() {
  return db.bills.toArray();
}

async function deleteBill(id) {
  return db.bills.delete(id);
}

async function setBillSubscription(id, isSubscription) {
  return db.bills.update(id, { isSubscription: !!isSubscription });
}

// Sum of the monthly amount of every bill tagged as a subscription — a
// quick "how much am I paying in subscriptions" total, independent of
// whether each one has actually been paid yet this month.
async function getSubscriptionMonthlyTotal() {
  const bills = await getBills();
  return bills.filter(b => b.isSubscription).reduce((sum, b) => sum + b.amount, 0);
}

// Marks a bill as paid for the given month by creating a real transaction linked to it.
async function markBillPaid(billId, dateStr) {
  const bill = await db.bills.get(billId);
  if (!bill) return;
  return addTransaction({
    date: dateStr,
    amount: bill.amount,
    kind: 'expense',
    accountId: bill.accountId,
    categoryId: bill.categoryId,
    note: bill.name,
    billId: bill.id
  });
}

// Un-marks a bill as paid for a given month by deleting the transaction(s) that recorded it.
async function markBillUnpaid(billId, monthStr) {
  const txs = await db.transactions.where('billId').equals(billId).toArray();
  const inMonth = txs.filter(t => t.date.startsWith(monthStr));
  for (const t of inMonth) {
    await db.transactions.delete(t.id);
  }
}

// Auto-pays any bill whose due date (this month) has arrived and hasn't
// already been paid — creates the same transaction markBillPaid() would,
// dated on the actual due date (not today), so records stay accurate even
// if the app wasn't opened until a few days after the bill was due.
// Idempotent: safe to call on every page load, since it only acts on bills
// that are still unpaid. Only looks at the CURRENT month — it doesn't
// retroactively pay bills from months the app was never opened.
// Note: this can only run while the app is actually open (there's no
// background process in a browser app), so "automatic" means "the next
// time you open the app on or after the due date", not literally at
// midnight on the due day.
async function runAutoPayBills() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const daysInMonth = new Date(year, month, 0).getDate();

  const [bills, txs] = await Promise.all([getBills(), db.transactions.toArray()]);
  const justPaid = [];

  for (const bill of bills) {
    const day = Math.min(bill.dueDay, daysInMonth);
    const dueDate = new Date(year, month - 1, day);
    const alreadyPaid = txs.some(t => t.billId === bill.id && t.date.startsWith(monthStr));
    if (alreadyPaid || dueDate > today) continue;

    const dueDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    await markBillPaid(bill.id, dueDateStr);
    justPaid.push(bill);
  }
  return justPaid;
}

// Returns bills with computed status for a given month: paid/unpaid, due date, days until due.
async function getBillsWithStatus(monthStr) {
  const [bills, txs] = await Promise.all([getBills(), db.transactions.toArray()]);
  const [year, month] = monthStr.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  return bills.map(bill => {
    const day = Math.min(bill.dueDay, daysInMonth);
    const dueDate = new Date(year, month - 1, day);
    const paidTx = txs.find(t => t.billId === bill.id && t.date.startsWith(monthStr));
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysUntilDue = Math.round((dueDate - today) / msPerDay);

    let status;
    if (paidTx) status = 'paid';
    else if (daysUntilDue < 0) status = 'overdue';
    else status = 'unpaid';

    return { ...bill, dueDate, daysUntilDue, status, paidTx };
  }).sort((a, b) => a.dueDate - b.dueDate);
}

/* ---------------- Budgets (recurring monthly £ limit per category) ----------------
   Like Bills, a budget is a recurring template — one row per category, not
   one row per month. Progress against it is worked out fresh each month by
   comparing to that month's actual spending in getBudgetsWithProgress.
*/

function todayMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonthStr(monthStr, delta) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function addBudget({ categoryId, amount, rollover }) {
  return db.budgets.add({
    categoryId: Number(categoryId),
    amount: Number(amount) || 0,
    rollover: !!rollover,
    // Rollover only ever carries forward from the month it was switched on —
    // never backdated — so turning it on doesn't invent retroactive credit
    // out of months the budget wasn't actually being tracked against.
    rolloverStartMonth: rollover ? todayMonthStr() : null
  });
}

async function getBudgets() {
  return db.budgets.toArray();
}

async function deleteBudget(id) {
  return db.budgets.delete(id);
}

// Turning rollover on (re)starts the carry baseline at the current month.
// Turning it off just stops applying the carry to the displayed limit.
async function setBudgetRollover(id, rollover) {
  const patch = { rollover: !!rollover };
  if (rollover) patch.rolloverStartMonth = todayMonthStr();
  return db.budgets.update(id, patch);
}

// Returns budgets with computed spend/remaining/percent for a given month.
// When a budget has rollover on, its effective limit for the month is the
// base amount plus the running total of (amount - spent) for every month
// since rolloverStartMonth — so an underspent month raises next month's
// limit, an overspent month lowers it.
async function getBudgetsWithProgress(monthStr) {
  const [budgets, categories, allTxs, breakdown] = await Promise.all([
    getBudgets(), getCategories(), db.transactions.toArray(), getCategoryBreakdown(monthStr)
  ]);

  const expenseTotalForMonth = (categoryId, mStr) => {
    let total = 0;
    for (const t of allTxs) {
      if (t.kind === 'expense' && t.categoryId === categoryId && t.date.startsWith(mStr)) total += t.amount;
    }
    return total;
  };

  return budgets.map(budget => {
    const category = categories.find(c => c.id === budget.categoryId);
    const row = breakdown.find(r => r.category && r.category.id === budget.categoryId);
    const spent = row ? row.total : 0;

    let carry = 0;
    if (budget.rollover && budget.rolloverStartMonth && budget.rolloverStartMonth < monthStr) {
      let cursor = budget.rolloverStartMonth;
      let guard = 0;
      while (cursor < monthStr && guard < 600) {
        carry += budget.amount - expenseTotalForMonth(budget.categoryId, cursor);
        cursor = shiftMonthStr(cursor, 1);
        guard++;
      }
    }

    const limit = budget.amount + carry;
    const remaining = limit - spent;
    const percent = limit > 0 ? Math.min(100, (spent / limit) * 100) : (spent > 0 ? 100 : 0);
    const overBudget = spent > limit;

    return { ...budget, category, spent, carry, limit, remaining, percent, overBudget };
  }).sort((a, b) => b.percent - a.percent);
}

/* ---------------- Savings Goals ----------------
   A target amount tied to one of the user's own accounts. Progress is just
   that account's current balance vs. the target — see the v5 schema comment
   above for why there's no separate contribution ledger.
*/

async function addSavingsGoal({ name, targetAmount, accountId, targetDate }) {
  return db.savingsGoals.add({
    name,
    targetAmount: Number(targetAmount) || 0,
    accountId: Number(accountId),
    targetDate: targetDate || null
  });
}

async function getSavingsGoals() {
  return db.savingsGoals.toArray();
}

async function deleteSavingsGoal(id) {
  return db.savingsGoals.delete(id);
}

// Returns goals with computed current balance/remaining/percent/achieved.
async function getSavingsGoalsWithProgress() {
  const [goals, accounts] = await Promise.all([getSavingsGoals(), getAccounts()]);

  return Promise.all(goals.map(async goal => {
    const account = accounts.find(a => a.id === goal.accountId);
    const current = account ? await getAccountBalance(goal.accountId) : 0;
    const remaining = Math.max(0, goal.targetAmount - current);
    const percent = goal.targetAmount > 0 ? Math.min(100, (current / goal.targetAmount) * 100) : 0;
    const achieved = current >= goal.targetAmount;

    return { ...goal, account, current, remaining, percent, achieved };
  }));
}

/* ---------------- Data export / import (used by Sync) ----------------
   Exports/imports the whole database as one object. Sync encrypts this
   whole thing as a single blob rather than syncing record-by-record, so
   importing always replaces every table's contents wholesale.
*/

async function exportAllData() {
  const [accounts, categories, transactions, bills, transfers, budgets, standingOrders, savingsGoals] = await Promise.all([
    db.accounts.toArray(),
    db.categories.toArray(),
    db.transactions.toArray(),
    db.bills.toArray(),
    db.transfers.toArray(),
    db.budgets.toArray(),
    db.standingOrders.toArray(),
    db.savingsGoals.toArray()
  ]);
  return { accounts, categories, transactions, bills, transfers, budgets, standingOrders, savingsGoals };
}

async function importAllData(data) {
  const tables = [db.accounts, db.categories, db.transactions, db.bills, db.transfers, db.budgets, db.standingOrders, db.savingsGoals];
  await db.transaction('rw', tables, async () => {
    await Promise.all(tables.map(t => t.clear()));
    await Promise.all([
      data.accounts && data.accounts.length ? db.accounts.bulkAdd(data.accounts) : null,
      data.categories && data.categories.length ? db.categories.bulkAdd(data.categories) : null,
      data.transactions && data.transactions.length ? db.transactions.bulkAdd(data.transactions) : null,
      data.bills && data.bills.length ? db.bills.bulkAdd(data.bills) : null,
      data.transfers && data.transfers.length ? db.transfers.bulkAdd(data.transfers) : null,
      data.budgets && data.budgets.length ? db.budgets.bulkAdd(data.budgets) : null,
      data.standingOrders && data.standingOrders.length ? db.standingOrders.bulkAdd(data.standingOrders) : null,
      data.savingsGoals && data.savingsGoals.length ? db.savingsGoals.bulkAdd(data.savingsGoals) : null
    ]);
  });
}

/* ---------------- Derived data / calculations ---------------- */

function signedAmount(tx) {
  return tx.kind === 'expense' ? -tx.amount : tx.amount;
}

// asOfDateStr (optional, 'YYYY-MM-DD') limits the balance to activity on or
// before that date — used by net worth history to reconstruct past balances.
// Leave it out for the current, all-time balance.
async function getAccountBalance(accountId, asOfDateStr) {
  const account = await db.accounts.get(accountId);
  if (!account) return 0;
  const txs = await db.transactions.where('accountId').equals(accountId).toArray();
  const relevantTxs = asOfDateStr ? txs.filter(t => t.date <= asOfDateStr) : txs;
  const txTotal = relevantTxs.reduce((sum, t) => sum + signedAmount(t), 0);

  const transfers = await db.transfers.toArray();
  const relevantTransfers = asOfDateStr ? transfers.filter(tr => tr.date <= asOfDateStr) : transfers;
  const transferTotal = relevantTransfers.reduce((sum, tr) => {
    if (tr.fromAccountId === accountId) return sum - tr.amount;
    if (tr.toAccountId === accountId) return sum + tr.amount;
    return sum;
  }, 0);

  return account.startingBalance + txTotal + transferTotal;
}

async function getTotalBalance() {
  const accounts = await getAccounts();
  let total = 0;
  for (const acc of accounts) {
    total += await getAccountBalance(acc.id);
  }
  return total;
}

// Projects the total balance forward over the next `days` using known
// upcoming Bills only — Standing Orders move money between the user's own
// accounts, so they never change the total, only Bills (which pay out to
// someone else) do. This can't know about future income or day-to-day
// spending that hasn't been added yet, so it's a floor/worst-case view, not
// a prediction — the UI says so. Assumes days <= ~31 (checks this month and
// next month only, which covers any window that size).
async function getCashFlowForecast(days) {
  const [balance, bills, txs] = await Promise.all([
    getTotalBalance(), getBills(), db.transactions.toArray()
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + days);

  const events = [];
  for (let mOffset = 0; mOffset <= 1; mOffset++) {
    const y = today.getFullYear();
    const m = today.getMonth() + 1 + mOffset;
    const monthDate = new Date(y, m - 1, 1);
    const monthStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();

    for (const bill of bills) {
      const day = Math.min(bill.dueDay, daysInMonth);
      const dueDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
      if (dueDate < today || dueDate > endDate) continue;

      const alreadyPaid = txs.some(t => t.billId === bill.id && t.date.startsWith(monthStr));
      if (alreadyPaid) continue;

      const dueDateStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      events.push({ date: dueDateStr, name: bill.name, amount: bill.amount });
    }
  }

  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  let running = balance;
  let lowest = { balance: running, date: null };
  const series = events.map(e => {
    running -= e.amount;
    if (running < lowest.balance) lowest = { balance: running, date: e.date };
    return { ...e, balanceAfter: running };
  });

  return { startBalance: balance, days, events: series, lowest, endBalance: running };
}

// Splits accounts into assets (everything except credit cards) and
// liabilities (credit card accounts, normally negative), as of a given date.
async function getNetWorthAsOf(asOfDateStr) {
  const accounts = await getAccounts();
  let assets = 0;
  let liabilities = 0;
  for (const acc of accounts) {
    const balance = await getAccountBalance(acc.id, asOfDateStr);
    if (acc.type === 'credit' || acc.type === 'card') liabilities += balance;
    else assets += balance;
  }
  return { assets, liabilities, netWorth: assets + liabilities };
}

// Net worth reconstructed at the end of each of the last numMonths months
// (oldest first), by replaying account balances as of each month-end.
async function getNetWorthTrend(numMonths) {
  const now = new Date();
  const results = [];
  for (let i = numMonths - 1; i >= 0; i--) {
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const monthStr = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, '0')}`;
    const asOfDateStr = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, '0')}-${String(monthEnd.getDate()).padStart(2, '0')}`;
    const { assets, liabilities, netWorth } = await getNetWorthAsOf(asOfDateStr);
    results.push({ month: monthStr, assets, liabilities, netWorth });
  }
  return results;
}

async function getMonthTotals(monthStr) {
  const txs = await db.transactions.toArray();
  const inMonth = txs.filter(t => t.date.startsWith(monthStr));
  const income = inMonth.filter(t => t.kind === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = inMonth.filter(t => t.kind === 'expense').reduce((s, t) => s + t.amount, 0);
  return { income, expense };
}

// Returns income/expense/net for each of the last numMonths months
// (oldest first), for the Trends page.
async function getMonthlyTrends(numMonths) {
  const now = new Date();
  const months = [];
  for (let i = numMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const results = [];
  for (const monthStr of months) {
    const { income, expense } = await getMonthTotals(monthStr);
    results.push({ month: monthStr, income, expense, net: income - expense });
  }
  return results;
}

async function getCategoryBreakdown(monthStr) {
  const [txs, categories] = await Promise.all([db.transactions.toArray(), getCategories()]);
  const inMonth = txs.filter(t => t.date.startsWith(monthStr) && t.kind === 'expense');

  const totals = {};
  for (const t of inMonth) {
    totals[t.categoryId] = (totals[t.categoryId] || 0) + t.amount;
  }

  return Object.entries(totals)
    .map(([categoryId, total]) => ({
      category: categories.find(c => c.id === Number(categoryId)),
      total
    }))
    .filter(row => row.category)
    .sort((a, b) => b.total - a.total);
}
