/*
  i18n.js
  -------
  Minimal translation layer: a nested dictionary per language, a t(path)
  lookup, and applyStaticTranslations() which walks any element with a
  data-i18n / data-i18n-placeholder attribute and fills it in.

  Scope (deliberately, 2026-07-18): nav, page headers/subtitles, buttons,
  empty states, toasts, and the Help page are translated. The 6 "Add X"
  modal forms' field labels/placeholders and alert/confirm dialog text are
  NOT translated yet — that was an explicit scope line the user chose, to
  keep this a completable, verifiable single pass rather than open-ended.

  Loaded as a plain classic script, before render.js/app.js, so `t` and
  `currentLang` are available to both.
*/

let currentLang = localStorage.getItem('budgeter_lang') || 'en';

const translations = {
  en: {
    nav: {
      dashboard: 'Dashboard', transactions: 'Transactions', bills: 'Bills',
      budgets: 'Budgets', trends: 'Trends', networth: 'Net worth',
      categories: 'Categories', accounts: 'Accounts', sync: 'Sync', help: 'Help'
    },
    dashboard: {
      balance: 'Total balance', income: 'Income (this month)', expense: 'Expenses (this month)',
      upcomingBills: 'Upcoming bills', spendingByCategory: 'Spending by category',
      thisMonth: 'this month', recentTransactions: 'Recent transactions',
      emptyBreakdown: 'No expenses recorded this month yet.'
    },
    common: { income: 'Income', expense: 'Expense' },
    transactions: {
      title: 'Transactions', exportCsv: 'Export CSV', importCsv: 'Import CSV',
      addTransfer: '+ Transfer', addTransaction: '+ Add transaction',
      allAccounts: 'All accounts', allCategories: 'All categories',
      empty: 'No transactions yet. Add your first one to get started.',
      uncategorized: 'Uncategorized', transferLabel: 'Transfer'
    },
    bills: {
      title: 'Bills', addBill: '+ Add bill',
      empty: "No bills yet. Add rent, subscriptions, or utilities to track what's due.",
      paid: 'Paid', overdue: 'Overdue {n}d', dueToday: 'Due today', dueIn: 'Due in {n}d',
      markPaid: 'Mark paid', undo: 'Undo', dueDayLabel: 'due day {n}'
    },
    budgets: {
      title: 'Budgets', addBudget: '+ Add budget',
      empty: 'No budgets yet. Set a monthly limit for a category to track progress.',
      of: 'of', remaining: '{amt} remaining', overBy: 'Over by {amt}'
    },
    trends: {
      title: 'Trends', sub: 'Income vs expenses, last 6 months',
      income: 'Income', expenses: 'Expenses', byMonth: 'By month',
      empty: 'No transactions yet in this period.'
    },
    networth: {
      title: 'Net worth', sub: 'What you own minus what you owe',
      assets: 'Assets', liabilities: 'Liabilities', netWorth: 'Net worth',
      overTime: 'Net worth over time', last6Months: 'last 6 months', byMonth: 'By month',
      empty: 'Add an account to start tracking net worth.'
    },
    categories: {
      title: 'Categories', addCategory: '+ Add category',
      empty: 'No categories yet. Add one to start tagging transactions.'
    },
    accounts: {
      title: 'Accounts', addAccount: '+ Add account',
      empty: 'No accounts yet. Add one (e.g. "Cash" or "Current account") to begin.',
      typeCurrent: 'Current account', typeSavings: 'Savings account',
      typeCredit: 'Credit card', typeCash: 'Cash'
    },
    sync: {
      title: 'Sync', sub: 'Keep your phone and desktop in step — encrypted so only you can read it.',
      setupHeading: 'Set up sync',
      setupBody: "Choose a passphrase. It encrypts your data before it ever leaves this device — nobody, including us or the cloud provider, can read it without this passphrase. If you lose it, synced data can't be recovered — keep it somewhere safe.",
      passphraseLabel: 'Passphrase', confirmLabel: 'Confirm passphrase', setupButton: 'Set up sync',
      heading: 'Sync',
      linkedBody: 'This device is set up for sync. Enter the same passphrase on your other device to link it.',
      lastSynced: 'Last synced', never: 'Never', syncNow: 'Sync now', forget: 'Forget on this device'
    },
    help: {
      title: 'Help', sub: 'What everything does, in plain language',
      dashboardHeading: 'Dashboard',
      dashboardBody: "Your at-a-glance overview: total balance across all accounts (with a small trend line showing the last 6 months), this month's income and expenses, upcoming bills, a breakdown of spending by category, and your most recent transactions.",
      transactionsHeading: 'Transactions',
      transactionsBody: 'The full history of money in and out. Add income or expenses, transfer money between your own accounts, filter by account, category, or month, and export or import your transaction history as a CSV file.',
      billsHeading: 'Bills',
      billsBody: 'Recurring expenses like rent, subscriptions, or utilities. Add a bill once with its amount, due day, and which account/category it comes from — each month it shows as due, overdue, or paid. "Mark paid" creates a real transaction; "Undo" removes it if you tapped by mistake.',
      budgetsHeading: 'Budgets',
      budgetsBody: 'Set a monthly £ limit for a spending category (e.g. £200 for Groceries). The progress bar fills up as you spend during the month and turns red if you go over — one budget per category.',
      trendsHeading: 'Trends',
      trendsBody: 'Income vs expenses over the last 6 months, as a chart and a month-by-month list, so you can spot patterns beyond just the current month.',
      networthHeading: 'Net worth',
      networthBody: "What you own minus what you owe: account balances added up as assets, credit card balances counted as liabilities, plus how that's changed over the last 6 months.",
      categoriesHeading: 'Categories',
      categoriesBody: 'Tags for your transactions (e.g. Groceries, Salary), each marked as income or expense with a colour used throughout the charts.',
      accountsHeading: 'Accounts',
      accountsBody: 'Your current accounts, savings accounts, credit cards, and cash — each with a starting balance. Budgeter works out the running balance from that starting point plus every transaction and transfer since.',
      syncHeading: 'Sync',
      syncBody: "Keep your phone and desktop in step. Your data is encrypted on your device before it's ever sent anywhere — set a passphrase once, enter the same one on your other device, and they'll share the same (encrypted) data.",
      fieldGuideHeading: 'Field guide',
      startingBalanceTerm: 'Starting balance',
      startingBalanceDef: "The balance an account had before you started tracking it in Budgeter — everything from then on is worked out automatically from your transactions and transfers.",
      accountTypeTerm: 'Account type',
      accountTypeDef: "Just a label (Current, Savings, Credit card, Cash) — it doesn't change how the maths works, except that Credit card balances count as liabilities on the Net worth page.",
      dueDayTerm: 'Due day (Bills)',
      dueDayDef: "The day of the month a bill is due, e.g. 1 for the 1st. In a shorter month, it's treated as due on that month's last day.",
      categoryColourTerm: 'Category colour',
      categoryColourDef: "Used to tell categories apart in the spending breakdown and budget charts — purely visual, doesn't affect any totals.",
      syncPassphraseTerm: 'Sync passphrase',
      syncPassphraseDef: '"Encrypts your data and links your devices together. There\'s no "forgot passphrase" recovery, by design — write it down somewhere safe.'
    },
    toast: {
      transactionAdded: 'Transaction added.', transferAdded: 'Transfer added.',
      categoryAdded: 'Category added.', accountAdded: 'Account added.',
      billAdded: 'Bill added.', budgetAdded: 'Budget added.',
      transactionDeleted: 'Transaction deleted.', categoryDeleted: 'Category deleted.',
      accountDeleted: 'Account deleted.', billDeleted: 'Bill deleted.',
      transferDeleted: 'Transfer deleted.', budgetDeleted: 'Budget deleted.',
      billPaid: 'Bill marked as paid.', billUnpaid: 'Bill marked as unpaid.',
      csvExported: 'Transactions exported.', summaryCopied: 'Summary copied to clipboard.'
    },
    modalTitle: {
      addTransaction: 'Add transaction', addTransfer: 'Transfer between accounts',
      addCategory: 'Add category', addAccount: 'Add account', addBill: 'Add bill',
      addBudget: 'Add budget'
    }
  },
  es: {
    nav: {
      dashboard: 'Panel', transactions: 'Transacciones', bills: 'Facturas',
      budgets: 'Presupuestos', trends: 'Tendencias', networth: 'Patrimonio neto',
      categories: 'Categorías', accounts: 'Cuentas', sync: 'Sincronización', help: 'Ayuda'
    },
    dashboard: {
      balance: 'Saldo total', income: 'Ingresos (este mes)', expense: 'Gastos (este mes)',
      upcomingBills: 'Próximas facturas', spendingByCategory: 'Gastos por categoría',
      thisMonth: 'este mes', recentTransactions: 'Transacciones recientes',
      emptyBreakdown: 'Aún no se han registrado gastos este mes.'
    },
    common: { income: 'Ingreso', expense: 'Gasto' },
    transactions: {
      title: 'Transacciones', exportCsv: 'Exportar CSV', importCsv: 'Importar CSV',
      addTransfer: '+ Transferencia', addTransaction: '+ Añadir transacción',
      allAccounts: 'Todas las cuentas', allCategories: 'Todas las categorías',
      empty: 'Aún no hay transacciones. Añade la primera para empezar.',
      uncategorized: 'Sin categoría', transferLabel: 'Transferencia'
    },
    bills: {
      title: 'Facturas', addBill: '+ Añadir factura',
      empty: 'Aún no hay facturas. Añade el alquiler, suscripciones o servicios para ver lo que vence.',
      paid: 'Pagada', overdue: 'Vencida hace {n}d', dueToday: 'Vence hoy', dueIn: 'Vence en {n}d',
      markPaid: 'Marcar como pagada', undo: 'Deshacer', dueDayLabel: 'día de vencimiento {n}'
    },
    budgets: {
      title: 'Presupuestos', addBudget: '+ Añadir presupuesto',
      empty: 'Aún no hay presupuestos. Establece un límite mensual para una categoría.',
      of: 'de', remaining: '{amt} restante', overBy: 'Superado por {amt}'
    },
    trends: {
      title: 'Tendencias', sub: 'Ingresos frente a gastos, últimos 6 meses',
      income: 'Ingresos', expenses: 'Gastos', byMonth: 'Por mes',
      empty: 'Aún no hay transacciones en este período.'
    },
    networth: {
      title: 'Patrimonio neto', sub: 'Lo que tienes menos lo que debes',
      assets: 'Activos', liabilities: 'Pasivos', netWorth: 'Patrimonio neto',
      overTime: 'Patrimonio neto en el tiempo', last6Months: 'últimos 6 meses', byMonth: 'Por mes',
      empty: 'Añade una cuenta para empezar a seguir tu patrimonio neto.'
    },
    categories: {
      title: 'Categorías', addCategory: '+ Añadir categoría',
      empty: 'Aún no hay categorías. Añade una para empezar a etiquetar transacciones.'
    },
    accounts: {
      title: 'Cuentas', addAccount: '+ Añadir cuenta',
      empty: 'Aún no hay cuentas. Añade una (p. ej. "Efectivo" o "Cuenta corriente") para empezar.',
      typeCurrent: 'Cuenta corriente', typeSavings: 'Cuenta de ahorros',
      typeCredit: 'Tarjeta de crédito', typeCash: 'Efectivo'
    },
    sync: {
      title: 'Sincronización', sub: 'Mantén tu móvil y tu ordenador sincronizados — cifrado para que solo tú puedas leerlo.',
      setupHeading: 'Configurar sincronización',
      setupBody: 'Elige una contraseña. Cifra tus datos antes de que salgan de este dispositivo — nadie, ni nosotros ni el proveedor en la nube, puede leerlos sin ella. Si la pierdes, los datos sincronizados no se pueden recuperar — guárdala en un lugar seguro.',
      passphraseLabel: 'Contraseña', confirmLabel: 'Confirmar contraseña', setupButton: 'Configurar sincronización',
      heading: 'Sincronización',
      linkedBody: 'Este dispositivo está configurado para sincronizar. Introduce la misma contraseña en tu otro dispositivo para vincularlo.',
      lastSynced: 'Última sincronización', never: 'Nunca', syncNow: 'Sincronizar ahora', forget: 'Olvidar en este dispositivo'
    },
    help: {
      title: 'Ayuda', sub: 'Qué hace cada cosa, en lenguaje sencillo',
      dashboardHeading: 'Panel',
      dashboardBody: 'Tu resumen de un vistazo: saldo total de todas las cuentas (con una pequeña línea de tendencia de los últimos 6 meses), ingresos y gastos de este mes, próximas facturas, un desglose del gasto por categoría y tus transacciones más recientes.',
      transactionsHeading: 'Transacciones',
      transactionsBody: 'El historial completo de dinero que entra y sale. Añade ingresos o gastos, transfiere dinero entre tus propias cuentas, filtra por cuenta, categoría o mes, y exporta o importa tu historial de transacciones como archivo CSV.',
      billsHeading: 'Facturas',
      billsBody: 'Gastos recurrentes como el alquiler, suscripciones o servicios. Añade una factura una vez con su importe, día de vencimiento y de qué cuenta/categoría proviene — cada mes aparecerá como pendiente, vencida o pagada. "Marcar como pagada" crea una transacción real; "Deshacer" la elimina si la marcaste por error.',
      budgetsHeading: 'Presupuestos',
      budgetsBody: 'Establece un límite mensual en £ para una categoría de gasto (p. ej. £200 para Compras). La barra de progreso se llena a medida que gastas durante el mes y se pone roja si te pasas — un presupuesto por categoría.',
      trendsHeading: 'Tendencias',
      trendsBody: 'Ingresos frente a gastos durante los últimos 6 meses, como gráfico y como lista mes a mes, para detectar patrones más allá del mes actual.',
      networthHeading: 'Patrimonio neto',
      networthBody: 'Lo que tienes menos lo que debes: los saldos de tus cuentas sumados como activos, los saldos de tarjetas de crédito contados como pasivos, y cómo ha cambiado eso en los últimos 6 meses.',
      categoriesHeading: 'Categorías',
      categoriesBody: 'Etiquetas para tus transacciones (p. ej. Compras, Nómina), cada una marcada como ingreso o gasto con un color usado en los gráficos.',
      accountsHeading: 'Cuentas',
      accountsBody: 'Tus cuentas corrientes, cuentas de ahorro, tarjetas de crédito y efectivo — cada una con un saldo inicial. Budgeter calcula el saldo actual a partir de ese punto de partida más cada transacción y transferencia desde entonces.',
      syncHeading: 'Sincronización',
      syncBody: 'Mantén tu móvil y tu ordenador sincronizados. Tus datos se cifran en tu dispositivo antes de enviarse a ningún sitio — establece una contraseña una vez, introduce la misma en tu otro dispositivo, y compartirán los mismos datos (cifrados).',
      fieldGuideHeading: 'Guía de campos',
      startingBalanceTerm: 'Saldo inicial',
      startingBalanceDef: 'El saldo que tenía una cuenta antes de empezar a seguirla en Budgeter — todo lo demás se calcula automáticamente a partir de tus transacciones y transferencias.',
      accountTypeTerm: 'Tipo de cuenta',
      accountTypeDef: 'Solo una etiqueta (Corriente, Ahorros, Tarjeta de crédito, Efectivo) — no cambia los cálculos, salvo que los saldos de Tarjeta de crédito cuentan como pasivos en la página de Patrimonio neto.',
      dueDayTerm: 'Día de vencimiento (Facturas)',
      dueDayDef: 'El día del mes en que vence una factura, p. ej. 1 para el día 1. En un mes más corto, se trata como vencida el último día de ese mes.',
      categoryColourTerm: 'Color de categoría',
      categoryColourDef: 'Se usa para diferenciar categorías en el desglose de gastos y los gráficos de presupuesto — puramente visual, no afecta a ningún total.',
      syncPassphraseTerm: 'Contraseña de sincronización',
      syncPassphraseDef: 'Cifra tus datos y vincula tus dispositivos. No hay recuperación de "contraseña olvidada", por diseño — anótala en un lugar seguro.'
    },
    toast: {
      transactionAdded: 'Transacción añadida.', transferAdded: 'Transferencia añadida.',
      categoryAdded: 'Categoría añadida.', accountAdded: 'Cuenta añadida.',
      billAdded: 'Factura añadida.', budgetAdded: 'Presupuesto añadido.',
      transactionDeleted: 'Transacción eliminada.', categoryDeleted: 'Categoría eliminada.',
      accountDeleted: 'Cuenta eliminada.', billDeleted: 'Factura eliminada.',
      transferDeleted: 'Transferencia eliminada.', budgetDeleted: 'Presupuesto eliminado.',
      billPaid: 'Factura marcada como pagada.', billUnpaid: 'Factura marcada como pendiente.',
      csvExported: 'Transacciones exportadas.', summaryCopied: 'Resumen copiado al portapapeles.'
    },
    modalTitle: {
      addTransaction: 'Añadir transacción', addTransfer: 'Transferir entre cuentas',
      addCategory: 'Añadir categoría', addAccount: 'Añadir cuenta', addBill: 'Añadir factura',
      addBudget: 'Añadir presupuesto'
    }
  }
};

function resolvePath(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

// t('bills.dueIn', { n: 3 }) -> 'Due in 3d' / 'Vence en 3d'
function t(path, params) {
  let str = resolvePath(translations[currentLang], path);
  if (str === undefined) str = resolvePath(translations.en, path);
  if (str === undefined) return path;
  if (params) {
    Object.keys(params).forEach((key) => {
      str = str.replace(`{${key}}`, params[key]);
    });
  }
  return str;
}

function applyStaticTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('budgeter_lang', lang);
  applyStaticTranslations();
  if (typeof refreshCurrentView === 'function') refreshCurrentView();
}
