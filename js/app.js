/*
  app.js
  ------
  Wires up clicks/forms to the db.js functions and render.js functions.
*/

let currentView = 'dashboard';

/* ---------------- Press-and-hold drag reorder (Accounts + Dashboard) ----------------
   Generic, dependency-free reordering: press and hold a `.drag-handle` for
   HOLD_MS without moving more than MOVE_CANCEL_PX, then drag to reposition
   the item within its container. Only the handle itself starts a drag —
   everything else on the card/panel (edit/delete buttons, links) works
   exactly as before, untouched. Built on Pointer Events so the same code
   handles mouse (desktop) and touch (mobile) — `touch-action: none` on
   `.drag-handle` (see styles.css) stops the browser trying to scroll the
   page once a drag actually starts.

   The dragged item becomes a `position: fixed` "ghost" that tracks the
   pointer directly (no lag, no lower-frequency reflow), leaving a
   same-sized placeholder behind to mark its slot. Other items animate
   into their new positions with the FLIP technique (record each item's
   position before the placeholder moves, let the browser reflow, then
   play a transform transition from the old position to the new one) —
   this is what makes the tiles visibly slide out of the way instead of
   snapping.
*/
function enableDragReorder(container, itemSelector, getKey, onReorder) {
  if (!container) return;
  const HOLD_MS = 250;
  const MOVE_CANCEL_PX = 8;
  // How close to the top/bottom of the screen (in px) before the page starts
  // auto-scrolling, and how fast it scrolls right at the very edge. Bottom
  // zone is bigger to comfortably clear the fixed bottom nav bar on mobile.
  const EDGE_ZONE_TOP = 70;
  const EDGE_ZONE_BOTTOM = 110;
  const MAX_SCROLL_SPEED = 16;

  let pressTimer = null;
  let dragEl = null;
  let placeholder = null;
  let startX = 0, startY = 0;
  let grabOffsetX = 0, grabOffsetY = 0;
  let lastClientX = 0, lastClientY = 0;
  let autoScrollRAF = null;

  const cancelPress = () => { clearTimeout(pressTimer); pressTimer = null; };

  function autoScrollStep() {
    if (!dragEl) { autoScrollRAF = null; return; }
    let dy = 0;
    if (lastClientY < EDGE_ZONE_TOP) {
      dy = -MAX_SCROLL_SPEED * (1 - lastClientY / EDGE_ZONE_TOP);
    } else if (lastClientY > window.innerHeight - EDGE_ZONE_BOTTOM) {
      dy = MAX_SCROLL_SPEED * (1 - (window.innerHeight - lastClientY) / EDGE_ZONE_BOTTOM);
    }
    if (dy) {
      window.scrollBy(0, dy);
      // The pointer hasn't moved, but the page has — the item under it and
      // everyone's on-screen position changed, so re-evaluate the drop spot.
      movePlaceholder(lastClientX, lastClientY);
    }
    autoScrollRAF = requestAnimationFrame(autoScrollStep);
  }

  function captureRects() {
    const map = new Map();
    container.querySelectorAll(itemSelector).forEach(item => map.set(item, item.getBoundingClientRect()));
    return map;
  }

  function flipAnimate(prevRects) {
    container.querySelectorAll(itemSelector).forEach(item => {
      const prev = prevRects.get(item);
      if (!prev) return;
      const now = item.getBoundingClientRect();
      const dx = prev.left - now.left, dy = prev.top - now.top;
      if (!dx && !dy) return;
      item.style.transition = 'none';
      item.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        item.style.transition = 'transform 0.2s ease';
        item.style.transform = '';
      });
    });
  }

  function movePlaceholder(clientX, clientY) {
    const items = Array.from(container.querySelectorAll(itemSelector)).filter(i => i !== placeholder);
    // Grid-aware: account cards can sit side by side (multi-column grid),
    // dashboard panels are always full-width (effectively single column).
    // Find whichever item's center the pointer is nearest to, then decide
    // before/after using whichever axis actually distinguishes items —
    // horizontal if the pointer is roughly level with that item (same
    // row), vertical otherwise.
    let closest = null, closestDist = Infinity;
    for (const item of items) {
      const rect = item.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      const dist = (clientX - cx) ** 2 + (clientY - cy) ** 2;
      if (dist < closestDist) { closestDist = dist; closest = { item, rect, cx, cy }; }
    }
    const prevRects = captureRects();
    if (closest) {
      const sameRow = Math.abs(clientY - closest.cy) < closest.rect.height / 2;
      const after = sameRow ? clientX > closest.cx : clientY > closest.cy;
      if (after) closest.item.after(placeholder);
      else closest.item.before(placeholder);
    } else {
      container.appendChild(placeholder);
    }
    flipAnimate(prevRects);
  }

  const endDrag = () => {
    cancelPress();
    if (autoScrollRAF) { cancelAnimationFrame(autoScrollRAF); autoScrollRAF = null; }
    if (!dragEl) return;
    document.body.classList.remove('dragging-active');

    dragEl.classList.remove('dragging');
    dragEl.style.position = '';
    dragEl.style.left = '';
    dragEl.style.top = '';
    dragEl.style.width = '';
    dragEl.style.height = '';
    dragEl.style.zIndex = '';
    dragEl.style.pointerEvents = '';

    placeholder.replaceWith(dragEl);
    placeholder = null;

    const newOrder = Array.from(container.querySelectorAll(itemSelector)).map(getKey);
    dragEl = null;
    onReorder(newOrder);
  };

  container.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.drag-handle');
    if (!handle) return;
    const item = handle.closest(itemSelector);
    if (!item) return;
    startX = e.clientX; startY = e.clientY;
    cancelPress();
    pressTimer = setTimeout(() => {
      const rect = item.getBoundingClientRect();
      grabOffsetX = startX - rect.left;
      grabOffsetY = startY - rect.top;

      placeholder = document.createElement('div');
      placeholder.className = 'drag-placeholder';
      placeholder.style.width = rect.width + 'px';
      placeholder.style.height = rect.height + 'px';
      item.after(placeholder);

      dragEl = item;
      dragEl.classList.add('dragging');
      dragEl.style.position = 'fixed';
      dragEl.style.left = rect.left + 'px';
      dragEl.style.top = rect.top + 'px';
      dragEl.style.width = rect.width + 'px';
      dragEl.style.height = rect.height + 'px';
      dragEl.style.zIndex = '999';
      dragEl.style.pointerEvents = 'none';
      document.body.classList.add('dragging-active');
      lastClientX = startX; lastClientY = startY;
      autoScrollRAF = requestAnimationFrame(autoScrollStep);

      try { handle.setPointerCapture(e.pointerId); } catch (err) { /* not critical */ }
    }, HOLD_MS);
  });

  container.addEventListener('pointermove', (e) => {
    if (dragEl) {
      e.preventDefault();
      lastClientX = e.clientX; lastClientY = e.clientY;
      dragEl.style.left = (e.clientX - grabOffsetX) + 'px';
      dragEl.style.top = (e.clientY - grabOffsetY) + 'px';
      movePlaceholder(e.clientX, e.clientY);
      return;
    }
    if (pressTimer && (Math.abs(e.clientX - startX) > MOVE_CANCEL_PX || Math.abs(e.clientY - startY) > MOVE_CANCEL_PX)) {
      cancelPress();
    }
  });

  container.addEventListener('pointerup', endDrag);
  container.addEventListener('pointercancel', endDrag);
}

