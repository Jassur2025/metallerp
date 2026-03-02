/**
 * UI Selectors for MetalMaster ERP E2E Tests
 * 
 * Centralized selectors — all Russian UI strings here so tests
 * don't break when labels change.
 */

// ─── Login ───────────────────────────────────────────────────
export const LOGIN = {
  title: 'MetalMaster ERP',
  button: 'Войти через Google',
  buttonLoading: 'Вход...',
} as const;

// ─── Sidebar Navigation ─────────────────────────────────────
export const NAV = {
  dashboard: 'Дашборд',
  inventory: 'Склад',
  procurement: 'Закуп',
  sales: 'Касса',
  workflow: 'Workflow',
  reports: 'Отчеты',
  crm: 'Клиенты',
  staff: 'Сотрудники',
  payroll: 'Зарплата',
  fixedAssets: 'Осн. Средства',
  balance: 'Баланс',
  journal: 'Журнал',
  priceList: 'Прайс',
  settings: 'Настройки',
  logout: 'Выйти',
} as const;

// ─── Workflow ────────────────────────────────────────────────
export const WORKFLOW = {
  tabs: {
    create: 'Создать',
    queue: /^Очередь/,
    cancelled: /^Аннул\./,
  },
  search: 'Поиск товара...',
  addButton: 'Добавить',
  cart: {
    header: /^Заявка/,
    client: 'Клиент',
    phone: 'Телефон',
    exchangeRate: 'Курс',
    emptyCart: 'Корзина пуста',
  },
  payment: {
    cash: 'Нал',
    bank: 'Банк',
    card: 'Карта',
    debt: 'Долг',
  },
  currency: {
    uzs: 'UZS',
    usd: 'USD',
  },
  submit: 'Отправить',
  resubmit: 'Переотправить',
  total: 'ИТОГО',
  status: {
    sentToCash: 'На кассе',
    sentToProcurement: 'В закупе',
    completed: 'Выполнен',
    cancelled: 'Аннулирован',
  },
} as const;

// ─── Sales / Касса ──────────────────────────────────────────
export const SALES = {
  modes: {
    sale: 'Новая Продажа',
    expense: 'Новый Расход',
    return: 'Возврат',
    workflow: 'Workflow',
    transactions: 'Транзакции',
  },
  cart: {
    header: 'Корзина',
    empty: 'Корзина пуста',
    client: 'Клиент...',
    seller: 'Продавец...',
    newClient: 'Новый клиент',
  },
  payment: {
    cash: 'Наличные',
    card: 'Карта (UZS)',
    bank: 'Перечисление (UZS)',
    debt: 'Долг (USD)',
    mixed: 'Смешанная оплата (Частично)',
  },
  cashCurrency: {
    uzs: 'В Сумах (UZS)',
    usd: 'В Долларах (USD)',
  },
  discount: {
    toggle: 'Добавить скидку',
  },
  submit: 'Оформить и оплатить',
  submitDebt: 'Оформить в долг',
  receipt: {
    view: 'Просмотр чека',
    invoice: 'Счет',
    waybill: 'Накладная',
  },
  total: /ИТОГО/,
} as const;

// ─── Procurement / Закуп ────────────────────────────────────
export const PROCUREMENT = {
  header: 'Закуп и Импорт',
  type: {
    local: 'Местный Закуп',
    import: 'Импорт',
  },
  tabs: {
    new: 'Новая закупка',
    workflow: 'Workflow',
    history: 'История и Долги',
  },
  form: {
    supplier: 'Название поставщика',
    warehouse: {
      main: /Основной склад/,
      cloud: /Облачный склад/,
    },
  },
  payment: {
    cash: /Наличные/,
    card: /Карта/,
    bank: /Банк/,
    debt: /В долг/,
    mixed: /Смешанная/,
  },
  addProduct: 'Добавить',
} as const;

// ─── CRM / Клиенты ─────────────────────────────────────────
export const CRM = {
  header: 'База Клиентов',
  search: 'Поиск по имени, телефону, ИНН...',
  addClient: 'Новый клиент',
  filter: {
    all: 'Все',
    individual: /Физ/,
    legal: /Юр/,
  },
} as const;

// ─── Toast Messages ─────────────────────────────────────────
export const TOAST = {
  workflowSentToCash: 'Заявка отправлена в кассу.',
  workflowSentToProcurement: /Заявка отправлена в закуп/,
  workflowApproved: /Подтверждено/,
  workflowConfirmed: 'Workflow подтвержден!',
  purchaseComplete: 'Закупка проведена!',
  debtRepaid: /Долг успешно погашен/,
  expenseAdded: 'Расход добавлен!',
  returnProcessed: 'Возврат оформлен!',
  clientRequired: 'Укажите клиента',
  cartEmpty: 'Корзина пуста',
} as const;
