/*
  render.js
  ---------
  Takes data (from db.js) and turns it into HTML on screen.
  Nothing in here reads user clicks — that's app.js's job.
*/

function formatMoney(n) {
  const sign = n < 0 ? '-' : '';
  return `${sign}£${Math.abs(n).toFixed(2)}`;
}

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(monthStr) {
  const [y, m] = monthStr.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

async function renderDashboard() {
  const month = currentMonthStr();
  document.getElementById('month-label').textContent = monthLabel(month);

  const [balance, { income, expense }, breakdown, allTx, allTransfers, categories, accounts, bills] = await Promise.all([
    getTotalBalance(),
    getMonthTotals(month),
    getCategoryBreakdown(month),
    getTransactions(),
    getTransfers(),
    getCategories(),
    getAccounts(),
    getBillsWithStatus(month)
  ]);

  document.getElementById('stat-balance').textContent = formatMoney(balance);
  document.getElementById('stat-income').textContent = formatMoney(income);
  document.getElementById('stat-expense').textContent = formatMoney(expense);

  const breakdownEl = document.getElementById('category-breakdown');
  if (breakdown.length === 0) {
    breakdownEl.innerHTML = `<p class="empty-note">No expenses recorded this month yet.</p>`;
  } else {
    const max = breakdown[0].total;
    breakdownEl.innerHTML = breakdown.map(row => `
      <div class="breakdown-row">
        <div class="breakdown-top">
          <span>${escapeHtml(row.category.name)}</span>
          <span>${formatMoney(row.total)}</span>
        </div>
        <div class="breakdown-bar-track">
          <div class="breakdown-bar-fill" style="width:${(row.total / max) * 100}%; background:${row.category.color}"></div>
        </div>
      </div>
    `).join('');
  }

  // Upcoming bills: unpaid ones first, soonest due first, capped at 5
  const upcomingEl = document.getElementById('upcoming-bills');
  const upcoming = bills.filter(b => b.status !== 'paid').slice(0, 5);
  upcomingEl.innerHTML = renderBillRows(upcoming, categories, false);

  const recentEl = document.getElementById('recent-list');
  const recent = combineLedgerEntries(allTx, allTransfers).slice(0, 6);
  recentEl.innerHTML = renderLedgerRows(recent, categories, accounts, false);
}

// Merges transactions and transfers into one list for display, newest first.
function combineLedgerEntries(txs, transfers) {
  const tagged = [
    ...txs.map(t => ({ ...t, entryType: 'transaction' })),
    ...transfers.map(t => ({ ...t, entryType: 'transfer' }))
  ];
  return tagged.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.id || 0) - (a.id || 0)));
}

async function renderTransactions() {
  const [txs, transfers, categories, accounts] = await Promise.all([
    getTransactions(), getTransfers(), getCategories(), getAccounts()
  ]);

  const accSelect = document.getElementById('filter-account');
  const catSelect = document.getElementById('filter-category');
  accSelect.innerHTML = `<option value="">All accounts</option>` +
    accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
  catSelect.innerHTML = `<option value="">All categories</option>` +
    categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

  applyTransactionFilters(txs, transfers, categories, accounts);
}

function applyTransactionFilters(allTx, allTransfers, categories, accounts) {
  const accId = document.getElementById('filter-account').value;
  const catId = document.getElementById('filter-category').value;
  const month = document.getElementById('filter-month').value;

  let entries = combineLedgerEntries(allTx, allTransfers);
  if (accId) {
    const id = Number(accId);
    entries = entries.filter(e => e.entryType === 'transaction'
      ? e.accountId === id
      : (e.fromAccountId === id || e.toAccountId === id));
  }
  // Transfers have no category, so a category filter excludes them.
  if (catId) entries = entries.filter(e => e.entryType === 'transaction' && e.categoryId === Number(catId));
  if (month) entries = entries.filter(e => e.date.startsWith(month));

  document.getElementById('transaction-list').innerHTML =
    renderLedgerRows(entries, categories, accounts, true);
}