/* ---------------- Theme toggle ---------------- */

function applyThemeIcon() {
  const isLight = document.documentElement.dataset.theme === 'light';
  document.getElementById('theme-icon-dark').style.display = isLight ? 'none' : '';
  document.getElementById('theme-icon-light').style.display = isLight ? '' : 'none';
}
applyThemeIcon();

document.getElementById('theme-toggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('budgeter_theme', next);
  applyThemeIcon();
});

/* ---------------- Language toggle ---------------- */

function updateLangToggleLabel() {
  document.getElementById('lang-toggle').textContent = currentLang === 'en' ? 'ES' : 'EN';
}
document.documentElement.lang = currentLang;
updateLangToggleLabel();

document.getElementById('lang-toggle').addEventListener('click', () => {
  const next = currentLang === 'en' ? 'es' : 'en';
  document.documentElement.lang = next;
  setLanguage(next);
  updateLangToggleLabel();
});

// Nav buttons are generated by renderNavBar() (settings.js), so their click
// handling is delegated on the container rather than bound per-button.
document.getElementById('nav').addEventListener('click', (e) => {
  const btn = e.target.closest('.nav-btn');
  if (btn) switchView(btn.dataset.view);
});

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
  refreshCurrentView();
}

async function refreshCurrentView() {
  const justPaid = await runAutoPayBills();
  if (justPaid.length === 1) {
    showToast(t('toast.billAutoPaid', { name: justPaid[0].name, amount: formatMoney(justPaid[0].amount) }));
  } else if (justPaid.length > 1) {
    showToast(t('toast.billsAutoPaid', { count: justPaid.length, names: justPaid.map(b => b.name).join(', ') }));
  }

  const justTransferred = await runAutoPayStandingOrders();
  if (justTransferred.length === 1) {
    showToast(t('toast.standingOrderAutoPaid', { name: justTransferred[0].name, amount: formatMoney(justTransferred[0].amount) }));
  } else if (justTransferred.length > 1) {
    showToast(t('toast.standingOrdersAutoPaid', { count: justTransferred.length, names: justTransferred.map(s => s.name).join(', ') }));
  }

  if (currentView === 'dashboard') await renderDashboard();
  if (currentView === 'transactions') await renderTransactions();
  if (currentView === 'bills') await renderBills();
  if (currentView === 'standingorders') await renderStandingOrders();
  if (currentView === 'budgets') await renderBudgets();
  if (currentView === 'savingsgoals') await renderSavingsGoals();
  if (currentView === 'trends') await renderTrends();
  if (currentView === 'networth') await renderNetWorth();
  if (currentView === 'categories') await renderCategories();
  if (currentView === 'accounts') await renderAccounts();
  if (currentView === 'sync') await renderSync();
  if (currentView === 'settings') { renderSettingsPage(); renderAppLockSettings(); }
}

const overlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');

let lastFocusedBeforeModal = null;

function getFocusableInModal() {
  return Array.from(document.querySelectorAll(
    '#modal-overlay.open .modal button, #modal-overlay.open .modal input, #modal-overlay.open .modal select, #modal-overlay.open .modal textarea, #modal-overlay.open .modal [tabindex]'
  )).filter(el => !el.disabled && el.offsetParent !== null);
}

function openModal(title, bodyHtml) {
  lastFocusedBeforeModal = document.activeElement;
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHtml;
  overlay.classList.add('open');
  const focusable = getFocusableInModal();
  if (focusable.length) focusable[0].focus();
}
function closeModal() {
  overlay.classList.remove('open');
  overlay.classList.add('closing');
  if (lastFocusedBeforeModal) lastFocusedBeforeModal.focus();
  setTimeout(() => {
    overlay.classList.remove('closing');
    if (!overlay.classList.contains('open')) modalBody.innerHTML = '';
  }, 150);
}
document.getElementById('modal-close').addEventListener('click', closeModal);
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

/* ---------------- Toasts ---------------- */

function showToast(message) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

/* ---------------- Share ---------------- */

// Uses the OS share sheet where available (mostly mobile); falls back to
// copying the summary to the clipboard, and to an alert as a last resort.
async function shareOrCopy(text, title) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return; // user cancelled the share sheet
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast(t('toast.summaryCopied'));
  } catch (err) {
    alert(text);
  }
}

document.getElementById('btn-share-networth').addEventListener('click', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const [current, history] = await Promise.all([getNetWorthAsOf(today), getNetWorthTrend(6)]);
  await shareOrCopy(buildNetWorthShareText(current, history), 'My net worth — Budgeter');
});

document.getElementById('btn-share-budgets').addEventListener('click', async () => {
  const budgets = await getBudgetsWithProgress(currentMonthStr());
  await shareOrCopy(buildBudgetsShareText(budgets), 'My budgets — Budgeter');
});

document.getElementById('btn-share-transactions').addEventListener('click', async () => {
  const [txs, transfers] = await Promise.all([getTransactions(), getTransfers()]);
  const accId = document.getElementById('filter-account').value;
  const catId = document.getElementById('filter-category').value;
  const month = document.getElementById('filter-month').value;
  let entries = combineLedgerEntries(txs, transfers);
  if (accId) {
    const id = Number(accId);
    entries = entries.filter(e => e.entryType === 'transaction' ? e.accountId === id : (e.fromAccountId === id || e.toAccountId === id));
  }
  if (catId) entries = entries.filter(e => e.entryType === 'transaction' && e.categoryId === Number(catId));
  if (month) entries = entries.filter(e => e.date.startsWith(month));
  await shareOrCopy(buildTransactionsShareText(entries), 'My transactions summary — Budgeter');
});

