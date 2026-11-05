import {
  Boxes,
  Users,
  Truck,
  Factory,
  Wallet,
  Package,
  Building2,
  ShoppingBag,
  Calculator,
  type LucideIcon,
} from 'lucide-react'
import type { SectionId } from './sections'

export type WorkEntry = {
  id: string
  label: string
  to: string
  section: SectionId
  note: string
  gate?: SectionId
  public?: boolean
  readOnly?: boolean
  signal?: boolean
  category?: string
}
export type WorkGroup = { id: string; label: string; note: string; icon: LucideIcon; entries: WorkEntry[] }

// One process tree for the sidebar, work hub and the current section's sub-menu.
// Route/query values are UI state; module grants and API scopes remain unchanged.
const WORKFLOW_DEFINITIONS: WorkGroup[] = [
  {
    id: 'costing', label: 'Сметы и цены', icon: Calculator,
    note: 'Состав изделий, розничный прайс и версии клиентских предложений',
    entries: [
      { id: 'costing-estimates', label: 'Клиентские сметы', to: '/costing?tab=estimates', section: 'estimates', note: 'Снимки цен, варианты, скидки и предложения' },
      { id: 'costing-materials', label: 'Материалы для смет', to: '/costing?tab=materials', section: 'costing', note: 'Единицы, цены и общая номенклатура склада' },
      { id: 'costing-templates', label: 'Типовые сметы', to: '/costing?tab=template', section: 'costing', note: 'Изделия, геометрия, состав и расходы' },
      { id: 'costing-prices', label: 'Розничные цены', to: '/costing?tab=prices', section: 'costing', note: 'Замороженные ставки и версии прайса' },
      { id: 'costing-addons', label: 'Допы и замены', to: '/costing?tab=addon', section: 'costing', note: 'Опции, состав и вычет базовых материалов' },
      { id: 'costing-packages', label: 'Пакеты опций', to: '/costing?tab=package', section: 'costing', note: 'Наборы допов и пакетные скидки' },
      { id: 'costing-assistant', label: 'Проверка расчётов', to: '/costing?tab=assistant', section: 'costing', note: 'Цены, составы и отклонения от целевой маржи' },
      { id: 'costing-journal', label: 'Журнал изменений', to: '/costing?tab=journal', section: 'costing', note: 'Автор и значения до и после правок' },
      { id: 'costing-settings', label: 'Настройки расчётов', to: '/costing?tab=settings', section: 'costing', note: 'Проценты, округление и бренд' },
      { id: 'costing-help', label: 'Руководство по сметам', to: '/costing?tab=help', section: 'estimates', note: 'Инструкции и пошаговое обучение' },
    ],
  },
  {
    id: 'sales',
    label: 'Продажи',
    icon: ShoppingBag,
    note: 'Заказы, счета, отгрузки, оплата и возвраты',
    entries: [
      {
        id: 'customer-orders',
        label: 'Заказы покупателей',
        to: '/sales?tab=orders',
        section: 'sales',
        note: 'Состав заказа, цены, срок, резерв и исполнение',
      },
      {
        id: 'customer-invoices',
        label: 'Счета покупателям',
        to: '/moysklad?type=invoiceout',
        section: 'moysklad',
        gate: 'clients',
        readOnly: true,
        note: 'Сохранённые счета покупателям и их документы',
      },
      {
        id: 'shipments',
        label: 'Отгрузки',
        to: '/sales?tab=shipments',
        section: 'sales',
        note: 'Частичная выдача, проведение и история отгрузок',
      },
      {
        id: 'customer-returns',
        label: 'Возвраты покупателей',
        to: '/moysklad?type=salesreturn',
        section: 'moysklad',
        gate: 'clients',
        readOnly: true,
        note: 'Сохранённые документы возврата покупателей',
      },
    ],
  },
  {
    id: 'purchasing',
    label: 'Закупки',
    icon: Truck,
    note: 'Заказы поставщикам, счета, приёмки, оплата и возвраты',
    entries: [
      {
        id: 'suppliers',
        label: 'Поставщики',
        to: '/suppliers',
        section: 'suppliers',
        note: 'Контакты поставщиков, прайс-листы и закупки',
      },
      {
        id: 'supplier-orders',
        label: 'Заказы поставщикам',
        to: '/purchasing?tab=orders',
        section: 'purchasing',
        note: 'Потребность, позиции, сроки поставки и оплата',
      },
      {
        id: 'supplier-invoices',
        label: 'Счета поставщиков',
        to: '/moysklad?type=invoicein',
        section: 'moysklad',
        gate: 'accounting',
        readOnly: true,
        note: 'Сохранённые счета поставщиков',
      },
      {
        id: 'receipts',
        label: 'Приёмки',
        to: '/purchasing?tab=receipts',
        section: 'purchasing',
        note: 'Фактически полученные товары и остаток заказа',
      },
      {
        id: 'supplier-returns',
        label: 'Возвраты поставщикам',
        to: '/purchasing?tab=returns',
        section: 'purchasing',
        note: 'Возврат по приёмке, уменьшение долга и история',
      },
    ],
  },
  {
    id: 'warehouse',
    label: 'Склад',
    icon: Boxes,
    note: 'Наличие товара, резервы и движение между складами',
    entries: [
      {
        id: 'stock',
        label: 'Остатки',
        to: '/warehouse?tab=materials',
        section: 'warehouse',
        signal: true,
        note: 'Фактический и свободный остаток, пороги и потребность',
      },
      {
        id: 'reservations',
        label: 'Резервы',
        to: '/warehouse?tab=reservations',
        section: 'warehouse',
        note: 'Товар, закреплённый за домом или заказом',
      },
      {
        id: 'transfers',
        label: 'Перемещения',
        to: '/warehouse?tab=documents&kind=transfer',
        section: 'warehouse',
        note: 'Передача товара с одного склада на другой',
      },
      {
        id: 'inventories',
        label: 'Инвентаризации',
        to: '/warehouse?tab=documents&kind=inventory',
        section: 'warehouse',
        note: 'Пересчёт и сверка фактического наличия',
      },
      {
        id: 'stock-journal',
        label: 'Журнал операций',
        to: '/warehouse?tab=history',
        section: 'warehouse',
        note: 'Приход, расход, списания и история движения',
      },
      {
        id: 'material-requests',
        label: 'Заявки производства',
        to: '/warehouse?tab=requests',
        section: 'warehouse',
        note: 'Проверка и частичная выдача материалов по заявкам',
      },
    ],
  },
  {
    id: 'goods',
    label: 'Товары',
    icon: Package,
    note: 'Номенклатура, карточки, модификации и услуги',
    entries: [
      {
        id: 'materials',
        label: 'Номенклатура',
        to: '/warehouse?tab=materials&view=catalog',
        section: 'warehouse',
        note: 'Рабочие карточки товаров и материалов на складах',
      },
      {
        id: 'source-products',
        label: 'Карточки из МойСклада',
        to: '/moysklad?type=product',
        section: 'moysklad',
        gate: 'warehouse',
        readOnly: true,
        note: 'Сохранённые реквизиты, цены и характеристики товаров',
      },
      {
        id: 'source-variants',
        label: 'Модификации',
        to: '/moysklad?type=variant',
        section: 'moysklad',
        gate: 'warehouse',
        readOnly: true,
        note: 'Варианты товаров по характеристикам',
      },
      {
        id: 'source-services',
        label: 'Услуги',
        to: '/moysklad?type=service',
        section: 'moysklad',
        gate: 'warehouse',
        readOnly: true,
        note: 'Сохранённые карточки услуг',
      },
      {
        id: 'source-bundles',
        label: 'Комплекты',
        to: '/moysklad?type=bundle',
        section: 'moysklad',
        gate: 'warehouse',
        readOnly: true,
        note: 'Состав сохранённых комплектов',
      },
      {
        id: 'source-folders',
        label: 'Группы товаров',
        to: '/moysklad?type=productfolder',
        section: 'moysklad',
        gate: 'warehouse',
        readOnly: true,
        note: 'Исходные группы и папки номенклатуры',
      },
    ],
  },
  {
    id: 'production',
    label: 'Производство',
    icon: Factory,
    note: 'Нормативы → план производства → выпуск → монтаж',
    entries: [
      {
        id: 'production-houses',
        label: 'Дома в производстве',
        to: '/production',
        section: 'production',
        signal: true,
        note: 'Этапы, материалы, задачи и готовность домов',
      },
      { id: 'house-techcards', label: 'Техкарты домов', to: '/production-library?tab=cards', section: 'production', note: 'Черновики по моделям, нормы материалов и источники' },
      { id: 'house-projects', label: 'Проекты АР и КР', to: '/production-library?tab=projects', section: 'production', note: 'Рабочие чертежи и редакции по каждому дому' },
      { id: 'production-standards', label: 'ГОСТы и СП', to: '/production-library?tab=standards', section: 'production', note: 'Нормативные документы и официальный источник' },
      {
        id: 'recipes',
        label: 'Техкарты и выпуск',
        to: '/recipes',
        section: 'recipes',
        note: 'Нормативы материалов и выпуск готовой продукции',
      },
      {
        id: 'production-tasks',
        label: 'Производственные задания',
        to: '/moysklad?type=productiontask',
        section: 'moysklad',
        gate: 'production',
        readOnly: true,
        note: 'Сохранённые производственные задания',
      },
      {
        id: 'source-processing',
        label: 'Техоперации',
        to: '/moysklad?type=processing',
        section: 'moysklad',
        gate: 'production',
        readOnly: true,
        note: 'История производственных операций',
      },
      {
        id: 'installation',
        label: 'Монтаж',
        to: '/montage',
        section: 'installation',
        signal: true,
        note: 'Доставка, монтаж и приёмка на объекте',
      },
    ],
  },
  {
    id: 'money',
    label: 'Деньги',
    icon: Wallet,
    note: 'Платежи, счета организаций и расчёты с контрагентами',
    entries: [
      {
        id: 'money-register',
        label: 'Платежи',
        to: '/accounting?tab=register',
        section: 'accounting',
        signal: true,
        note: 'Приход и расход по счетам организаций',
      },
      {
        id: 'money-overview',
        label: 'Сводка по деньгам',
        to: '/accounting?tab=overview',
        section: 'accounting',
        note: 'Движение денег и финансовые показатели',
      },
      {
        id: 'counterparties',
        label: 'Контрагенты',
        to: '/accounting?tab=counterparties',
        section: 'accounting',
        note: 'Общий справочник покупателей, поставщиков и других контрагентов',
      },
      {
        id: 'salary',
        label: 'Расчёты с сотрудниками',
        to: '/accounting?tab=salary',
        section: 'accounting',
        note: 'Начисления и выплаты сотрудникам',
      },
    ],
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: Users,
    note: 'Обращения, сделки, контакты и отношения с клиентами',
    entries: [
      {
        id: 'crm-deals',
        label: 'Сделки',
        to: '/crm?tab=deal',
        section: 'crm',
        note: 'Воронки, этапы и контроль следующего шага',
      },
      {
        id: 'crm-inquiries',
        label: 'Входящие обращения',
        to: '/crm?tab=inquiry',
        section: 'crm',
        note: 'Новые заявки и принятие в работу',
      },
      {
        id: 'crm-contacts',
        label: 'Контакты',
        to: '/crm?tab=contact',
        section: 'crm',
        note: 'Контактные лица и история общения',
      },
      {
        id: 'crm-companies',
        label: 'Компании',
        to: '/crm?tab=company',
        section: 'crm',
        note: 'Организации клиентов и связанные сделки',
      },
      {
        id: 'clients',
        label: 'Клиенты и договоры',
        to: '/clients',
        section: 'clients',
        signal: true,
        note: 'Карточки клиентов, договоры и оплаты',
      },
      {
        id: 'client-cycle',
        label: 'Цикл клиента',
        to: '/cycles',
        section: 'cycle',
        signal: true,
        note: 'Путь клиента от обращения до принятого дома',
      },
      {
        id: 'partners',
        label: 'Партнёры',
        to: '/partners',
        section: 'partners',
        note: 'Агентства, риэлторы и другие партнёры',
      },
    ],
  },
  {
    id: 'company',
    label: 'Компания и команда',
    icon: Building2,
    note: 'Маркетинг, знания о проектах и совместная работа',
    entries: [
      {
        id: 'marketing',
        label: 'Маркетинг',
        to: '/marketing',
        section: 'marketing',
        signal: true,
        note: 'Каналы привлечения, кампании и заявки',
      },
      {
        id: 'house-models',
        label: 'Типовые проекты домов',
        to: '/house-models',
        section: 'house_models',
        note: 'Каталог проектов и информация о домах',
      },
      {
        id: 'meetings',
        label: 'Совещания',
        to: '/meetings',
        section: 'meetings',
        note: 'Встречи, обсуждения и принятые решения',
      },
      {
        id: 'chats',
        label: 'MAX',
        to: '/chats',
        section: 'chats',
        note: 'Переписки с клиентами и сотрудниками',
      },
      {
        id: 'source-history',
        label: 'Все сохранённые данные',
        to: '/moysklad',
        section: 'moysklad',
        readOnly: true,
        note: 'Общий поиск по перенесённым документам и справочникам',
      },
    ],
  },
]

