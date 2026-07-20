/*
  render.js
  ---------
  Takes data (from db.js) and turns it into HTML on screen.
  Nothing in here reads user clicks — that's app.js's job.
*/

function formatMoney(n) {
  const sign = n < 0 ? '-' : '';
  return `${sign}£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Formats a 'YYYY-MM-DD' string as UK-style DD/MM/YY, e.g. "17/07/26".
function formatUKDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

// Formats a Date (or epoch ms) as UK-style "DD/MM/YY, HH:MM" (24-hour clock).
function formatUKDateTime(dateOrMs) {
  const d = dateOrMs instanceof Date ? dateOrMs : new Date(dateOrMs);
  const datePart = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
  const timePart = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${datePart}, ${timePart}`;
}

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(monthStr) {
  const [y, m] = monthStr.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString(currentLang === 'es' ? 'es-ES' : undefined, { month: 'long', year: 'numeric' });
}

// Tiny inline trend line (e.g. net worth over the last few months) shown
// next to the balance figure on the dashboard.
function renderSparkline(values, width, height) {
  width = width || 100;
  height = height || 28;
  if (values.length < 2 || values.every(v => v === values[0])) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

async function renderDashboard() {
  applyDashboardLayout();
  const month = currentMonthStr();
  document.getElementById('month-label').textContent = monthLabel(month);

  const [balance, { income, expense }, breakdown, allTx, allTransfers, categories, accounts, bills, netWorthTrend, forecast] = await Promise.all([
    getTotalBalance(),
    getMonthTotals(month),
    getCategoryBreakdown(month),
    getTransactions(),
    getTransfers(),
    getCategories(),
    getAccounts(),
    getBillsWithStatus(month),
    getNetWorthTrend(6),
    getCashFlowForecast(30)
  ]);

  document.getElementById('stat-balance').textContent = formatMoney(balance);
  document.getElementById('balance-sparkline').innerHTML = renderSparkline(netWorthTrend.map(t => t.netWorth));
  document.getElementById('stat-income').textContent = formatMoney(income);
  document.getElementById('stat-expense').textContent = formatMoney(expense);

  const breakdownEl = document.getElementById('category-breakdown');
  if (breakdown.length === 0) {
    breakdownEl.innerHTML = `<p class="empty-note">${t('dashboard.emptyBreakdown')}</p>`;
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

  renderCashFlowForecast(forecast);
}

function renderCashFlowForecast(forecast) {
  const lowestEl = document.getElementById('cashflow-lowest');
  const listEl = document.getElementById('cashflow-events');

  if (forecast.events.length === 0) {
    lowestEl.style.display = 'none';
    listEl.innerHTML = `<p class="empty-note">${t('dashboard.cashFlowEmpty')}</p>`;
    return;
  }

  lowestEl.style.display = '';
  lowestEl.textContent = t('dashboard.cashFlowLowest', { amt: formatMoney(forecast.lowest.balance), date: formatUKDate(forecast.lowest.date) });

  listEl.innerHTML = forecast.events.map(e => `
    <div class="bill-row">
      <div class="ledger-desc">
        <span class="ledger-name">${escapeHtml(e.name)}</span>
        <span class="ledger-meta">${formatUKDate(e.date)} · ${t('dashboard.cashFlowBalanceAfter', { amt: formatMoney(e.balanceAfter) })}</span>
      </div>
      <span class="ledger-leader"></span>
      <span class="ledger-amount expense">-${formatMoney(e.amount)}</span>
    </div>
  `).join('');
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
  accSelect.innerHTML = `<option value="">${t('transactions.allAccounts')}</option>` +
    accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
  catSelect.innerHTML = `<option value="">${t('transactions.allCategories')}</option>` +
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
    return `<p class="empty-note">${t('transactions.empty')}</p>`;
  }
  return entries.map(entry => {
    if (entry.entryType === 'transfer') {
      const from = accounts.find(a => a.id === entry.fromAccountId);
      const to = accounts.find(a => a.id === entry.toAccountId);
      return `
        <div class="ledger-row" data-id="${entry.id}">
          <div class="ledger-desc">
            <span class="ledger-name">${escapeHtml(entry.note || t('transactions.transferLabel'))}</span>
            <span class="ledger-meta">${formatUKDate(entry.date)} · ${t('transactions.transferLabel')} · ${from ? escapeHtml(from.name) : '—'} → ${to ? escapeHtml(to.name) : '—'}</span>
          </div>
          <span class="ledger-leader"></span>
          <span class="ledger-amount transfer">${formatMoney(entry.amount)}</span>
          ${withActions ? `<div class="row-actions"><button class="icon-btn danger" data-action="delete-transfer" data-id="${entry.id}" aria-label="Delete">✕</button></div>` : ''}
        </div>
      `;
    }
    const cat = categories.find(c => c.id === entry.categoryId);
    const acc = accounts.find(a => a.id === entry.accountId);
    const sign = entry.kind === 'expense' ? '-' : '+';
    return `
      <div class="ledger-row" data-id="${entry.id}">
        <div class="ledger-desc">
          <span class="ledger-name">${escapeHtml(entry.note || (cat ? cat.name : t('transactions.uncategorized')))}</span>
          <span class="ledger-meta">${formatUKDate(entry.date)} · ${cat ? escapeHtml(cat.name) : '—'} · ${acc ? escapeHtml(acc.name) : '—'}</span>
        </div>
        <span class="ledger-leader"></span>
        <span class="ledger-amount ${entry.kind}">${sign}${formatMoney(entry.amount)}</span>
        ${withActions ? `<div class="row-actions"><button class="icon-btn danger" data-action="delete-tx" data-id="${entry.id}" aria-label="Delete">✕</button></div>` : ''}
      </div>
    `;
  }).join('');
}

/* ---------------- Bills page ---------------- */

let showSubscriptionsOnly = false;

async function renderBills() {
  const month = currentMonthStr();
  const [bills, categories] = await Promise.all([getBillsWithStatus(month), getCategories()]);
  document.getElementById('bills-month-label').textContent = monthLabel(month);

  const subs = bills.filter(b => b.isSubscription);
  const subBar = document.getElementById('subscription-bar');
  if (subs.length === 0) {
    subBar.style.display = 'none';
    showSubscriptionsOnly = false;
  } else {
    subBar.style.display = '';
    const subTotal = subs.reduce((sum, b) => sum + b.amount, 0);
    document.getElementById('subscription-total-label').textContent =
      t('bills.subscriptionTotal', { amt: formatMoney(subTotal), count: subs.length });
    document.getElementById('subscription-filter-toggle').checked = showSubscriptionsOnly;
  }

  const visible = showSubscriptionsOnly ? subs : bills;
  document.getElementById('bill-list').innerHTML = renderBillRows(visible, categories, true);
}

// Shared bill renderer — used by both the dashboard's "upcoming" list and the full Bills page.
function renderBillRows(bills, categories, withActions) {
  if (bills.length === 0) {
    return `<p class="empty-note">${t('bills.empty')}</p>`;
  }
  const month = currentMonthStr();
  return bills.map(b => {
    const cat = categories.find(c => c.id === b.categoryId);
    let statusLabel, statusClass;
    if (b.status === 'paid') { statusLabel = t('bills.paid'); statusClass = 'paid'; }
    else if (b.status === 'overdue') { statusLabel = t('bills.overdue', { n: Math.abs(b.daysUntilDue) }); statusClass = 'overdue'; }
    else if (b.daysUntilDue === 0) { statusLabel = t('bills.dueToday'); statusClass = 'due-soon'; }
    else { statusLabel = t('bills.dueIn', { n: b.daysUntilDue }); statusClass = b.daysUntilDue <= 3 ? 'due-soon' : 'upcoming'; }

    return `
      <div class="bill-row" data-id="${b.id}">
        <div class="ledger-desc">
          <span class="ledger-name">${escapeHtml(b.name)}${b.isSubscription ? `<span class="subscription-tag">${t('bills.subscriptionBadge')}</span>` : ''}</span>
          <span class="ledger-meta">${cat ? escapeHtml(cat.name) : '—'} · ${t('bills.dueDayLabel', { n: b.dueDay })}</span>
        </div>
        <span class="ledger-leader"></span>
        <span class="bill-status ${statusClass}">${statusLabel}</span>
        <span class="ledger-amount expense">-${formatMoney(b.amount)}</span>
        <div class="row-actions">
          ${b.status === 'paid'
            ? `<button class="btn-secondary btn-sm" data-action="unpay-bill" data-id="${b.id}" data-month="${month}">${t('bills.undo')}</button>`
            : `<button class="btn-primary btn-sm" data-action="pay-bill" data-id="${b.id}">${t('bills.markPaid')}</button>`}
          ${withActions ? `<button class="btn-secondary btn-sm ${b.isSubscription ? 'active' : ''}" data-action="toggle-bill-subscription" data-id="${b.id}" data-next="${b.isSubscription ? '0' : '1'}" title="${b.isSubscription ? t('bills.subscriptionOnHint') : t('bills.subscriptionOffHint')}">${t('bills.subscriptionToggle')}</button>` : ''}
          ${withActions ? `<button class="icon-btn danger" data-action="delete-bill" data-id="${b.id}" aria-label="Delete">✕</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

/* ---------------- Standing Orders page ---------------- */

async function renderStandingOrders() {
  const month = currentMonthStr();
  const [standingOrders, accounts] = await Promise.all([getStandingOrdersWithStatus(month), getAccounts()]);
  document.getElementById('standingorders-month-label').textContent = monthLabel(month);
  document.getElementById('standingorder-list').innerHTML = renderStandingOrderRows(standingOrders, accounts, true);
}

// Reuses the bills.* status/action labels (Paid/Overdue/Due in.../Mark paid/
// Undo) since the semantics are identical, just for a transfer instead of
// a transaction — no need for a separate, duplicate set of i18n keys.
function renderStandingOrderRows(standingOrders, accounts, withActions) {
  if (standingOrders.length === 0) {
    return `<p class="empty-note">${t('standingOrders.empty')}</p>`;
  }
  const month = currentMonthStr();
  return standingOrders.map(so => {
    const from = accounts.find(a => a.id === so.fromAccountId);
    const to = accounts.find(a => a.id === so.toAccountId);
    let statusLabel, statusClass;
    if (so.status === 'paid') { statusLabel = t('bills.paid'); statusClass = 'paid'; }
    else if (so.status === 'overdue') { statusLabel = t('bills.overdue', { n: Math.abs(so.daysUntilDue) }); statusClass = 'overdue'; }
    else if (so.daysUntilDue === 0) { statusLabel = t('bills.dueToday'); statusClass = 'due-soon'; }
    else { statusLabel = t('bills.dueIn', { n: so.daysUntilDue }); statusClass = so.daysUntilDue <= 3 ? 'due-soon' : 'upcoming'; }

    return `
      <div class="bill-row" data-id="${so.id}">
        <div class="ledger-desc">
          <span class="ledger-name">${escapeHtml(so.name)}</span>
          <span class="ledger-meta">${from ? escapeHtml(from.name) : '—'} → ${to ? escapeHtml(to.name) : '—'} · ${t('bills.dueDayLabel', { n: so.dueDay })}</span>
        </div>
        <span class="ledger-leader"></span>
        <span class="bill-status ${statusClass}">${statusLabel}</span>
        <span class="ledger-amount transfer">${formatMoney(so.amount)}</span>
        <div class="row-actions">
          ${so.status === 'paid'
            ? `<button class="btn-secondary btn-sm" data-action="unpay-standingorder" data-id="${so.id}" data-month="${month}">${t('bills.undo')}</button>`
            : `<button class="btn-primary btn-sm" data-action="pay-standingorder" data-id="${so.id}">${t('bills.markPaid')}</button>`}
          ${withActions ? `<button class="icon-btn danger" data-action="delete-standingorder" data-id="${so.id}" aria-label="Delete">✕</button>` : ''}
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
    el.innerHTML = `<p class="empty-note">${t('budgets.empty')}</p>`;
    return;
  }
  el.innerHTML = budgets.map(b => `
    <div class="panel budget-card" data-id="${b.id}">
      <div class="breakdown-top">
        <span>${b.category ? escapeHtml(b.category.name) : t('transactions.uncategorized')}</span>
        <span>${formatMoney(b.spent)} ${t('budgets.of')} ${formatMoney(b.limit)}</span>
      </div>
      <div class="breakdown-bar-track">
        <div class="breakdown-bar-fill ${b.overBudget ? 'over' : ''}" style="width:${b.percent}%; background:${b.overBudget ? 'var(--expense)' : (b.category ? b.category.color : 'var(--gold)')}"></div>
      </div>
      ${b.rollover && b.carry !== 0 ? `<p class="ledger-meta budget-rollover-note">${b.carry > 0 ? t('budgets.rolloverCredit', { amt: formatMoney(b.carry) }) : t('budgets.rolloverDebit', { amt: formatMoney(Math.abs(b.carry)) })}</p>` : ''}
      <div class="budget-foot">
        <span class="ledger-meta">${b.overBudget ? t('budgets.overBy', { amt: formatMoney(Math.abs(b.remaining)) }) : t('budgets.remaining', { amt: formatMoney(b.remaining) })}</span>
        <div class="budget-actions">
          <button class="icon-btn ${b.rollover ? 'active' : ''}" data-action="toggle-budget-rollover" data-id="${b.id}" data-next="${b.rollover ? '0' : '1'}" aria-label="${t('budgets.rolloverToggle')}" title="${b.rollover ? t('budgets.rolloverOnHint') : t('budgets.rolloverOffHint')}">↻</button>
          <button class="icon-btn danger" data-action="delete-budget" data-id="${b.id}" aria-label="Delete">✕</button>
        </div>
      </div>
    </div>
  `).join('');
}

/* ---------------- Savings Goals page ---------------- */

async function renderSavingsGoals() {
  const goals = await getSavingsGoalsWithProgress();
  const el = document.getElementById('savingsgoal-list');
  if (goals.length === 0) {
    el.innerHTML = `<p class="empty-note">${t('savingsGoals.empty')}</p>`;
    return;
  }
  el.innerHTML = goals.map(g => `
    <div class="panel budget-card" data-id="${g.id}">
      <div class="breakdown-top">
        <span>${escapeHtml(g.name)}</span>
        <span>${formatMoney(g.current)} ${t('budgets.of')} ${formatMoney(g.targetAmount)}</span>
      </div>
      <div class="breakdown-bar-track">
        <div class="breakdown-bar-fill ${g.achieved ? 'achieved' : ''}" style="width:${g.percent}%; background:${g.achieved ? 'var(--income)' : 'var(--gold)'}"></div>
      </div>
      <p class="ledger-meta">${g.account ? escapeHtml(g.account.name) : '—'}${g.targetDate ? ' · ' + t('savingsGoals.byDate', { date: formatUKDate(g.targetDate) }) : ''}</p>
      <div class="budget-foot">
        <span class="ledger-meta">${g.achieved ? t('savingsGoals.reached') : t('savingsGoals.remaining', { amt: formatMoney(g.remaining) })}</span>
        <button class="icon-btn danger" data-action="delete-savingsgoal" data-id="${g.id}" aria-label="Delete">✕</button>
      </div>
    </div>
  `).join('');
}

/* ---------------- Trends page ---------------- */

function monthShortLabel(monthStr) {
  const [y, m] = monthStr.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString(currentLang === 'es' ? 'es-ES' : undefined, { month: 'short' });
}

async function renderTrends() {
  const months = await getMonthlyTrends(6);
  const chartEl = document.getElementById('trend-chart');
  const listEl = document.getElementById('trend-list');

  const max = Math.max(1, ...months.map(m => Math.max(m.income, m.expense)));

  if (months.every(m => m.income === 0 && m.expense === 0)) {
    chartEl.innerHTML = `<p class="empty-note">${t('trends.empty')}</p>`;
  } else {
    chartEl.innerHTML = months.map(m => `
      <div class="trend-month">
        <div class="trend-bars">
          <div class="trend-bar income" style="height:${(m.income / max) * 100}%" title="${t('trends.income')}: ${formatMoney(m.income)}"></div>
          <div class="trend-bar expense" style="height:${(m.expense / max) * 100}%" title="${t('trends.expenses')}: ${formatMoney(m.expense)}"></div>
        </div>
        <span class="trend-month-label">${monthShortLabel(m.month)}</span>
      </div>
    `).join('');
  }

  listEl.innerHTML = months.map(m => `
    <div class="trend-row">
      <span class="trend-name">${escapeHtml(monthLabel(m.month))}</span>
      <span class="trend-figures">
        <span class="ledger-amount income">+${formatMoney(m.income)}</span>
        <span class="ledger-amount expense">-${formatMoney(m.expense)}</span>
        <span class="ledger-amount ${m.net >= 0 ? 'income' : 'expense'}">${formatMoney(m.net)}</span>
      </span>
    </div>
  `).join('');
}

/* ---------------- Net worth page ---------------- */

async function renderNetWorth() {
  const today = new Date().toISOString().slice(0, 10);
  const [current, history] = await Promise.all([
    getNetWorthAsOf(today),
    getNetWorthTrend(6)
  ]);

  document.getElementById('nw-assets').textContent = formatMoney(current.assets);
  document.getElementById('nw-liabilities').textContent = formatMoney(current.liabilities);
  document.getElementById('nw-total').textContent = formatMoney(current.netWorth);

  const chartEl = document.getElementById('networth-chart');
  const max = Math.max(1, ...history.map(h => Math.abs(h.netWorth)));

  const flatNoteEl = document.getElementById('networth-flat-note');
  const isEmpty = history.every(h => h.assets === 0 && h.liabilities === 0);
  const isFlat = !isEmpty && new Set(history.map(h => h.netWorth)).size === 1;

  if (isEmpty) {
    chartEl.innerHTML = `<p class="empty-note">${t('networth.empty')}</p>`;
    flatNoteEl.style.display = 'none';
  } else {
    chartEl.innerHTML = history.map(h => `
      <div class="trend-month">
        <div class="trend-bars">
          <div class="trend-bar networth" style="height:${Math.max(0, (h.netWorth / max) * 100)}%" title="${t('networth.netWorth')}: ${formatMoney(h.netWorth)}">
            <span class="trend-bar-value">${formatMoney(h.netWorth)}</span>
          </div>
        </div>
        <span class="trend-month-label">${monthShortLabel(h.month)}</span>
      </div>
    `).join('');
    flatNoteEl.textContent = isFlat ? t('networth.flatDataNote') : '';
    flatNoteEl.style.display = isFlat ? '' : 'none';
  }

  document.getElementById('networth-list').innerHTML = history.map(h => `
    <div class="trend-row">
      <span class="trend-name">${escapeHtml(monthLabel(h.month))}</span>
      <span class="trend-figures">
        <span class="ledger-amount income">${formatMoney(h.assets)}</span>
        <span class="ledger-amount expense">${formatMoney(h.liabilities)}</span>
        <span class="ledger-amount ${h.netWorth >= 0 ? 'income' : 'expense'}">${formatMoney(h.netWorth)}</span>
      </span>
    </div>
  `).join('');
}

/* ---------------- Categories page ---------------- */

async function renderCategories() {
  const categories = await getCategories();
  const el = document.getElementById('category-list');
  if (categories.length === 0) {
    el.innerHTML = `<p class="empty-note">${t('categories.empty')}</p>`;
    return;
  }
  el.innerHTML = categories.map(c => `
    <div class="tag-chip">
      <span class="tag-dot" style="background:${c.color}"></span>
      <span>${escapeHtml(c.name)}</span>
      <span class="ledger-meta">${c.kind === 'income' ? t('common.income') : t('common.expense')}</span>
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
    current: t('accounts.typeCurrent'),
    savings: t('accounts.typeSavings'),
    isa: t('accounts.typeIsa'),
    credit: t('accounts.typeCredit'),
    cash: t('accounts.typeCash'),
    bank: t('accounts.typeCurrent'),
    card: t('accounts.typeCredit')
  };
  return labels[type] || type;
}

// Small distinct icon per account type, shown on Accounts page cards.
function accountTypeIcon(type) {
  const icons = {
    current: '<path d="M3 10l9-6 9 6"/><rect x="5" y="10" width="14" height="9" rx="1"/><line x1="5" y1="19" x2="19" y2="19"/>',
    savings: '<ellipse cx="12" cy="8" rx="7" ry="3"/><path d="M5 8v8c0 1.7 3.1 3 7 3s7-1.3 7-3V8"/><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
    isa: '<path d="M12 3l7 3v6c0 4-3 7-7 8-4-1-7-4-7-8V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
    credit: '<rect x="3" y="6" width="18" height="12" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>',
    cash: '<rect x="2" y="7" width="20" height="10" rx="1.5"/><circle cx="12" cy="12" r="2.5"/>'
  };
  const key = (type === 'bank') ? 'current' : (type === 'card') ? 'credit' : type;
  const path = icons[key] || icons.current;
  return `<svg class="acc-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">${path}</svg>`;
}

async function renderAccounts() {
  const accounts = await getAccounts();
  const el = document.getElementById('account-list');
  if (accounts.length === 0) {
    el.innerHTML = `<p class="empty-note">${t('accounts.empty')}</p>`;
    return;
  }
  const cards = await Promise.all(accounts.map(async a => {
    const balance = await getAccountBalance(a.id);
    return `
      <div class="account-card">
        ${accountTypeIcon(a.type)}
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
      <h2>${t('sync.setupHeading')}</h2>
      <p class="sub">${t('sync.setupBody')}</p>
      <div class="form-field">
        <label>${t('sync.passphraseLabel')}</label>
        <input type="password" id="sync-passphrase" placeholder="At least 8 characters" />
      </div>
      <div class="form-field">
        <label>${t('sync.confirmLabel')}</label>
        <input type="password" id="sync-passphrase-confirm" placeholder="Type it again" />
      </div>
      <div class="form-actions" style="justify-content:flex-start">
        <button class="btn-primary" data-action="setup-sync">${t('sync.setupButton')}</button>
      </div>
      <p class="empty-note" id="sync-note" style="display:none;margin-top:14px"></p>
    `;
  } else {
    const lastSyncedText = status.lastSynced ? formatUKDateTime(status.lastSynced) : t('sync.never');
    el.innerHTML = `
      <h2>${t('sync.heading')}</h2>
      <p class="sub">${t('sync.linkedBody')}</p>
      <p class="ledger-meta">${t('sync.lastSynced')}: ${escapeHtml(lastSyncedText)}</p>
      <div class="form-actions" style="justify-content:flex-start;margin-top:14px">
        <button class="btn-primary" data-action="sync-now">${t('sync.syncNow')}</button>
        <button class="btn-secondary" data-action="forget-sync">${t('sync.forget')}</button>
      </div>
      <p class="empty-note" id="sync-note" style="display:none;margin-top:14px"></p>
    `;
  }
}

/* ---------------- Settings page ---------------- */

function settingsRowHtml({ key, label, checked, isFirst, isLast, group }) {
  return `
    <div class="settings-row">
      <label class="settings-check">
        <input type="checkbox" data-action="toggle-${group}-visible" data-key="${key}" ${checked ? 'checked' : ''} />
        <span>${escapeHtml(label)}</span>
      </label>
      <div class="settings-move">
        <button class="icon-btn" data-action="move-${group}-up" data-key="${key}" aria-label="Move up" ${isFirst ? 'disabled' : ''}>↑</button>
        <button class="icon-btn" data-action="move-${group}-down" data-key="${key}" aria-label="Move down" ${isLast ? 'disabled' : ''}>↓</button>
      </div>
    </div>
  `;
}

function renderSettingsPage() {
  const navSettings = getNavSettings();
  const navById = Object.fromEntries(NAV_REGISTRY.map(i => [i.id, i]));
  const navIds = navSettings.order.filter(id => navById[id]);
  NAV_DEFAULT_ORDER.forEach(id => { if (!navIds.includes(id)) navIds.push(id); });

  document.getElementById('settings-nav-list').innerHTML = navIds.map((id, i) => settingsRowHtml({
    key: id,
    label: t(navById[id].labelKey),
    checked: !navSettings.hidden.includes(id),
    isFirst: i === 0,
    isLast: i === navIds.length - 1,
    group: 'nav'
  })).join('');

  const dashSettings = getDashboardSettings();
  const dashById = Object.fromEntries(DASHBOARD_REGISTRY.map(p => [p.id, p]));
  const dashIds = dashSettings.order.filter(id => dashById[id]);
  DASHBOARD_DEFAULT_ORDER.forEach(id => { if (!dashIds.includes(id)) dashIds.push(id); });

  document.getElementById('settings-dashboard-list').innerHTML = dashIds.map((id, i) => settingsRowHtml({
    key: id,
    label: t(dashById[id].labelKey),
    checked: !dashSettings.hidden.includes(id),
    isFirst: i === 0,
    isLast: i === dashIds.length - 1,
    group: 'dashboard'
  })).join('');

  const customColors = getCustomColors();
  document.getElementById('settings-colors-list').innerHTML = THEME_COLOR_REGISTRY.map(c => `
    <div class="settings-row">
      <span>${escapeHtml(t(c.labelKey))}</span>
      <input type="color" data-action="set-colour" data-key="${c.key}" value="${customColors[c.key] || c.fallback}" />
    </div>
  `).join('');
}

/* ---------------- Share summaries ----------------
   Deliberately share a rollup, not a line-by-line dump — especially for
   Transactions, where sharing every individual entry by default would be
   an easy way to overshare in a privacy-focused app. Full detail is still
   available via CSV export, which the user has to deliberately choose.
*/

function buildNetWorthShareText(current, history) {
  const todayStr = formatUKDate(new Date().toISOString().slice(0, 10));
  let text = `My net worth as of ${todayStr}: ${formatMoney(current.netWorth)}\n`;
  text += `Assets: ${formatMoney(current.assets)} · Liabilities: ${formatMoney(current.liabilities)}\n`;
  if (history.length >= 2) {
    const diff = history[history.length - 1].netWorth - history[0].netWorth;
    text += `${diff >= 0 ? 'Up' : 'Down'} ${formatMoney(Math.abs(diff))} over the last ${history.length} months\n`;
  }
  return text + '— via Budgeter';
}

function buildBudgetsShareText(budgets) {
  if (budgets.length === 0) return 'No budgets set up yet — via Budgeter';
  let text = `My budgets for ${monthLabel(currentMonthStr())}:\n`;
  budgets.forEach(b => {
    const name = b.category ? b.category.name : 'Uncategorised';
    text += `• ${name}: ${formatMoney(b.spent)} of ${formatMoney(b.limit)}${b.overBudget ? ' (over budget)' : ''}\n`;
  });
  return text + '— via Budgeter';
}

function buildTransactionsShareText(entries) {
  const txOnly = entries.filter(e => e.entryType === 'transaction');
  const income = txOnly.filter(t => t.kind === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = txOnly.filter(t => t.kind === 'expense').reduce((s, t) => s + t.amount, 0);
  let text = `Transactions summary (${txOnly.length} entr${txOnly.length === 1 ? 'y' : 'ies'}):\n`;
  text += `Income: ${formatMoney(income)} · Expenses: ${formatMoney(expense)} · Net: ${formatMoney(income - expense)}\n`;
  return text + '— via Budgeter';
}

/* ---------------- CSV export/import (Transactions) ---------------- */

function csvEscape(value) {
  const str = String(value === undefined || value === null ? '' : value);
  if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

// Minimal CSV parser: handles quoted fields (with embedded commas/quotes/newlines).
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function transactionsToCSV(txs, categories, accounts) {
  const header = ['Date', 'Type', 'Amount', 'Account', 'Category', 'Note'];
  const rows = txs.map(t => {
    const cat = categories.find(c => c.id === t.categoryId);
    const acc = accounts.find(a => a.id === t.accountId);
    return [
      t.date,
      t.kind === 'income' ? 'Income' : 'Expense',
      t.amount.toFixed(2),
      acc ? acc.name : '',
      cat ? cat.name : '',
      t.note || ''
    ];
  });
  return [header, ...rows].map(r => r.map(csvEscape).join(',')).join('\r\n');
}

// Parses a CSV in the same shape transactionsToCSV produces. Rows referencing
// an account/category name that doesn't exist are skipped (not auto-created),
// and returned separately with a reason so the user can see what happened.
function parseTransactionsCSV(text, categories, accounts) {
  const rows = parseCSV(text.trim());
  if (rows.length === 0) return { imported: [], skipped: [] };
  const dataRows = rows.slice(1); // drop header row
  const imported = [];
  const skipped = [];

  for (const row of dataRows) {
    if (row.length <= 1 && (row[0] || '').trim() === '') continue;
    const [date, typeStr, amountStr, accountName, categoryName, note] = row;
    const kind = (typeStr || '').trim().toLowerCase() === 'income' ? 'income' : 'expense';
    const amount = Number((amountStr || '').replace(/,/g, ''));
    const account = accounts.find(a => a.name.toLowerCase() === (accountName || '').trim().toLowerCase());
    const category = categories.find(c => c.name.toLowerCase() === (categoryName || '').trim().toLowerCase());

    if (!date || !amount || amount <= 0) {
      skipped.push({ row, reason: 'Invalid date or amount' });
    } else if (!account) {
      skipped.push({ row, reason: `Unknown account "${accountName}"` });
    } else if (!category) {
      skipped.push({ row, reason: `Unknown category "${categoryName}"` });
    } else {
      imported.push({ date: date.trim(), amount, kind, accountId: account.id, categoryId: category.id, note: (note || '').trim() });
    }
  }
  return { imported, skipped };
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