// Esc closes the modal; Tab/Shift+Tab is trapped inside it while open.
document.addEventListener('keydown', (e) => {
  if (!overlay.classList.contains('open')) return;
  if (e.key === 'Escape') {
    closeModal();
    return;
  }
  if (e.key === 'Tab') {
    const focusable = getFocusableInModal();
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});

/* ---------------- Add Transaction ---------------- */

document.getElementById('btn-add-transaction').addEventListener('click', async () => {
  const categories = await getCategories();
  const accounts = await getAccounts();

  if (accounts.length === 0) {
    openModal('Add an account first', `<p class="empty-note">You need at least one account (e.g. "Cash") before adding transactions.</p>
      <div class="form-actions"><button class="btn-primary" id="go-add-account">Add account</button></div>`);
    document.getElementById('go-add-account').addEventListener('click', () => {
      closeModal();
      switchView('accounts');
      document.getElementById('btn-add-account').click();
    });
    return;
  }
  if (categories.length === 0) {
    openModal('Add a category first', `<p class="empty-note">You need at least one category (e.g. "Groceries") before adding transactions.</p>
      <div class="form-actions"><button class="btn-primary" id="go-add-category">Add category</button></div>`);
    document.getElementById('go-add-category').addEventListener('click', () => {
      closeModal();
      switchView('categories');
      document.getElementById('btn-add-category').click();
    });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  openModal(t('modalTitle.addTransaction'), `
    <div class="kind-toggle" id="tx-kind-toggle">
      <button type="button" class="selected expense" data-kind="expense">Expense</button>
      <button type="button" class="income" data-kind="income">Income</button>
    </div>
    <div class="form-field" style="margin-top:14px">
      <label>Amount</label>
      <input type="number" step="0.01" min="0" id="tx-amount" placeholder="0.00" />
    </div>
    <div class="form-field">
      <label>Note</label>
      <input type="text" id="tx-note" placeholder="e.g. Tesco weekly shop" />
      <p class="ledger-meta" id="tx-transfer-hint" style="display:none"></p>
    </div>
    <div class="form-row">
      <div class="form-field">
        <label>Account</label>
        <select id="tx-account">${accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('')}</select>
      </div>
      <div class="form-field">
        <label>Category</label>
        <select id="tx-category">${categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
      </div>
    </div>
    <div class="form-field">
      <label>Date</label>
      <input type="date" id="tx-date" value="${today}" />
    </div>
    <div class="form-actions">
      <button class="btn-secondary" id="tx-cancel">Cancel</button>
      <button class="btn-primary" id="tx-save">Save</button>
    </div>
  `);

  let selectedKind = 'expense';
  document.getElementById('tx-kind-toggle').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    selectedKind = btn.dataset.kind;
    document.querySelectorAll('#tx-kind-toggle button').forEach(b => b.classList.toggle('selected', b === btn));
  });

  // Nudge: if the note mentions the name of a DIFFERENT account of the
  // user's own, this is likely money moving between their own accounts
  // (e.g. a credit card repayment) rather than real income/spending — a
  // Transaction can't credit a second account, only + Transfer can.
  const noteInput = document.getElementById('tx-note');
  const accountSelect = document.getElementById('tx-account');
  const transferHint = document.getElementById('tx-transfer-hint');
  const checkTransferHint = () => {
    const note = noteInput.value.trim().toLowerCase();
    const selectedAccountId = Number(accountSelect.value);
    const match = note && accounts.find(a => a.id !== selectedAccountId && note.includes(a.name.toLowerCase()));
    transferHint.textContent = match ? t('transactions.transferHint', { name: match.name }) : '';
    transferHint.style.display = match ? '' : 'none';
  };
  noteInput.addEventListener('input', checkTransferHint);
  accountSelect.addEventListener('change', checkTransferHint);

  document.getElementById('tx-cancel').addEventListener('click', closeModal);
  document.getElementById('tx-save').addEventListener('click', async () => {
    const amount = document.getElementById('tx-amount').value;
    if (!amount || Number(amount) <= 0) { alert('Enter an amount greater than 0.'); return; }

    await addTransaction({
      date: document.getElementById('tx-date').value || today,
      amount,
      kind: selectedKind,
      accountId: document.getElementById('tx-account').value,
      categoryId: document.getElementById('tx-category').value,
      note: document.getElementById('tx-note').value.trim()
    });
    closeModal();
    refreshCurrentView();
    showToast(t('toast.transactionAdded'));
  });
});

/* ---------------- Add Transfer ---------------- */

