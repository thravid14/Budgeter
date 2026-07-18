/*
  settings.js
  -----------
  Lets the user show/hide and reorder nav tabs and dashboard panels.
  Holds the "registry" (the full list of what exists, with icons/labels)
  and the user's customization (order + hidden list), persisted in
  localStorage. Dashboard and Settings tabs are pinned — always visible,
  always first/last — so the user can never lock themselves out of the
  Settings page itself.

  No event listeners here (matches render.js's convention) — app.js wires
  the actual clicks. This file only knows how to build the nav/dashboard
  markup and read/write the saved layout.
*/

const NAV_REGISTRY = [
  { id: 'dashboard', pinned: true, labelKey: 'nav.dashboard',
    icon: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/>' },
  { id: 'transactions', labelKey: 'nav.transactions',
    icon: '<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="14" y2="17"/>' },
  { id: 'bills', labelKey: 'nav.bills',
    icon: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="13" y2="16"/>' },
  { id: 'budgets', labelKey: 'nav.budgets',
    icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>' },
  { id: 'trends', labelKey: 'nav.trends',
    icon: '<path d="M4 19h16"/><path d="M4 19l5-6 4 3 6-9"/>' },
  { id: 'networth', labelKey: 'nav.networth',
    icon: '<circle cx="12" cy="12" r="9"/><path d="M9 15s1 1.5 3 1.5 3-1 3-2-1-1.5-3-1.5-3-0.5-3-1.5 1-2 3-2 3 1.5 3 1.5"/><line x1="12" y1="6" x2="12" y2="7.3"/><line x1="12" y1="16.7" x2="12" y2="18"/>' },
  { id: 'categories', labelKey: 'nav.categories',
    icon: '<path d="M12 3l8 8-9 9-8-8 3-9z"/><circle cx="9.5" cy="9.5" r="1.4" fill="currentColor" stroke="none"/>' },
  { id: 'accounts', labelKey: 'nav.accounts',
    icon: '<path d="M3 10l9-6 9 6"/><rect x="5" y="10" width="14" height="9" rx="1"/><line x1="5" y1="19" x2="19" y2="19"/>' },
  { id: 'sync', labelKey: 'nav.sync',
    icon: '<path d="M17 2l4 4-4 4"/><path d="M21 6H8a5 5 0 0 0-5 5"/><path d="M7 22l-4-4 4-4"/><path d="M3 18h13a5 5 0 0 0 5-5"/>' },
  { id: 'help', labelKey: 'nav.help',
    icon: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 4"/><line x1="12" y1="17" x2="12" y2="17.01"/>' },
  { id: 'settings', pinned: true, labelKey: 'nav.settings',
    icon: '<line x1="4" y1="6" x2="20" y2="6"/><circle cx="15" cy="6" r="1.8" fill="currentColor" stroke="none"/><line x1="4" y1="12" x2="20" y2="12"/><circle cx="9" cy="12" r="1.8" fill="currentColor" stroke="none"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="17" cy="18" r="1.8" fill="currentColor" stroke="none"/>' }
];

const DASHBOARD_REGISTRY = [
  { id: 'summary', labelKey: 'settings.panelSummary' },
  { id: 'upcomingBills', labelKey: 'dashboard.upcomingBills' },
  { id: 'spendingByCategory', labelKey: 'dashboard.spendingByCategory' },
  { id: 'recentTransactions', labelKey: 'dashboard.recentTransactions' }
];

const NAV_DEFAULT_ORDER = NAV_REGISTRY.filter(i => !i.pinned).map(i => i.id);
const DASHBOARD_DEFAULT_ORDER = DASHBOARD_REGISTRY.map(p => p.id);

function getNavSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('budgeter_nav_settings'));
    if (saved && Array.isArray(saved.order) && Array.isArray(saved.hidden)) return saved;
  } catch (e) { /* fall through to defaults */ }
  return { order: NAV_DEFAULT_ORDER.slice(), hidden: [] };
}

function saveNavSettings(settings) {
  localStorage.setItem('budgeter_nav_settings', JSON.stringify(settings));
}

function getDashboardSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('budgeter_dashboard_settings'));
    if (saved && Array.isArray(saved.order) && Array.isArray(saved.hidden)) return saved;
  } catch (e) { /* fall through to defaults */ }
  return { order: DASHBOARD_DEFAULT_ORDER.slice(), hidden: [] };
}