// Customer documents and internal reference data belong to separate levels of
// the same departmental menu. They keep their existing routes and API grants.
const groupById = Object.fromEntries(WORKFLOW_DEFINITIONS.map(group => [group.id, group]))
const withCategory = (entries: WorkEntry[], category: string) => entries.map(entry => ({ ...entry, category }))
export const WORKFLOWS: WorkGroup[] = WORKFLOW_DEFINITIONS
  .filter(group => !['costing', 'crm', 'goods'].includes(group.id))
  .map(group => {
    if (group.id === 'sales') return { ...group, entries: [
      { ...groupById.crm.entries[0], label: 'CRM', to: '/crm', note: 'Сделки, обращения, контакты и компании', category: 'Работа с клиентами' },
      ...withCategory(groupById.crm.entries.filter(entry => ['clients', 'client-cycle', 'partners'].includes(entry.id)), 'Работа с клиентами'),
      ...withCategory(groupById.costing.entries.filter(entry => entry.id === 'costing-estimates'), 'Документы для клиентов'),
      ...withCategory(group.entries, 'Документы для клиентов'),
      { id: 'commercial-catalog', label: 'Каталог и цены', to: '/costing?tab=catalog', section: 'estimates' as SectionId, note: 'Утверждённый розничный прайс и варианты для клиента', category: 'Справочники продаж' },
      ...withCategory(groupById.costing.entries.filter(entry => entry.id !== 'costing-estimates' && entry.id !== 'costing-help'), 'Каталог и цены · внутренние справочники'),
      ...withCategory(groupById.company.entries.filter(entry => entry.id === 'house-models'), 'Каталог и цены · внутренние справочники'),
      ...withCategory(groupById.costing.entries.filter(entry => entry.id === 'costing-help'), 'Помощь'),
    ] }
    if (group.id === 'warehouse') return { ...group, entries: [...withCategory(group.entries, 'Складские операции'), ...withCategory(groupById.goods.entries, 'Справочники')] }
    if (group.id === 'production') return { ...group, entries: group.entries.map(entry => ({ ...entry, category: ['house-techcards', 'house-projects', 'production-standards', 'recipes'].includes(entry.id) ? 'Внутренние справочники' : 'Рабочие документы' })).sort((a, b) => Number(a.category === 'Внутренние справочники') - Number(b.category === 'Внутренние справочники')) }
    if (group.id === 'money') return { ...group, label: 'Бухгалтерия' }
    if (group.id === 'company') return { ...group, entries: group.entries.filter(entry => entry.id !== 'house-models') }
    return group
  })