document.getElementById('btn-add-transfer').addEventListener('click', async () => {
  const accounts = await getAccounts();

  if (accounts.length < 2) {
    openModal('Add another account first', `<p class="empty-note">You need at least two accounts to transfer money between them.</p>
      <div class="form-actions"><button class="btn-primary" id="go-add-account-2">Add account</button></div>`);
    document.getElementById('go-add-account-2').addEventListener('click', () => {
      closeModal();
      switchView('accounts');
      document.getElementById('btn-add-account').click();
    });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  openModal(t('modalTitle.addTransfer'), `
    <div class="form-row">
      <div class="form-field">
        <label>From</label>
        <select id="tr-from">${accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('')}</select>
      </div>
      <div class="form-field">
        <label>To</label>
        <select id="tr-to">${accounts.map((a, i) => `<option value="${a.id}" ${i === 1 ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}</select>
      </div>
    </div>
    <div class="form-field">
      <label>Amount</label>
      <input type="number" step="0.01" min="0" id="tr-amount" placeholder="0.00" />
    </div>
    <div class="form-field">
      <label>Note (optional)</label>
      <input type="text" id="tr-note" placeholder="e.g. Moving to savings" />
    </div>
    <div class="form-field">
      <label>Date</label>
      <input type="date" id="tr-date" value="${today}" />
    </div>
    <div class="form-actions">
      <button class="btn-secondary" id="tr-cancel">Cancel</button>
      <button class="btn-primary" id="tr-save">Save</button>
    </div>
  `);

  document.getElementById('tr-cancel').addEventListener('click', closeModal);
  document.getElementById('tr-save').addEventListener('click', async () => {
    const amount = document.getElementById('tr-amount').value;
    const fromAccountId = document.getElementById('tr-from').value;
    const toAccountId = document.getElementById('tr-to').value;
    if (!amount || Number(amount) <= 0) { alert('Enter an amount greater than 0.'); return; }
    if (fromAccountId === toAccountId) { alert('Choose two different accounts.'); return; }

    await addTransfer({
      date: document.getElementById('tr-date').value || today,
      amount,
      fromAccountId,
      toAccountId,
      note: document.getElementById('tr-note').value.trim()
    });
    closeModal();
    refreshCurrentView();
    showToast(t('toast.transferAdded'));
  });
});

/* ---------------- CSV export/import (Transactions) ---------------- */

document.getElementById('btn-export-csv').addEventListener('click', async () => {
  const [txs, categories, accounts] = await Promise.all([getTransactions(), getCategories(), getAccounts()]);
  if (txs.length === 0) { alert('No transactions to export yet.'); return; }

  const csv = transactionsToCSV(txs, categories, accounts);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `budgeter-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast(t('toast.csvExported'));
});

document.getElementById('btn-import-csv').addEventListener('click', () => {
  document.getElementById('csv-file-input').click();
});

document.getElementById('csv-file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = ''; // allow re-selecting the same file later
  if (!file) return;

  const text = await file.text();
  const [categories, accounts] = await Promise.all([getCategories(), getAccounts()]);
  const { imported, skipped } = parseTransactionsCSV(text, categories, accounts);

  for (const tx of imported) {
    await addTransaction(tx);
  }
  refreshCurrentView();

  if (skipped.length === 0) {
    showToast(`Imported ${imported.length} transaction${imported.length === 1 ? '' : 's'}.`);
  } else {
    const reasons = skipped.slice(0, 5).map(s => `• ${s.reason}`).join('\n');
    const more = skipped.length > 5 ? `\n…and ${skipped.length - 5} more` : '';
    alert(`Imported ${imported.length} transaction${imported.length === 1 ? '' : 's'}.\n\nSkipped ${skipped.length} row${skipped.length === 1 ? '' : 's'}:\n${reasons}${more}`);
  }
});

/* ---------------- Add Category ---------------- */

const CATEGORY_COLORS = ['#C9A227', '#5FB88A', '#C1543C', '#7C93C9', '#B37FC4', '#D68C45'];

// A sensible generic starter set, added on demand via "+ Add starter
// categories" rather than seeded automatically — keeps the existing
// "+ Add category" flow fully available for custom ones alongside these.
const STARTER_CATEGORIES = {
  en: [
    { name: 'Salary/Wages', kind: 'income' },
    { name: 'Interest', kind: 'income' },
    { name: 'Refunds', kind: 'income' },
    { name: 'Other income', kind: 'income' },
    { name: 'Groceries', kind: 'expense' },
    { name: 'Rent/Mortgage', kind: 'expense' },
    { name: 'Utilities', kind: 'expense' },
    { name: 'Council Tax', kind: 'expense' },
    { name: 'Transport', kind: 'expense' },
    { name: 'Insurance', kind: 'expense' },
    { name: 'Subscriptions', kind: 'expense' },
    { name: 'Phone/Internet', kind: 'expense' },
    { name: 'Eating out', kind: 'expense' },
    { name: 'Shopping', kind: 'expense' },
    { name: 'Health/Personal care', kind: 'expense' },
    { name: 'Debt repayment', kind: 'expense' },
    { name: 'Gifts/Charity', kind: 'expense' },
    { name: 'Miscellaneous', kind: 'expense' }
  ],
  es: [
    { name: 'Salario/Sueldo', kind: 'income' },
    { name: 'Intereses', kind: 'income' },
    { name: 'Reembolsos', kind: 'income' },
    { name: 'Otros ingresos', kind: 'income' },
    { name: 'Alimentación', kind: 'expense' },
    { name: 'Alquiler/Hipoteca', kind: 'expense' },
    { name: 'Servicios', kind: 'expense' },
    { name: 'Impuesto municipal', kind: 'expense' },
    { name: 'Transporte', kind: 'expense' },
    { name: 'Seguros', kind: 'expense' },
    { name: 'Suscripciones', kind: 'expense' },
    { name: 'Teléfono/Internet', kind: 'expense' },
    { name: 'Comer fuera', kind: 'expense' },
    { name: 'Compras', kind: 'expense' },
    { name: 'Salud/Cuidado personal', kind: 'expense' },
    { name: 'Pago de deudas', kind: 'expense' },
    { name: 'Regalos/Caridad', kind: 'expense' },
    { name: 'Varios', kind: 'expense' }
  ]
};

document.getElementById('btn-add-starter-categories').addEventListener('click', async () => {
  const existing = await getCategories();
  const existingNames = new Set(existing.map(c => c.name.trim().toLowerCase()));
  const list = STARTER_CATEGORIES[currentLang] || STARTER_CATEGORIES.en;

  let addedCount = 0;
  for (let i = 0; i < list.length; i++) {
    const cat = list[i];
    if (existingNames.has(cat.name.toLowerCase())) continue;
    await addCategory({ name: cat.name, kind: cat.kind, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] });
    addedCount++;
  }

  refreshCurrentView();
  showToast(addedCount > 0
    ? t('toast.starterCategoriesAdded', { count: addedCount })
    : t('toast.starterCategoriesNoneAdded'));
});

document.getElementById('btn-add-category').addEventListener('click', () => {
  openModal(t('modalTitle.addCategory'), `
    <div class="form-field">
      <label>Name</label>
      <input type="text" id="cat-name" placeholder="e.g. Groceries" />
    </div>
    <div class="kind-toggle" id="cat-kind-toggle">
      <button type="button" class="selected expense" data-kind="expense">Expense</button>
      <button type="button" class="income" data-kind="income">Income</button>
    </div>
    <div class="form-field" style="margin-top:14px">
      <label>Colour</label>
      <div style="display:flex;gap:8px">
        ${CATEGORY_COLORS.map((c, i) => `<span class="tag-dot color-swatch" data-color="${c}" style="background:${c};width:24px;height:24px;cursor:pointer;border:2px solid ${i === 0 ? '#fff' : 'transparent'}"></span>`).join('')}
      </div>
    </div>
    <div class="form-actions">
      <button class="btn-secondary" id="cat-cancel">Cancel</button>
      <button class="btn-primary" id="cat-save">Save</button>
    </div>
  `);

  let selectedKind = 'expense';
  let selectedColor = CATEGORY_COLORS[0];

  document.getElementById('cat-kind-toggle').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    selectedKind = btn.dataset.kind;
    document.querySelectorAll('#cat-kind-toggle button').forEach(b => b.classList.toggle('selected', b === btn));
  });

  document.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      selectedColor = sw.dataset.color;
      document.querySelectorAll('.color-swatch').forEach(s => s.style.border = '2px solid transparent');
      sw.style.border = '2px solid #fff';
    });
  });

  document.getElementById('cat-cancel').addEventListener('click', closeModal);
  document.getElementById('cat-save').addEventListener('click', async () => {
    const name = document.getElementById('cat-name').value.trim();
    if (!name) { alert('Enter a category name.'); return; }
    await addCategory({ name, kind: selectedKind, color: selectedColor });
    closeModal();
    refreshCurrentView();
    showToast(t('toast.categoryAdded'));
  });
});