function saveDashboardSettings(settings) {
  localStorage.setItem('budgeter_dashboard_settings', JSON.stringify(settings));
}

function resetLayoutSettings() {
  localStorage.removeItem('budgeter_nav_settings');
  localStorage.removeItem('budgeter_dashboard_settings');
  localStorage.removeItem('budgeter_custom_colors');
}

// Theme colours: Accent/Income/Expense only (not Background) — a custom
// background risks clashing with the fixed text colours from the
// light/dark theme, which isn't worth the added complexity of an
// auto-contrast system for a personal app. Applies on top of whichever
// light/dark theme is active, the same for both (not a separate override
// per mode) — simpler to reason about and enough for "make it feel mine".
const THEME_COLOR_REGISTRY = [
  { key: 'accent', cssVar: '--gold', labelKey: 'settings.colourAccent', fallback: '#C9A227' },
  { key: 'income', cssVar: '--income', labelKey: 'settings.colourIncome', fallback: '#5FB88A' },
  { key: 'expense', cssVar: '--expense', labelKey: 'settings.colourExpense', fallback: '#C1543C' }
];

function getCustomColors() {
  try {
    const saved = JSON.parse(localStorage.getItem('budgeter_custom_colors'));
    if (saved && typeof saved === 'object') return saved;
  } catch (e) { /* fall through to defaults */ }
  return {};
}

function saveCustomColors(colors) {
  localStorage.setItem('budgeter_custom_colors', JSON.stringify(colors));
}

function applyCustomColors() {
  const custom = getCustomColors();
  const root = document.documentElement;
  THEME_COLOR_REGISTRY.forEach(({ key, cssVar }) => {
    if (custom[key]) root.style.setProperty(cssVar, custom[key]);
    else root.style.removeProperty(cssVar);
  });
}

// Builds the #nav button markup: Dashboard first, user-ordered/filtered
// middle tabs, Settings last — always including both pinned tabs.
function renderNavBar() {
  const nav = document.getElementById('nav');
  const { order, hidden } = getNavSettings();
  const byId = Object.fromEntries(NAV_REGISTRY.map(i => [i.id, i]));

  const middleIds = order.filter(id => byId[id] && !hidden.includes(id));
  // Any tab added to the app later that isn't in a saved order yet still shows up.
  NAV_DEFAULT_ORDER.forEach(id => { if (!order.includes(id) && !hidden.includes(id)) middleIds.push(id); });

  const dashboard = byId.dashboard;
  const settings = byId.settings;
  const middle = middleIds.map(id => byId[id]);

  const buttonHtml = (item) => `
    <button class="nav-btn" data-view="${item.id}">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">${item.icon}</svg>
      <span data-i18n="${item.labelKey}">${t(item.labelKey)}</span>
    </button>
  `;

  const brandHtml = nav.querySelector('.brand').outerHTML;
  nav.innerHTML = brandHtml + [dashboard, ...middle, settings].map(buttonHtml).join('');
}

// Reorders/hides the dashboard's panel wrapper elements to match saved settings.
function applyDashboardLayout() {
  const container = document.getElementById('dashboard-panels');
  const { order, hidden } = getDashboardSettings();
  const byId = {};
  container.querySelectorAll('[data-panel]').forEach(el => { byId[el.dataset.panel] = el; });

  const orderedIds = order.filter(id => byId[id]);
  DASHBOARD_DEFAULT_ORDER.forEach(id => { if (!orderedIds.includes(id)) orderedIds.push(id); });

  orderedIds.forEach(id => {
    const el = byId[id];
    el.style.display = hidden.includes(id) ? 'none' : '';
    container.appendChild(el);
  });
}
