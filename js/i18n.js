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
      standingOrders: 'Standing Orders',
      budgets: 'Budgets', savingsGoals: 'Savings Goals', trends: 'Trends', networth: 'Net worth',
      categories: 'Categories', accounts: 'Accounts', sync: 'Sync', help: 'Help', settings: 'Settings'
    },
    settings: {
      title: 'Settings', sub: 'Choose which tabs and dashboard sections are shown, and their order',
      navHeading: 'Navigation tabs', navBody: 'Dashboard and Settings are always available.',
      dashboardHeading: 'Dashboard panels',
      dashboardBody: 'Choose which sections appear on your Dashboard, and their order.',
      panelSummary: 'Summary cards', reset: 'Reset to defaults',
      resetDone: 'Layout reset to defaults.',
      coloursHeading: 'Theme colours',
      coloursBody: 'Pick your own accent, income, and expense colours — used throughout the app, including charts.',
      dataHeading: 'Data', dataBody: 'Back up your transaction history to a CSV file, or import one back in.',
      colourAccent: 'Accent', colourIncome: 'Income', colourExpense: 'Expense'
    },
    dashboard: {
      balance: 'Total balance', income: 'Income (this month)', expense: 'Expenses (this month)',
      upcomingBills: 'Upcoming bills', spendingByCategory: 'Spending by category',
      thisMonth: 'this month', recentTransactions: 'Recent transactions',
      emptyBreakdown: 'No expenses recorded this month yet.',
      cashFlowForecast: 'Cash flow forecast', cashFlowSub: 'next 30 days',
      cashFlowLowest: 'Lowest projected: {amt} on {date}',
      cashFlowBalanceAfter: 'balance after: {amt}',
      cashFlowEmpty: 'No bills due in the next 30 days — nothing to project.',
      cashFlowNote: "Only accounts for bills you've already added — doesn't predict income or day-to-day spending."
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
      markPaid: 'Mark paid', undo: 'Undo', dueDayLabel: 'due day {n}',
      subscriptionCheckbox: 'This is a subscription (Netflix, Spotify, gym, etc.)',
      subscriptionBadge: 'Subscription',
      subscriptionToggle: 'Sub', subscriptionOnHint: 'Tagged as a subscription — click to untag',
      subscriptionOffHint: 'Not tagged as a subscription — click to tag',
      subscriptionsOnly: 'Show subscriptions only',
      subscriptionTotal: '{count} subscriptions · {amt}/month'
    },
    standingOrders: {
      title: 'Standing Orders', addStandingOrder: '+ Add standing order',
      empty: "No standing orders yet. Add one for a regular transfer between your own accounts, like a monthly move into savings."
    },
    budgets: {
      title: 'Budgets', addBudget: '+ Add budget',
      empty: 'No budgets yet. Set a monthly limit for a category to track progress.',
      of: 'of', remaining: '{amt} remaining', overBy: 'Over by {amt}',
      rolloverCheckbox: 'Roll over unused amount into next month',
      rolloverCheckboxHint: 'If you underspend, the leftover raises next month\'s limit. If you overspend, it lowers it. Starts from this month — no retroactive credit.',
      rolloverCredit: '+{amt} rolled over from previous months',
      rolloverDebit: '-{amt} carried over from overspending previous months',
      rolloverToggle: 'Toggle rollover', rolloverOnHint: 'Rollover is on — click to turn off',
      rolloverOffHint: 'Rollover is off — click to turn on'
    },
    savingsGoals: {
      title: 'Savings Goals', sub: 'Target amount tied to one of your accounts', addGoal: '+ Add goal',
      empty: 'No savings goals yet. Set a target amount for an account, like an ISA deposit target.',
      byDate: 'by {date}', reached: 'Goal reached', remaining: '{amt} to go'
    },
    trends: {
      title: 'Trends', sub: 'Income vs expenses, last 6 months',
      income: 'Income', expenses: 'Expenses', net: 'Net', byMonth: 'By month',
      empty: 'No transactions yet in this period.'
    },
    networth: {
      title: 'Net worth', sub: 'What you own minus what you owe',
      assets: 'Assets', liabilities: 'Liabilities', netWorth: 'Net worth',
      overTime: 'Net worth over time', last6Months: 'last 6 months', byMonth: 'By month',
      empty: 'Add an account to start tracking net worth.',
      flatDataNote: "Showing the same figure across every month usually just means there isn't much dated transaction history yet — this fills in and starts showing real month-to-month change as you keep using Budgeter.",
      byAccount: 'By account', pieEmpty: 'No accounts with a positive balance yet.',
      liabilitiesListLabel: 'Debts (not shown in the chart above)'
    },
    categories: {
      title: 'Categories', addCategory: '+ Add category', addStarter: '+ Add starter categories',
      empty: 'No categories yet. Add one to start tagging transactions.'
    },
    accounts: {
      title: 'Accounts', addAccount: '+ Add account',
      empty: 'No accounts yet. Add one (e.g. "Cash" or "Current account") to begin.',
      typeCurrent: 'Current account', typeSavings: 'Savings account',
      typeIsa: 'ISA', typeCredit: 'Credit card', typeCash: 'Cash',
      currentBalanceLabel: 'Current balance',
      editBalanceHint: "Changing this doesn't touch any of your existing transactions — it just adjusts the account's starting point so the balance shown everywhere (Dashboard, Net Worth, etc.) matches what you enter here.",
      creditLimitLabel: 'Credit limit (optional)',
      availableOfLimit: '{available} available of {limit} limit'
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
      dashboardBody: "Your at-a-glance overview: total balance across all accounts (with a small trend line showing the last 6 months), this month's income and expenses, upcoming bills, a 30-day cash flow forecast, a breakdown of spending by category, and your most recent transactions. The forecast projects your balance forward using bills you've already added — it lowers the balance on each bill's due date and flags the lowest point it expects to reach, so you can spot a tight patch coming. It can't know about income or day-to-day spending you haven't recorded, so treat it as a floor, not a prediction.",
      transactionsHeading: 'Transactions',
      transactionsBody: 'The full history of money in and out. Add income or expenses, transfer money between your own accounts, and filter by account, category, or month. CSV export/import moved to Settings → Data, to keep this page focused on your day-to-day entries.',
      billsHeading: 'Bills',
      billsBody: 'Recurring expenses like rent, subscriptions, or utilities. Add a bill once with its amount, due day, and which account/category it comes from. Once its due date arrives, Budgeter automatically creates the transaction and deducts it from that account for you — no need to mark it paid yourself. This happens the next time you open the app on or after the due date (there\'s no way for it to happen while the app is fully closed). "Undo" removes it if something looks wrong; you can still mark a bill paid early yourself if you\'ve already paid it before the due date. Tick "This is a subscription" (or use the "Sub" button on an existing bill) to tag things like Netflix or Spotify — a running monthly subscription total and a filter to show just those appears above the list once you\'ve tagged at least one.',
      standingOrdersHeading: 'Standing Orders',
      standingOrdersBody: "The UK banking term for a recurring transfer between two of your own accounts — for example, moving £200 into savings on the 1st of every month. Works exactly like Bills, but moves money between your own accounts instead of paying an expense, so it never counts as income or spending and correctly updates both accounts' balances. Use this (not a Bill, and not a category) for anything that's really just you moving your own money around.",
      budgetsHeading: 'Budgets',
      budgetsBody: "Set a monthly £ limit for a spending category (e.g. £200 for Groceries). The progress bar fills up as you spend during the month and turns red if you go over — one budget per category. Turn on \"Roll over unused amount\" (the ↻ button on a budget, or the checkbox when adding one) and any amount you don't spend raises next month's limit, while overspending lowers it — it only starts counting from the month you switch it on, never backdated.",
      savingsGoalsHeading: 'Savings Goals',
      savingsGoalsBody: "Set a target amount tied to one of your accounts — e.g. an \"ISA deposit target: £5,000\" goal tied to your ISA account. There's no separate pot to top up: progress is simply that account's current balance against the target, so any Transfer or Standing Order that moves money into the account counts automatically.",
      trendsHeading: 'Trends',
      trendsBody: 'Income vs expenses over the last 6 months, as a chart and a month-by-month list, so you can spot patterns beyond just the current month.',
      networthHeading: 'Net worth',
      networthBody: "What you own minus what you owe: account balances added up as assets, credit card balances counted as liabilities, a pie chart showing how your assets are split across accounts, plus how that's changed over the last 6 months.",
      categoriesHeading: 'Categories',
      categoriesBody: 'Tags for your transactions (e.g. Groceries, Salary), each marked as income or expense with a colour used throughout the charts.',
      accountsHeading: 'Accounts',
      accountsBody: "Your current accounts, savings accounts, credit cards, and cash — each with a starting balance (which can be negative, e.g. for a credit card you're carrying a balance on). Budgeter works out the running balance from that starting point plus every transaction and transfer since. Use the ✎ button to rename an account, change its type, or correct its balance if it's drifted from your real bank balance — editing the balance doesn't touch any existing transactions, it just quietly adjusts the starting point so every screen (Dashboard, Net Worth, etc.) matches straight away. Credit cards can also have a credit limit set, which shows a used/available bar on the account card.",
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
      categoryAdded: 'Category added.', accountAdded: 'Account added.', accountUpdated: 'Account updated.',
      billAdded: 'Bill added.', budgetAdded: 'Budget added.',
      transactionDeleted: 'Transaction deleted.', categoryDeleted: 'Category deleted.',
      accountDeleted: 'Account deleted.', billDeleted: 'Bill deleted.',
      transferDeleted: 'Transfer deleted.', budgetDeleted: 'Budget deleted.',
      billPaid: 'Bill marked as paid.', billUnpaid: 'Bill marked as unpaid.',
      billAutoPaid: '{name} ({amount}) paid automatically.',
      billsAutoPaid: '{count} bills paid automatically: {names}.',
      csvExported: 'Transactions exported.', summaryCopied: 'Summary copied to clipboard.',
      starterCategoriesAdded: '{count} starter categories added.',
      starterCategoriesNoneAdded: "All starter categories already exist — nothing new to add.",
      standingOrderAdded: 'Standing order added.', standingOrderDeleted: 'Standing order deleted.',
      standingOrderPaid: 'Standing order marked as done.', standingOrderUnpaid: 'Standing order marked as not done.',
      standingOrderAutoPaid: '{name} ({amount}) transferred automatically.',
      standingOrdersAutoPaid: '{count} standing orders transferred automatically: {names}.',
      budgetRolloverOn: 'Rollover turned on for this budget.',
      budgetRolloverOff: 'Rollover turned off for this budget.',
      billSubscriptionOn: 'Tagged as a subscription.',
      billSubscriptionOff: 'Untagged as a subscription.',
      savingsGoalAdded: 'Savings goal added.', savingsGoalDeleted: 'Savings goal deleted.'
    },
    modalTitle: {
      addTransaction: 'Add transaction', addTransfer: 'Transfer between accounts',
      addCategory: 'Add category', addAccount: 'Add account', addBill: 'Add bill',
      addBudget: 'Add budget', addStandingOrder: 'Add standing order', addSavingsGoal: 'Add savings goal',
      editAccount: 'Edit account'
    }
  },
  es: {
    nav: {
      dashboard: 'Panel', transactions: 'Transacciones', bills: 'Facturas',
      standingOrders: 'Órdenes permanentes',
      budgets: 'Presupuestos', savingsGoals: 'Metas de ahorro', trends: 'Tendencias', networth: 'Patrimonio neto',
      categories: 'Categorías', accounts: 'Cuentas', sync: 'Sincronización', help: 'Ayuda', settings: 'Ajustes'
    },
    settings: {
      title: 'Ajustes', sub: 'Elige qué pestañas y secciones del panel se muestran, y en qué orden',
      navHeading: 'Pestañas de navegación', navBody: 'Panel y Ajustes están siempre disponibles.',
      dashboardHeading: 'Secciones del panel',
      dashboardBody: 'Elige qué secciones aparecen en tu Panel, y en qué orden.',
      panelSummary: 'Tarjetas de resumen', reset: 'Restablecer valores predeterminados',
      resetDone: 'Diseño restablecido a los valores predeterminados.',
      coloursHeading: 'Colores del tema',
      coloursBody: 'Elige tus propios colores de acento, ingresos y gastos — usados en toda la app, incluidos los gráficos.',
      dataHeading: 'Datos', dataBody: 'Haz copia de seguridad de tu historial de transacciones en un archivo CSV, o importa uno.',
      colourAccent: 'Acento', colourIncome: 'Ingresos', colourExpense: 'Gastos'
    },
    dashboard: {
      balance: 'Saldo total', income: 'Ingresos (este mes)', expense: 'Gastos (este mes)',
      upcomingBills: 'Próximas facturas', spendingByCategory: 'Gastos por categoría',
      thisMonth: 'este mes', recentTransactions: 'Transacciones recientes',
      emptyBreakdown: 'Aún no se han registrado gastos este mes.',
      cashFlowForecast: 'Previsión de flujo de caja', cashFlowSub: 'próximos 30 días',
      cashFlowLowest: 'Punto más bajo previsto: {amt} el {date}',
      cashFlowBalanceAfter: 'saldo después: {amt}',
      cashFlowEmpty: 'No hay facturas que venzan en los próximos 30 días — nada que prever.',
      cashFlowNote: 'Solo tiene en cuenta las facturas que ya has añadido — no predice ingresos ni gastos del día a día.'
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
      markPaid: 'Marcar como pagada', undo: 'Deshacer', dueDayLabel: 'día de vencimiento {n}',
      subscriptionCheckbox: 'Es una suscripción (Netflix, Spotify, gimnasio, etc.)',
      subscriptionBadge: 'Suscripción',
      subscriptionToggle: 'Sus', subscriptionOnHint: 'Marcada como suscripción — pulsa para desmarcar',
      subscriptionOffHint: 'No marcada como suscripción — pulsa para marcar',
      subscriptionsOnly: 'Mostrar solo suscripciones',
      subscriptionTotal: '{count} suscripciones · {amt}/mes'
    },
    standingOrders: {
      title: 'Órdenes permanentes', addStandingOrder: '+ Añadir orden permanente',
      empty: 'Aún no hay órdenes permanentes. Añade una para una transferencia regular entre tus propias cuentas, como un traspaso mensual a ahorros.'
    },
    budgets: {
      title: 'Presupuestos', addBudget: '+ Añadir presupuesto',
      empty: 'Aún no hay presupuestos. Establece un límite mensual para una categoría.',
      of: 'de', remaining: '{amt} restante', overBy: 'Superado por {amt}',
      rolloverCheckbox: 'Trasladar la cantidad no usada al mes siguiente',
      rolloverCheckboxHint: 'Si gastas menos, lo sobrante aumenta el límite del próximo mes. Si te pasas, lo reduce. Empieza desde este mes — sin crédito retroactivo.',
      rolloverCredit: '+{amt} trasladado de meses anteriores',
      rolloverDebit: '-{amt} trasladado por exceso de gasto en meses anteriores',
      rolloverToggle: 'Alternar traslado', rolloverOnHint: 'El traslado está activado — pulsa para desactivar',
      rolloverOffHint: 'El traslado está desactivado — pulsa para activar'
    },
    savingsGoals: {
      title: 'Metas de ahorro', sub: 'Importe objetivo vinculado a una de tus cuentas', addGoal: '+ Añadir meta',
      empty: 'Aún no hay metas de ahorro. Establece un importe objetivo para una cuenta, como un objetivo de depósito ISA.',
      byDate: 'para el {date}', reached: 'Meta alcanzada', remaining: '{amt} restante'
    },
    trends: {
      title: 'Tendencias', sub: 'Ingresos frente a gastos, últimos 6 meses',
      income: 'Ingresos', expenses: 'Gastos', net: 'Neto', byMonth: 'Por mes',
      empty: 'Aún no hay transacciones en este período.'
    },
    networth: {
      title: 'Patrimonio neto', sub: 'Lo que tienes menos lo que debes',
      assets: 'Activos', liabilities: 'Pasivos', netWorth: 'Patrimonio neto',
      overTime: 'Patrimonio neto en el tiempo', last6Months: 'últimos 6 meses', byMonth: 'Por mes',
      empty: 'Añade una cuenta para empezar a seguir tu patrimonio neto.',
      flatDataNote: 'Mostrar la misma cifra en todos los meses normalmente solo significa que aún no hay mucho historial de transacciones con fecha — esto se irá completando y mostrará cambios reales mes a mes a medida que sigas usando Budgeter.',
      byAccount: 'Por cuenta', pieEmpty: 'Aún no hay cuentas con saldo positivo.',
      liabilitiesListLabel: 'Deudas (no se muestran en el gráfico anterior)'
    },
    categories: {
      title: 'Categorías', addCategory: '+ Añadir categoría', addStarter: '+ Añadir categorías iniciales',
      empty: 'Aún no hay categorías. Añade una para empezar a etiquetar transacciones.'
    },
    accounts: {
      title: 'Cuentas', addAccount: '+ Añadir cuenta',
      empty: 'Aún no hay cuentas. Añade una (p. ej. "Efectivo" o "Cuenta corriente") para empezar.',
      typeCurrent: 'Cuenta corriente', typeSavings: 'Cuenta de ahorros',
      typeIsa: 'ISA', typeCredit: 'Tarjeta de crédito', typeCash: 'Efectivo',
      currentBalanceLabel: 'Saldo actual',
      editBalanceHint: 'Cambiar esto no afecta a ninguna de tus transacciones existentes — solo ajusta el punto de partida de la cuenta para que el saldo mostrado en todas partes (Panel, Patrimonio neto, etc.) coincida con lo que introduces aquí.',
      creditLimitLabel: 'Límite de crédito (opcional)',
      availableOfLimit: '{available} disponible de {limit} de límite'
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
      dashboardBody: 'Tu resumen de un vistazo: saldo total de todas las cuentas (con una pequeña línea de tendencia de los últimos 6 meses), ingresos y gastos de este mes, próximas facturas, una previsión de flujo de caja a 30 días, un desglose del gasto por categoría y tus transacciones más recientes. La previsión proyecta tu saldo hacia adelante usando las facturas que ya has añadido — lo reduce en la fecha de vencimiento de cada factura y señala el punto más bajo que espera alcanzar, para que puedas anticipar un momento ajustado. No puede saber sobre ingresos o gastos del día a día que no hayas registrado, así que trátala como un suelo, no como una predicción.',
      transactionsHeading: 'Transacciones',
      transactionsBody: 'El historial completo de dinero que entra y sale. Añade ingresos o gastos, transfiere dinero entre tus propias cuentas, y filtra por cuenta, categoría o mes. La exportación/importación CSV se trasladó a Ajustes → Datos, para mantener esta página centrada en tus movimientos del día a día.',
      billsHeading: 'Facturas',
      billsBody: 'Gastos recurrentes como el alquiler, suscripciones o servicios. Añade una factura una vez con su importe, día de vencimiento y de qué cuenta/categoría proviene. Cuando llega su fecha de vencimiento, Budgeter crea la transacción automáticamente y la descuenta de esa cuenta por ti — no necesitas marcarla como pagada. Esto ocurre la próxima vez que abras la app en o después de la fecha de vencimiento (no puede ocurrir mientras la app está completamente cerrada). "Deshacer" la elimina si algo no parece correcto; aún puedes marcar una factura como pagada tú mismo si ya la pagaste antes de su vencimiento. Marca "Es una suscripción" (o usa el botón "Sus" en una factura ya creada) para etiquetar cosas como Netflix o Spotify — un total mensual de suscripciones y un filtro para mostrar solo esas aparece encima de la lista en cuanto etiquetes al menos una.',
      standingOrdersHeading: 'Órdenes permanentes',
      standingOrdersBody: 'El término bancario del Reino Unido para una transferencia recurrente entre dos de tus propias cuentas — por ejemplo, mover 200 £ a ahorros el día 1 de cada mes. Funciona igual que las Facturas, pero mueve dinero entre tus propias cuentas en lugar de pagar un gasto, por lo que nunca cuenta como ingreso o gasto y actualiza correctamente el saldo de ambas cuentas. Usa esto (no una Factura, ni una categoría) para cualquier cosa que en realidad sea simplemente mover tu propio dinero.',
      budgetsHeading: 'Presupuestos',
      budgetsBody: 'Establece un límite mensual en £ para una categoría de gasto (p. ej. £200 para Compras). La barra de progreso se llena a medida que gastas durante el mes y se pone roja si te pasas — un presupuesto por categoría. Activa "Trasladar la cantidad no usada" (el botón ↻ en un presupuesto, o la casilla al añadir uno) y lo que no gastes aumentará el límite del próximo mes, mientras que gastar de más lo reducirá — solo empieza a contar desde el mes en que lo activas, nunca con efecto retroactivo.',
      savingsGoalsHeading: 'Metas de ahorro',
      savingsGoalsBody: 'Establece un importe objetivo vinculado a una de tus cuentas — p. ej. una meta "Objetivo de depósito ISA: £5.000" vinculada a tu cuenta ISA. No hay un fondo aparte que rellenar: el progreso es simplemente el saldo actual de esa cuenta frente al objetivo, así que cualquier Transferencia u Orden permanente que mueva dinero a la cuenta cuenta automáticamente.',
      trendsHeading: 'Tendencias',
      trendsBody: 'Ingresos frente a gastos durante los últimos 6 meses, como gráfico y como lista mes a mes, para detectar patrones más allá del mes actual.',
      networthHeading: 'Patrimonio neto',
      networthBody: 'Lo que tienes menos lo que debes: los saldos de tus cuentas sumados como activos, los saldos de tarjetas de crédito contados como pasivos, un gráfico circular que muestra cómo se reparten tus activos entre cuentas, y cómo ha cambiado eso en los últimos 6 meses.',
      categoriesHeading: 'Categorías',
      categoriesBody: 'Etiquetas para tus transacciones (p. ej. Compras, Nómina), cada una marcada como ingreso o gasto con un color usado en los gráficos.',
      accountsHeading: 'Cuentas',
      accountsBody: 'Tus cuentas corrientes, cuentas de ahorro, tarjetas de crédito y efectivo — cada una con un saldo inicial (que puede ser negativo, por ejemplo para una tarjeta de crédito con saldo pendiente). Budgeter calcula el saldo actual a partir de ese punto de partida más cada transacción y transferencia desde entonces. Usa el botón ✎ para cambiar el nombre de una cuenta, su tipo, o corregir su saldo si se ha desviado de tu saldo bancario real — editar el saldo no afecta a ninguna transacción existente, simplemente ajusta el punto de partida para que todas las pantallas (Panel, Patrimonio neto, etc.) coincidan al instante. Las tarjetas de crédito también pueden tener un límite de crédito, que muestra una barra de usado/disponible en la tarjeta de la cuenta.',
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
      categoryAdded: 'Categoría añadida.', accountAdded: 'Cuenta añadida.', accountUpdated: 'Cuenta actualizada.',
      billAdded: 'Factura añadida.', budgetAdded: 'Presupuesto añadido.',
      transactionDeleted: 'Transacción eliminada.', categoryDeleted: 'Categoría eliminada.',
      accountDeleted: 'Cuenta eliminada.', billDeleted: 'Factura eliminada.',
      transferDeleted: 'Transferencia eliminada.', budgetDeleted: 'Presupuesto eliminado.',
      billPaid: 'Factura marcada como pagada.', billUnpaid: 'Factura marcada como pendiente.',
      billAutoPaid: '{name} ({amount}) pagada automáticamente.',
      billsAutoPaid: '{count} facturas pagadas automáticamente: {names}.',
      csvExported: 'Transacciones exportadas.', summaryCopied: 'Resumen copiado al portapapeles.',
      starterCategoriesAdded: '{count} categorías iniciales añadidas.',
      starterCategoriesNoneAdded: 'Todas las categorías iniciales ya existen — nada nuevo que añadir.',
      standingOrderAdded: 'Orden permanente añadida.', standingOrderDeleted: 'Orden permanente eliminada.',
      standingOrderPaid: 'Orden permanente marcada como realizada.', standingOrderUnpaid: 'Orden permanente marcada como no realizada.',
      standingOrderAutoPaid: '{name} ({amount}) transferida automáticamente.',
      standingOrdersAutoPaid: '{count} órdenes permanentes transferidas automáticamente: {names}.',
      budgetRolloverOn: 'Traslado activado para este presupuesto.',
      budgetRolloverOff: 'Traslado desactivado para este presupuesto.',
      billSubscriptionOn: 'Marcada como suscripción.',
      billSubscriptionOff: 'Desmarcada como suscripción.',
      savingsGoalAdded: 'Meta de ahorro añadida.', savingsGoalDeleted: 'Meta de ahorro eliminada.'
    },
    modalTitle: {
      addTransaction: 'Añadir transacción', addTransfer: 'Transferir entre cuentas',
      addCategory: 'Añadir categoría', addAccount: 'Añadir cuenta', addBill: 'Añadir factura',
      addBudget: 'Añadir presupuesto', addStandingOrder: 'Añadir orden permanente', addSavingsGoal: 'Añadir meta de ahorro',
      editAccount: 'Editar cuenta'
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