/* ---------------- Add Account ---------------- */

document.getElementById('btn-add-account').addEventListener('click', () => {
  openModal(t('modalTitle.addAccount'), `
    <div class="form-field">
      <label>Name</label>
      <input type="text" id="acc-name" placeholder="e.g. Current account" />
    </div>
    <div class="form-field">
      <label>Type</label>
      <select id="acc-type">
        <option value="current">Current account</option>
        <option value="savings">Savings account</option>
        <option value="isa">ISA</option>
        <option value="credit">Credit card</option>
        <option value="cash">Cash</option>
        <option value="pension">Pension</option>
        <option value="investment">Investment</option>
      </select>
    </div>
    <div class="form-field">
      <label>Starting balance</label>
      <input type="number" step="0.01" id="acc-balance" placeholder="0.00" />
    </div>
    <div class="form-field" id="acc-credit-limit-field" style="display:none">
      <label>${t('accounts.creditLimitLabel')}</label>
      <input type="number" step="0.01" min="0" id="acc-credit-limit" placeholder="0.00" />
    </div>
    <div class="form-field" id="acc-repayment-day-field" style="display:none">
      <label>${t('accounts.repaymentDueDayLabel')}</label>
      <input type="number" min="1" max="31" id="acc-repayment-day" placeholder="e.g. 21" />
      <p class="ledger-meta">${t('accounts.repaymentDueDayHint')}</p>
    </div>
    <div class="form-actions">
      <button class="btn-secondary" id="acc-cancel">Cancel</button>
      <button class="btn-primary" id="acc-save">Save</button>
    </div>
  `);

  const typeSelect = document.getElementById('acc-type');
  const limitField = document.getElementById('acc-credit-limit-field');
  const repaymentField = document.getElementById('acc-repayment-day-field');
  const toggleLimitField = () => {
    const isCredit = typeSelect.value === 'credit';
    limitField.style.display = isCredit ? '' : 'none';
    repaymentField.style.display = isCredit ? '' : 'none';
  };
  typeSelect.addEventListener('change', toggleLimitField);
  toggleLimitField();

  document.getElementById('acc-cancel').addEventListener('click', closeModal);
  document.getElementById('acc-save').addEventListener('click', async () => {
    const name = document.getElementById('acc-name').value.trim();
    if (!name) { alert('Enter an account name.'); return; }
    await addAccount({
      name,
      type: typeSelect.value,
      startingBalance: document.getElementById('acc-balance').value || 0,
      creditLimit: document.getElementById('acc-credit-limit').value,
      repaymentDueDay: document.getElementById('acc-repayment-day').value
    });
    closeModal();
    refreshCurrentView();
    showToast(t('toast.accountAdded'));
  });
});

/* ---------------- Add Bill ---------------- */

document.getElementById('btn-add-bill').addEventListener('click', async () => {
  const categories = await getCategories();
  const accounts = await getAccounts();

  if (accounts.length === 0 || categories.length === 0) {
    openModal('Set up accounts & categories first', `<p class="empty-note">You need at least one account and one category before adding a bill.</p>`);
    return;
  }

  openModal(t('modalTitle.addBill'), `
    <div class="form-field">
      <label>Name</label>
      <input type="text" id="bill-name" placeholder="e.g. Rent, Netflix" />
    </div>
    <div class="form-row">
      <div class="form-field">
        <label>Amount</label>
        <input type="number" step="0.01" min="0" id="bill-amount" placeholder="0.00" />
      </div>
      <div class="form-field">
        <label>Due day of month</label>
        <input type="number" min="1" max="31" id="bill-due-day" placeholder="e.g. 1" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-field">
        <label>Account</label>
        <select id="bill-account">${accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('')}</select>
      </div>
      <div class="form-field">
        <label>Category</label>
        <select id="bill-category">${categories.filter(c => c.kind === 'expense').map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
      </div>
    </div>
    <div class="form-field">
      <label class="settings-check"><input type="checkbox" id="bill-subscription" /> ${t('bills.subscriptionCheckbox')}</label>
    </div>
    <div class="form-actions">
      <button class="btn-secondary" id="bill-cancel">Cancel</button>
      <button class="btn-primary" id="bill-save">Save</button>
    </div>
  `);

  document.getElementById('bill-cancel').addEventListener('click', closeModal);
  document.getElementById('bill-save').addEventListener('click', async () => {
    const name = document.getElementById('bill-name').value.trim();
    const amount = document.getElementById('bill-amount').value;
    const dueDay = document.getElementById('bill-due-day').value;
    if (!name) { alert('Enter a bill name.'); return; }
    if (!amount || Number(amount) <= 0) { alert('Enter an amount greater than 0.'); return; }
    if (!dueDay || dueDay < 1 || dueDay > 31) { alert('Enter a due day between 1 and 31.'); return; }

    await addBill({
      name,
      amount,
      dueDay,
      accountId: document.getElementById('bill-account').value,
      categoryId: document.getElementById('bill-category').value,
      isSubscription: document.getElementById('bill-subscription').checked
    });
    closeModal();
    refreshCurrentView();
    showToast(t('toast.billAdded'));
  });
});

document.getElementById('subscription-filter-toggle').addEventListener('change', (e) => {
  showSubscriptionsOnly = e.target.checked;
  renderBills();
});

/* ---------------- Add Standing Order ---------------- */