function renderLedgerRows(entries, categories, accounts, withActions) {
  if (entries.length === 0) {
    return `<p class="empty-note">No transactions yet. Add your first one to get started.</p>`;
  }
  return entries.map(t => {
    if (t.entryType === 'transfer') {
      const from = accounts.find(a => a.id === t.fromAccountId);
      const to = accounts.find(a => a.id === t.toAccountId);
      return `
        <div class="ledger-row" data-id="${t.id}">
          <div class="ledger-desc">
            <span class="ledger-name">${escapeHtml(t.note || 'Transfer')}</span>
            <span class="ledger-meta">${t.date} · Transfer · ${from ? escapeHtml(from.name) : '—'} → ${to ? escapeHtml(to.name) : '—'}</span>
          </div>
          <span class="ledger-leader"></span>
          <span class="ledger-amount transfer">${formatMoney(t.amount)}</span>
          ${withActions ? `<div class="row-actions"><button class="icon-btn danger" data-action="delete-transfer" data-id="${t.id}" aria-label="Delete">✕</button></div>` : ''}
        </div>
      `;
    }
    const cat = categories.find(c => c.id === t.categoryId);
    const acc = accounts.find(a => a.id === t.accountId);
    const sign = t.kind === 'expense' ? '-' : '+';
    return `
      <div class="ledger-row" data-id="${t.id}">
        <div class="ledger-desc">
          <span class="ledger-name">${escapeHtml(t.note || (cat ? cat.name : 'Uncategorized'))}</span>
          <span class="ledger-meta">${t.date} · ${cat ? escapeHtml(cat.name) : '—'} · ${acc ? escapeHtml(acc.name) : '—'}</span>
        </div>
        <span class="ledger-leader"></span>
        <span class="ledger-amount ${t.kind}">${sign}${formatMoney(t.amount)}</span>
        ${withActions ? `<div class="row-actions"><button class="icon-btn danger" data-action="delete-tx" data-id="${t.id}" aria-label="Delete">✕</button></div>` : ''}
      </div>
    `;
  }).join('');
}

/* ---------------- Bills page ---------------- */

async function renderBills() {
  const month = currentMonthStr();
  const [bills, categories] = await Promise.all([getBillsWithStatus(month), getCategories()]);
  document.getElementById('bills-month-label').textContent = monthLabel(month);
  document.getElementById('bill-list').innerHTML = renderBillRows(bills, categories, true);
}