export function visibleWorkflows(hasAccess: (section: SectionId) => boolean): WorkGroup[] {
  return WORKFLOWS.map((g) => ({
    ...g,
    entries: g.entries.filter((e) => (e.public || hasAccess(e.section)) && (!e.gate || hasAccess(e.gate))),
  })).filter((g) => g.entries.length > 0)
}

export function workflowContext(pathname: string, search: string, groups: WorkGroup[] = WORKFLOWS) {
  const query = new URLSearchParams(search)
  if (!query.has('tab')) {
    const defaults: Record<string, string> = {
      '/sales': query.has('shipment') ? 'shipments' : 'orders',
      '/purchasing': query.has('return') ? 'returns' : 'orders',
      '/warehouse': 'materials',
      '/crm': 'deal',
      '/accounting': 'register',
      '/production-library': 'cards',
    }
    if (defaults[pathname]) query.set('tab', defaults[pathname])
  }
  let best: { group: WorkGroup; entry: WorkEntry; score: number } | undefined
  for (const group of groups)
    for (const entry of group.entries) {
      const [path, search = ''] = entry.to.split('?'),
        expected = new URLSearchParams(search)
      if (pathname !== path && !pathname.startsWith(path + '/')) continue
      if ([...expected].some(([k, v]) => query.get(k) !== v)) continue
      const score = path.length + expected.size * 1000
      if (!best || score > best.score) best = { group, entry, score }
    }
  return best
}