document.getElementById('btn-add-standingorder').addEventListener('click', async () => {
  const accounts = await getAccounts();

  if (accounts.length < 2) {
    openModal('Add another account first', `<p class="empty-note">You need at least two accounts to set up a standing order between them.</p>
      <div class="form-actions"><button class="btn-primary" id="go-add-account-3">Add account</button></div>`);
    document.getElementById('go-add-account-3').addEventListener('click', () => {
      closeModal();
      switchView('accounts');
      document.getElementById('btn-add-account').click();
    });
    return;
  }

  openModal(t('modalTitle.addStandingOrder'), `
    <div class="form-field">
      <label>Name</label>
      <input type="text" id="so-name" placeholder="e.g. Savings transfer" />
    </div>
    <div class="form-row">
      <div class="form-field">
        <label>Amount</label>
        <input type="number" step="0.01" min="0" id="so-amount" placeholder="0.00" />
      </div>
      <div class="form-field">
        <label>Due day of month</label>
        <input type="number" min="1" max="31" id="so-due-day" placeholder="e.g. 1" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-field">
        <label>From</label>
        <select id="so-from">${accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('')}</select>
      </div>
      <div class="form-field">
        <label>To</label>
        <select id="so-to">${accounts.map((a, i) => `<option value="${a.id}" ${i === 1 ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}</select>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn-secondary" id="so-cancel">Cancel</button>
      <button class="btn-primary" id="so-save">Save</button>
    </div>
  `);

  document.getElementById('so-cancel').addEventListener('click', closeModal);
  document.getElementById('so-save').addEventListener('click', async () => {
    const name = document.getElementById('so-name').value.trim();
    const amount = document.getElementById('so-amount').value;
    const dueDay = document.getElementById('so-due-day').value;
    const fromAccountId = document.getElementById('so-from').value;
    const toAccountId = document.getElementById('so-to').value;
    if (!name) { alert('Enter a name.'); return; }
    if (!amount || Number(amount) <= 0) { alert('Enter an amount greater than 0.'); return; }
    if (!dueDay || dueDay < 1 || dueDay > 31) { alert('Enter a due day between 1 and 31.'); return; }
    if (fromAccountId === toAccountId) { alert('Choose two different accounts.'); return; }

    await addStandingOrder({ name, amount, dueDay, fromAccountId, toAccountId });
    closeModal();
    refreshCurrentView();
    showToast(t('toast.standingOrderAdded'));
  });
});

/* ---------------- Add Budget ---------------- */

document.getElementById('btn-add-budget').addEventListener('click', async () => {
  const categories = (await getCategories()).filter(c => c.kind === 'expense');
  const existingBudgets = await getBudgets();
  const available = categories.filter(c => !existingBudgets.some(b => b.categoryId === c.id));

  if (categories.length === 0) {
    openModal('Add an expense category first', `<p class="empty-note">You need at least one expense category before setting a budget.</p>`);
    return;
  }
  if (available.length === 0) {
    openModal('All set', `<p class="empty-note">Every expense category already has a budget. Delete one first to change it.</p>`);
    return;
  }

  openModal(t('modalTitle.addBudget'), `
    <div class="form-field">
      <label>Category</label>
      <select id="bud-category">${available.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
    </div>
    <div class="form-field">
      <label>Monthly limit</label>
      <input type="number" step="0.01" min="0" id="bud-amount" placeholder="0.00" />
    </div>
    <div class="form-field">
      <label class="settings-check"><input type="checkbox" id="bud-rollover" /> ${t('budgets.rolloverCheckbox')}</label>
      <p class="ledger-meta">${t('budgets.rolloverCheckboxHint')}</p>
    </div>
    <div class="form-actions">
      <button class="btn-secondary" id="bud-cancel">Cancel</button>
      <button class="btn-primary" id="bud-save">Save</button>
    </div>
  `);

  document.getElementById('bud-cancel').addEventListener('click', closeModal);
  document.getElementById('bud-save').addEventListener('click', async () => {
    const amount = document.getElementById('bud-amount').value;
    if (!amount || Number(amount) <= 0) { alert('Enter an amount greater than 0.'); return; }
    await addBudget({
      categoryId: document.getElementById('bud-category').value,
      amount,
      rollover: document.getElementById('bud-rollover').checked
    });
    closeModal();
    refreshCurrentView();
    showToast(t('toast.budgetAdded'));
  });
});

/* ---------------- Add Savings Goal ---------------- */

document.getElementById('btn-add-savingsgoal').addEventListener('click', async () => {
  const accounts = await getAccounts();

  if (accounts.length === 0) {
    openModal('Add an account first', `<p class="empty-note">You need at least one account before setting a savings goal.</p>`);
    return;
  }

  openModal(t('modalTitle.addSavingsGoal'), `
    <div class="form-field">
      <label>Name</label>
      <input type="text" id="goal-name" placeholder="e.g. ISA deposit target" />
    </div>
    <div class="form-row">
      <div class="form-field">
        <label>Target amount</label>
        <input type="number" step="0.01" min="0" id="goal-amount" placeholder="0.00" />
      </div>
      <div class="form-field">
        <label>Target date (optional)</label>
        <input type="date" id="goal-date" />
      </div>
    </div>
    <div class="form-field">
      <label>Accounts (money in any of these counts toward the goal)</label>
      <div class="settings-list">
        ${accounts.map((a, i) => `
          <label class="settings-check" style="padding:6px 0">
            <input type="checkbox" class="goal-account-check" value="${a.id}" ${i === 0 ? 'checked' : ''} />
            ${escapeHtml(a.name)}
          </label>
        `).join('')}
      </div>
    </div>
    <div class="form-actions">
      <button class="btn-secondary" id="goal-cancel">Cancel</button>
      <button class="btn-primary" id="goal-save">Save</button>
    </div>
  `);

  document.getElementById('goal-cancel').addEventListener('click', closeModal);
  document.getElementById('goal-save').addEventListener('click', async () => {
    const name = document.getElementById('goal-name').value.trim();
    const targetAmount = document.getElementById('goal-amount').value;
    const accountIds = Array.from(document.querySelectorAll('.goal-account-check:checked')).map(cb => cb.value);
    if (!name) { alert('Enter a goal name.'); return; }
    if (!targetAmount || Number(targetAmount) <= 0) { alert('Enter a target amount greater than 0.'); return; }
    if (accountIds.length === 0) { alert('Choose at least one account.'); return; }

    await addSavingsGoal({
      name,
      targetAmount,
      accountIds,
      targetDate: document.getElementById('goal-date').value
    });
    closeModal();
    refreshCurrentView();
    showToast(t('toast.savingsGoalAdded'));
  });
});

/* ---------------- Delete / pay / unpay actions (event delegation) ---------------- */

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id = Number(btn.dataset.id);

  if (btn.dataset.action === 'delete-tx') {
    if (confirm('Delete this transaction?')) { await deleteTransaction(id); refreshCurrentView(); showToast(t('toast.transactionDeleted')); }
  }
  if (btn.dataset.action === 'delete-category') {
    if (confirm('Delete this category? Existing transactions will keep it as text only.')) { await deleteCategory(id); refreshCurrentView(); showToast(t('toast.categoryDeleted')); }
  }
  if (btn.dataset.action === 'edit-account') {
    const account = await getAccount(id);
    const balance = await getAccountBalance(id);
    openModal(t('modalTitle.editAccount'), `
      <div class="form-field">
        <label>Name</label>
        <input type="text" id="acc-edit-name" value="${escapeHtml(account.name)}" />
      </div>
      <div class="form-field">
        <label>Type</label>
        <select id="acc-edit-type">
          <option value="current">Current account</option>
          <option value="savings">Savings account</option>
          <option value="isa">ISA</option>
          <option value="credit">Credit card</option>
          <option value="cash">Cash</option>
          <option value="pension">Pension</option>
          <option value="investment">Investment</option>
        </select>
      </div>
      <div class="form-field">
        <label>${t('accounts.currentBalanceLabel')}</label>
        <input type="number" step="0.01" id="acc-edit-balance" value="${balance.toFixed(2)}" />
        <p class="ledger-meta">${t('accounts.editBalanceHint')}</p>
        <button type="button" class="btn-secondary btn-sm" id="acc-edit-import-btn" style="margin-top:6px">${t('accounts.importFromFile')}</button>
        <input type="file" accept=".json,application/json" id="acc-edit-import-file" style="display:none" />
        <p class="ledger-meta" id="acc-edit-import-status" style="display:none"></p>
      </div>
      <div class="form-field" id="acc-edit-credit-limit-field" style="display:none">
        <label>${t('accounts.creditLimitLabel')}</label>
        <input type="number" step="0.01" min="0" id="acc-edit-credit-limit" value="${account.creditLimit || ''}" placeholder="0.00" />
      </div>
      <div class="form-field" id="acc-edit-repayment-day-field" style="display:none">
        <label>${t('accounts.repaymentDueDayLabel')}</label>
        <input type="number" min="1" max="31" id="acc-edit-repayment-day" value="${account.repaymentDueDay || ''}" placeholder="e.g. 21" />
        <p class="ledger-meta">${t('accounts.repaymentDueDayHint')}</p>
      </div>
      <div class="form-actions">
        <button class="btn-secondary" id="acc-edit-cancel">Cancel</button>
        <button class="btn-primary" id="acc-edit-save">Save</button>
      </div>
    `);
    document.getElementById('acc-edit-type').value = account.type;

    const editTypeSelect = document.getElementById('acc-edit-type');
    const editLimitField = document.getElementById('acc-edit-credit-limit-field');
    const editRepaymentField = document.getElementById('acc-edit-repayment-day-field');
    const toggleEditLimitField = () => {
      const isCredit = editTypeSelect.value === 'credit';
      editLimitField.style.display = isCredit ? '' : 'none';
      editRepaymentField.style.display = isCredit ? '' : 'none';
    };
    editTypeSelect.addEventListener('change', toggleEditLimitField);
    toggleEditLimitField();

    // Reads a small { totalValue, asOf } JSON file (e.g. exported from
    // another app tracking investments) and fills in the balance field for
    // review — nothing is saved until the user hits Save themselves.
    let importedAsOf = null;
    document.getElementById('acc-edit-import-btn').addEventListener('click', () => {
      document.getElementById('acc-edit-import-file').click();
    });
    document.getElementById('acc-edit-import-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const statusEl = document.getElementById('acc-edit-import-status');
      try {
        const parsed = JSON.parse(await file.text());
        const value = Number(parsed.totalValue);
        if (!isFinite(value)) throw new Error('missing totalValue');
        document.getElementById('acc-edit-balance').value = value.toFixed(2);
        importedAsOf = typeof parsed.asOf === 'string' ? parsed.asOf : null;
        statusEl.textContent = importedAsOf
          ? t('accounts.importSuccessWithDate', { amt: formatMoney(value), date: formatUKDate(importedAsOf) })
          : t('accounts.importSuccess', { amt: formatMoney(value) });
        statusEl.style.display = '';
      } catch (err) {
        importedAsOf = null;
        statusEl.textContent = t('accounts.importFailed');
        statusEl.style.display = '';
      }
    });

    document.getElementById('acc-edit-cancel').addEventListener('click', closeModal);
    document.getElementById('acc-edit-save').addEventListener('click', async () => {
      const name = document.getElementById('acc-edit-name').value.trim();
      if (!name) { alert('Enter an account name.'); return; }
      await updateAccount(id, {
        name,
        type: editTypeSelect.value,
        balance: document.getElementById('acc-edit-balance').value,
        creditLimit: document.getElementById('acc-edit-credit-limit').value,
        repaymentDueDay: document.getElementById('acc-edit-repayment-day').value,
        balanceAsOf: importedAsOf
      });
      closeModal();
      refreshCurrentView();
      showToast(t('toast.accountUpdated'));
    });
  }
  if (btn.dataset.action === 'delete-account') {
    if (confirm('Delete this account?')) { await deleteAccount(id); refreshCurrentView(); showToast(t('toast.accountDeleted')); }
  }
  if (btn.dataset.action === 'delete-bill') {
    if (confirm('Delete this bill? Past transactions from it are kept.')) { await deleteBill(id); refreshCurrentView(); showToast(t('toast.billDeleted')); }
  }
  if (btn.dataset.action === 'toggle-bill-subscription') {
    const next = btn.dataset.next === '1';
    await setBillSubscription(id, next);
    refreshCurrentView();
    showToast(next ? t('toast.billSubscriptionOn') : t('toast.billSubscriptionOff'));
  }
  if (btn.dataset.action === 'delete-transfer') {
    if (confirm('Delete this transfer?')) { await deleteTransfer(id); refreshCurrentView(); showToast(t('toast.transferDeleted')); }
  }
  if (btn.dataset.action === 'toggle-budget-rollover') {
    const next = btn.dataset.next === '1';
    await setBudgetRollover(id, next);
    refreshCurrentView();
    showToast(next ? t('toast.budgetRolloverOn') : t('toast.budgetRolloverOff'));
  }
  if (btn.dataset.action === 'delete-budget') {
    if (confirm('Delete this budget?')) { await deleteBudget(id); refreshCurrentView(); showToast(t('toast.budgetDeleted')); }
  }
  if (btn.dataset.action === 'delete-savingsgoal') {
    if (confirm('Delete this savings goal?')) { await deleteSavingsGoal(id); refreshCurrentView(); showToast(t('toast.savingsGoalDeleted')); }
  }
  if (btn.dataset.action === 'pay-bill') {
    const today = new Date().toISOString().slice(0, 10);
    await markBillPaid(id, today);
    refreshCurrentView();
    showToast(t('toast.billPaid'));
  }
  if (btn.dataset.action === 'unpay-bill') {
    const month = btn.dataset.month;
    await markBillUnpaid(id, month);
    refreshCurrentView();
    showToast(t('toast.billUnpaid'));
  }
  if (btn.dataset.action === 'delete-standingorder') {
    if (confirm('Delete this standing order? Past transfers from it are kept.')) { await deleteStandingOrder(id); refreshCurrentView(); showToast(t('toast.standingOrderDeleted')); }
  }
  if (btn.dataset.action === 'pay-standingorder') {
    const today = new Date().toISOString().slice(0, 10);
    await markStandingOrderDone(id, today);
    refreshCurrentView();
    showToast(t('toast.standingOrderPaid'));
  }
  if (btn.dataset.action === 'unpay-standingorder') {
    const month = btn.dataset.month;
    await markStandingOrderUndone(id, month);
    refreshCurrentView();
    showToast(t('toast.standingOrderUnpaid'));
  }

  if (btn.dataset.action === 'setup-sync') {
    const passphrase = document.getElementById('sync-passphrase').value;
    const confirmPassphrase = document.getElementById('sync-passphrase-confirm').value;
    const note = document.getElementById('sync-note');
    note.style.display = 'block';

    if (!passphrase || passphrase.length < 8) {
      note.textContent = 'Use a passphrase of at least 8 characters.';
      return;
    }
    if (passphrase !== confirmPassphrase) {
      note.textContent = "Passphrases don't match — try again.";
      return;
    }
    if (typeof window.setupSync !== 'function') {
      note.textContent = 'Still connecting to sync — check you\'re online and try again in a moment.';
      return;
    }
    note.textContent = 'Setting up…';
    try {
      await window.setupSync(passphrase);
      refreshCurrentView();
    } catch (err) {
      note.textContent = 'Something went wrong: ' + err.message;
    }
  }

  if (btn.dataset.action === 'sync-now') {
    const note = document.getElementById('sync-note');
    note.style.display = 'block';
    if (typeof window.syncNow !== 'function') {
      note.textContent = 'Still connecting to sync — check you\'re online and try again in a moment.';
      return;
    }
    note.textContent = 'Syncing…';
    try {
      await window.syncNow();
      refreshCurrentView();
    } catch (err) {
      note.textContent = 'Sync failed: ' + err.message;
    }
  }

  if (btn.dataset.action === 'forget-sync') {
    if (confirm('Forget sync on this device? Your local data stays as-is, but this device will stop syncing until you enter the passphrase again.')) {
      window.forgetSyncOnThisDevice();
      refreshCurrentView();
    }
  }

  if (btn.dataset.action === 'move-nav-up' || btn.dataset.action === 'move-nav-down') {
    const settings = getNavSettings();
    const byId = Object.fromEntries(NAV_REGISTRY.map(i => [i.id, i]));
    const ids = settings.order.filter(navId => byId[navId]);
    NAV_DEFAULT_ORDER.forEach(navId => { if (!ids.includes(navId)) ids.push(navId); });
    moveInArray(ids, btn.dataset.key, btn.dataset.action === 'move-nav-up' ? -1 : 1);
    settings.order = ids;
    saveNavSettings(settings);
    renderNavBar();
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === currentView));
    renderSettingsPage();
  }

  if (btn.dataset.action === 'move-dashboard-up' || btn.dataset.action === 'move-dashboard-down') {
    const settings = getDashboardSettings();
    const ids = settings.order.filter(panelId => DASHBOARD_REGISTRY.some(p => p.id === panelId));
    DASHBOARD_DEFAULT_ORDER.forEach(panelId => { if (!ids.includes(panelId)) ids.push(panelId); });
    moveInArray(ids, btn.dataset.key, btn.dataset.action === 'move-dashboard-up' ? -1 : 1);
    settings.order = ids;
    saveDashboardSettings(settings);
    applyDashboardLayout();
    renderSettingsPage();
  }

  if (btn.dataset.action === 'reset-settings') {
    if (confirm('Reset tabs, dashboard layout, account order, and theme colours to their defaults?')) {
      resetLayoutSettings();
      renderNavBar();
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === currentView));
      applyDashboardLayout();
      applyCustomColors();
      renderSettingsPage();
      showToast(t('settings.resetDone'));
    }
  }
});

function moveInArray(arr, key, direction) {
  const idx = arr.indexOf(key);
  const swapWith = idx + direction;
  if (idx === -1 || swapWith < 0 || swapWith >= arr.length) return;
  [arr[idx], arr[swapWith]] = [arr[swapWith], arr[idx]];
}

// Show/hide checkboxes use 'change', not 'click', so they get their own delegated listener.
document.addEventListener('change', (e) => {
  const input = e.target.closest('[data-action^="toggle-"]');
  if (!input) return;
  const key = input.dataset.key;

  if (input.dataset.action === 'toggle-nav-visible') {
    const settings = getNavSettings();
    const hidden = new Set(settings.hidden);
    input.checked ? hidden.delete(key) : hidden.add(key);
    settings.hidden = Array.from(hidden);
    saveNavSettings(settings);
    renderNavBar();
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === currentView));
  }

  if (input.dataset.action === 'toggle-dashboard-visible') {
    const settings = getDashboardSettings();
    const hidden = new Set(settings.hidden);
    input.checked ? hidden.delete(key) : hidden.add(key);
    settings.hidden = Array.from(hidden);
    saveDashboardSettings(settings);
    applyDashboardLayout();
  }

  if (input.dataset.action === 'set-colour') {
    const colors = getCustomColors();
    colors[key] = input.value;
    saveCustomColors(colors);
    applyCustomColors();
  }
});

/* ---------------- Transaction filters ---------------- */

['filter-account', 'filter-category', 'filter-month'].forEach(id => {
  document.getElementById(id).addEventListener('change', async () => {
    const [txs, transfers, categories, accounts] = await Promise.all([
      getTransactions(), getTransfers(), getCategories(), getAccounts()
    ]);
    applyTransactionFilters(txs, transfers, categories, accounts);
  });
});

/* ---------------- Service worker (enables offline) ---------------- */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('Service worker failed:', err));
  });
}

/* ---------------- Initial load ---------------- */

renderNavBar();
document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === currentView));
applyCustomColors();
applyStaticTranslations();
initAppLock();

// Both containers are static in index.html (only their children get
// re-rendered), so these only need wiring up once — not on every render.
enableDragReorder(document.getElementById('account-list'), '.account-card', el => Number(el.dataset.id), (newOrder) => {
  saveAccountOrder(newOrder);
});
enableDragReorder(document.getElementById('dashboard-panels'), '[data-panel]', el => el.dataset.panel, (newOrder) => {
  const settings = getDashboardSettings();
  settings.order = newOrder;
  saveDashboardSettings(settings);
});