// Shared bill renderer — used by both the dashboard's "upcoming" list and the full Bills page.
function renderBillRows(bills, categories, withActions) {
  if (bills.length === 0) {
    return `<p class="empty-note">No bills yet. Add rent, subscriptions, or utilities to track what's due.</p>`;
  }
  const month = currentMonthStr();
  return bills.map(b => {
    const cat = categories.find(c => c.id === b.categoryId);
    let statusLabel, statusClass;
    if (b.status === 'paid') { statusLabel = 'Paid'; statusClass = 'paid'; }
    else if (b.status === 'overdue') { statusLabel = `Overdue ${Math.abs(b.daysUntilDue)}d`; statusClass = 'overdue'; }
    else if (b.daysUntilDue === 0) { statusLabel = 'Due today'; statusClass = 'due-soon'; }
    else { statusLabel = `Due in ${b.daysUntilDue}d`; statusClass = b.daysUntilDue <= 3 ? 'due-soon' : 'upcoming'; }

    return `
      <div class="bill-row" data-id="${b.id}">
        <div class="ledger-desc">
          <span class="ledger-name">${escapeHtml(b.name)}</span>
          <span class="ledger-meta">${cat ? escapeHtml(cat.name) : '—'} · due day ${b.dueDay}</span>
        </div>
        <span class="ledger-leader"></span>
        <span class="bill-status ${statusClass}">${statusLabel}</span>
        <span class="ledger-amount expense">-${formatMoney(b.amount)}</span>
        <div class="row-actions">
          ${b.status === 'paid'
            ? `<button class="btn-secondary btn-sm" data-action="unpay-bill" data-id="${b.id}" data-month="${month}">Undo</button>`
            : `<button class="btn-primary btn-sm" data-action="pay-bill" data-id="${b.id}">Mark paid</button>`}
          ${withActions ? `<button class="icon-btn danger" data-action="delete-bill" data-id="${b.id}" aria-label="Delete">✕</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

/* ---------------- Budgets page ---------------- */

async function renderBudgets() {
  const month = currentMonthStr();
  const budgets = await getBudgetsWithProgress(month);
  document.getElementById('budgets-month-label').textContent = monthLabel(month);

  const el = document.getElementById('budget-list');
  if (budgets.length === 0) {
    el.innerHTML = `<p class="empty-note">No budgets yet. Set a monthly limit for a category to track progress.</p>`;
    return;
  }
  el.innerHTML = budgets.map(b => `
    <div class="panel budget-card" data-id="${b.id}">
      <div class="breakdown-top">
        <span>${b.category ? escapeHtml(b.category.name) : 'Uncategorized'}</span>
        <span>${formatMoney(b.spent)} of ${formatMoney(b.amount)}</span>
      </div>
      <div class="breakdown-bar-track">
        <div class="breakdown-bar-fill ${b.overBudget ? 'over' : ''}" style="width:${b.percent}%; background:${b.overBudget ? 'var(--expense)' : (b.category ? b.category.color : 'var(--gold)')}"></div>
      </div>
      <div class="budget-foot">
        <span class="ledger-meta">${b.overBudget ? `Over by ${formatMoney(Math.abs(b.remaining))}` : `${formatMoney(b.remaining)} remaining`}</span>
        <button class="icon-btn danger" data-action="delete-budget" data-id="${b.id}" aria-label="Delete">✕</button>
      </div>
    </div>
  `).join('');
}

/* ---------------- Categories page ---------------- */

async function renderCategories() {
  const categories = await getCategories();
  const el = document.getElementById('category-list');
  if (categories.length === 0) {
    el.innerHTML = `<p class="empty-note">No categories yet. Add one to start tagging transactions.</p>`;
    return;
  }
  el.innerHTML = categories.map(c => `
    <div class="tag-chip">
      <span class="tag-dot" style="background:${c.color}"></span>
      <span>${escapeHtml(c.name)}</span>
      <span class="ledger-meta">${c.kind}</span>
      <button class="icon-btn danger" data-action="delete-category" data-id="${c.id}" aria-label="Delete">✕</button>
    </div>
  `).join('');
}

/* ---------------- Accounts page ---------------- */

// Maps stored account type codes to display labels. 'bank'/'card' are kept
// for backward compatibility with accounts saved before the type list was
// changed to UK banking terms.
function accountTypeLabel(type) {
  const labels = {
    current: 'Current account',
    savings: 'Savings account',
    credit: 'Credit card',
    cash: 'Cash',
    bank: 'Current account',
    card: 'Credit card'
  };
  return labels[type] || type;
}

async function renderAccounts() {
  const accounts = await getAccounts();
  const el = document.getElementById('account-list');
  if (accounts.length === 0) {
    el.innerHTML = `<p class="empty-note">No accounts yet. Add one (e.g. "Cash" or "Current account") to begin.</p>`;
    return;
  }
  const cards = await Promise.all(accounts.map(async a => {
    const balance = await getAccountBalance(a.id);
    return `
      <div class="account-card">
        <div class="acc-name">${escapeHtml(a.name)}</div>
        <div class="acc-type">${accountTypeLabel(a.type)}</div>
        <div class="acc-balance">${formatMoney(balance)}</div>
        <div class="form-actions">
          <button class="icon-btn danger" data-action="delete-account" data-id="${a.id}" aria-label="Delete">✕</button>
        </div>
      </div>
    `;
  }));
  el.innerHTML = cards.join('');
}

/* ---------------- Sync page ---------------- */

// Reads sync status straight from localStorage rather than calling into
// sync.js, so the page still renders correctly even before that network
// module has finished loading (e.g. while offline).
function getSyncStatusLocal() {
  const passphraseSet = !!localStorage.getItem('budgeter_sync_passphrase');
  const lastSyncedRaw = localStorage.getItem('budgeter_sync_last_synced');
  return {
    setUp: passphraseSet,
    lastSynced: lastSyncedRaw ? new Date(Number(lastSyncedRaw)) : null
  };
}

function renderSync() {
  const el = document.getElementById('sync-panel');
  const status = getSyncStatusLocal();

  if (!status.setUp) {
    el.innerHTML = `
      <h2>Set up sync</h2>
      <p class="sub">Choose a passphrase. It encrypts your data before it ever leaves this device —
        nobody, including us or the cloud provider, can read it without this passphrase.
        <strong>If you lose it, synced data can't be recovered</strong> — keep it somewhere safe.</p>
      <div class="form-field">
        <label>Passphrase</label>
        <input type="password" id="sync-passphrase" placeholder="At least 8 characters" />
      </div>
      <div class="form-field">
        <label>Confirm passphrase</label>
        <input type="password" id="sync-passphrase-confirm" placeholder="Type it again" />
      </div>
      <div class="form-actions" style="justify-content:flex-start">
        <button class="btn-primary" data-action="setup-sync">Set up sync</button>
      </div>
      <p class="empty-note" id="sync-note" style="display:none;margin-top:14px"></p>
    `;
  } else {
    const lastSyncedText = status.lastSynced
      ? status.lastSynced.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      : 'Never';
    el.innerHTML = `
      <h2>Sync</h2>
      <p class="sub">This device is set up for sync. Enter the same passphrase on your other device to link it.</p>
      <p class="ledger-meta">Last synced: ${escapeHtml(lastSyncedText)}</p>
      <div class="form-actions" style="justify-content:flex-start;margin-top:14px">
        <button class="btn-primary" data-action="sync-now">Sync now</button>
        <button class="btn-secondary" data-action="forget-sync">Forget on this device</button>
      </div>
      <p class="empty-note" id="sync-note" style="display:none;margin-top:14px"></p>
    `;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
