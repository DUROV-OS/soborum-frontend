import {
  Boxes,
  Users,
  Truck,
  Factory,
  Wallet,
  Package,
  Building2,
  Handshake,
  ShoppingBag,
  Calculator,
  Home,
  type LucideIcon,
} from 'lucide-react'
import type { SectionId } from './sections'
import type { AccessLevel } from '@/auth/types'
import { salesRouteAllowed } from '@/auth/salesNavigation'
import { PARTNER_CATEGORIES } from '@/partners/types'

export type WorkEntry = {
  id: string
  label: string
  to: string
  section: SectionId
  note: string
  gate?: SectionId
  minimumAccess?: AccessLevel
  public?: boolean
  readOnly?: boolean
  signal?: boolean
  category?: string
}
export type WorkGroup = { id: string; label: string; note: string; icon: LucideIcon; entries: WorkEntry[]; standalone?: boolean }

// One process tree for the sidebar, work hub and the current section's sub-menu.
// Route/query values are UI state; module grants and API scopes remain unchanged.
const WORKFLOW_DEFINITIONS: WorkGroup[] = [
  {
    id: 'costing', label: 'Каталог и цены', icon: Calculator, standalone: true,
    note: 'Состав изделий, розничный прайс и версии клиентских предложений',
    entries: [
      { id: 'commercial-catalog', label: 'Прайс', to: '/costing?tab=catalog', section: 'estimates', note: 'Утверждённый розничный прайс и варианты для клиента' },
      { id: 'costing-assistant', label: 'Помощник', to: '/costing?tab=assistant', section: 'costing', note: 'Цены, составы и отклонения от целевой маржи' },
      { id: 'costing-materials', label: 'Материалы для смет', to: '/costing?tab=materials', section: 'costing', note: 'Единицы, цены и общая номенклатура склада' },
      { id: 'costing-estimates', label: 'Клиентские сметы', to: '/costing?tab=estimates', section: 'estimates', note: 'Снимки цен, варианты, скидки и предложения' },
      { id: 'costing-templates', label: 'Типовые сметы', to: '/costing?tab=template', section: 'costing', note: 'Изделия, геометрия, состав и расходы' },
      { id: 'costing-prices', label: 'Розничные цены', to: '/costing?tab=prices', section: 'costing', note: 'Замороженные ставки и версии прайса' },
      { id: 'costing-addons', label: 'Допы и замены', to: '/costing?tab=addon', section: 'costing', note: 'Опции, состав и вычет базовых материалов' },
      { id: 'costing-packages', label: 'Пакеты опций', to: '/costing?tab=package', section: 'costing', note: 'Наборы допов и пакетные скидки' },
      { id: 'costing-settings', label: 'Настройки', to: '/costing?tab=settings', section: 'costing', note: 'Проценты, округление и бренд' },
      { id: 'costing-journal', label: 'Журнал изменений', to: '/costing?tab=journal', section: 'costing', note: 'Автор и значения до и после правок' },
      { id: 'costing-help', label: 'Как работать', to: '/costing?tab=help', section: 'estimates', note: 'Инструкции и пошаговое обучение' },
    ],
  },
  {
    id: 'sales',
    label: 'Продажи',
    icon: ShoppingBag,
    standalone: true,
    note: 'Заказы, счета, отгрузки и счета-фактуры покупателей',
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
        id: 'customer-factures',
        label: 'Счета-фактуры выданные',
        to: '/moysklad?type=factureout',
        section: 'moysklad',
        gate: 'accounting',
        readOnly: true,
        note: 'Сохранённые выданные счета-фактуры',
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
      {
        id: 'supplier-factures',
        label: 'Счета-фактуры полученные',
        to: '/moysklad?type=facturein',
        section: 'moysklad',
        gate: 'accounting',
        readOnly: true,
        note: 'Сохранённые счета-фактуры поставщиков',
      },
    ],
  },
  {
    id: 'counterparties',
    label: 'Контрагенты',
    icon: Handshake,
    standalone: true,
    note: 'Карточки поставщиков и клиентов, реквизиты и документы',
    entries: [
      {
        id: 'suppliers',
        label: 'Реестр контрагентов',
        to: '/suppliers',
        section: 'suppliers',
        note: 'Контакты, реквизиты, история и связанные документы',
      },
    ],
  },
  {
    id: 'warehouse',
    label: 'Склад',
    icon: Boxes,
    standalone: true,
    note: 'Инвентаризация, остатки и движение между складами',
    entries: [
      {
        id: 'inventories',
        label: 'Инвентаризация',
        to: '/warehouse?tab=documents&kind=inventory',
        section: 'warehouse',
        note: 'Пересчёт и сверка фактического наличия',
      },
      {
        id: 'write-offs',
        label: 'Списания',
        to: '/warehouse?tab=history&reason=write_off',
        section: 'warehouse',
        note: 'Операции списания и причины уменьшения остатков',
      },
      {
        id: 'stock-receipts',
        label: 'Оприходования',
        to: '/warehouse?tab=history&reason=receipt',
        section: 'warehouse',
        note: 'Операции оприходования и причины увеличения остатков',
      },
      {
        id: 'transfers',
        label: 'Перемещения',
        to: '/warehouse?tab=documents&kind=transfer',
        section: 'warehouse',
        note: 'Передача товара с одного склада на другой',
      },
      {
        id: 'stock',
        label: 'Остатки',
        to: '/warehouse?tab=materials',
        section: 'warehouse',
        signal: true,
        note: 'Фактический и свободный остаток, пороги и потребность',
      },
      {
        id: 'warehouses',
        label: 'Склады',
        to: '/warehouse?tab=warehouses',
        section: 'warehouse',
        note: 'Список складов и переход к их остаткам',
      },
    ],
  },
  {
    id: 'nomenclature',
    label: 'Номенклатура',
    icon: Package,
    standalone: true,
    note: 'Каталог товаров и материалов',
    entries: [
      {
        id: 'materials',
        label: 'Товары',
        to: '/warehouse?tab=materials&view=catalog',
        section: 'warehouse',
        note: 'Рабочие карточки товаров и материалов на складах',
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
        label: 'Группы',
        to: '/moysklad?type=productfolder',
        section: 'moysklad',
        gate: 'warehouse',
        readOnly: true,
        note: 'Исходные группы и папки номенклатуры',
      },
      {
        id: 'catalog-filter',
        label: 'Фильтр',
        to: '/warehouse?tab=materials&view=filter',
        section: 'warehouse',
        note: 'Поиск и отбор товаров по категории, складу и архиву',
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
      {
        id: 'material-requests',
        label: 'Заявки производства',
        to: '/warehouse?tab=requests',
        section: 'warehouse',
        note: 'Проверка и частичная выдача материалов по заявкам',
      },
      {
        id: 'client-cycle',
        label: 'Цикл клиента',
        to: '/cycles',
        section: 'cycle',
        signal: true,
        note: 'Путь клиента от обращения до принятого дома',
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
        id: 'money-review',
        label: 'Рабочий обзор',
        to: '/accounting?tab=review',
        section: 'accounting',
        note: 'Документы, распределение по проектам и личная проверка бухгалтера',
      },
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
    standalone: true,
    note: 'Обращения, сделки, контакты и отношения с клиентами',
    entries: [
      {
        id: 'crm-inquiries',
        label: 'Входящие',
        to: '/crm?tab=inquiry',
        section: 'crm',
        note: 'Новые заявки и принятие в работу',
      },
      {
        id: 'crm-deals',
        label: 'Сделки',
        to: '/crm?tab=deal',
        section: 'crm',
        note: 'Воронки, этапы и контроль следующего шага',
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
      { id: 'crm-tasks', label: 'Задачи', to: '/crm?tab=task', section: 'crm', note: 'Задачи по обращениям и сделкам' },
      { id: 'crm-pipelines', label: 'Воронки', to: '/crm?tab=pipeline', section: 'crm', minimumAccess: 'full', note: 'Настройка воронок продаж' },
      {
        id: 'clients',
        label: 'Клиенты и договоры',
        to: '/clients',
        section: 'clients',
        signal: true,
        note: 'Карточки клиентов, договоры и оплаты',
      },
      { id: 'crm-stages', label: 'Этапы', to: '/crm?tab=stage', section: 'crm', minimumAccess: 'full', note: 'Настройка этапов воронок' },
    ],
  },
  {
    id: 'company',
    label: 'Маркетинг',
    icon: Building2,
    note: 'Каналы привлечения, кампании и результаты маркетинга',
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

const groupById = Object.fromEntries(WORKFLOW_DEFINITIONS.map(group => [group.id, group]))
const partners: WorkGroup = {
  id: 'partners', label: 'Партнёры', icon: Handshake, standalone: true,
  note: 'Агентства, риелторы, специалисты по земле и коммерческие партнёры',
  entries: [
    { id: 'partners-all', label: 'Все', to: '/partners?category=ALL', section: 'partners', note: 'Реестр партнёров и контакты' },
    ...PARTNER_CATEGORIES.map(({ key, plural }): WorkEntry => ({
      id: 'partners-' + key, label: plural, to: '/partners?category=' + key, section: 'partners',
      note: 'Контакты и договорённости',
    })),
  ],
}
const houseModels: WorkGroup = {
  id: 'house-models', label: 'Типовые проекты домов', icon: Home, standalone: true,
  note: 'Каталог проектов и информация о домах',
  entries: [
    { id: 'house-models', label: 'Каталог проектов', to: '/house-models', section: 'house_models', note: 'Модели, планы и характеристики домов' },
  ],
}
export const WORKFLOWS: WorkGroup[] = [
  groupById.sales, groupById.crm, partners, groupById.costing, houseModels,
  ...WORKFLOW_DEFINITIONS.filter(group => !['sales', 'crm', 'costing'].includes(group.id)),
].map(group => {
    if (group.id === 'production') return { ...group, entries: group.entries.map(entry => ({ ...entry, category: ['house-techcards', 'house-projects', 'production-standards', 'recipes'].includes(entry.id) ? 'Внутренние справочники' : 'Рабочие документы' })).sort((a, b) => Number(a.category === 'Внутренние справочники') - Number(b.category === 'Внутренние справочники')) }
    if (group.id === 'money') return { ...group, label: 'Бухгалтерия' }
    if (group.id === 'company') return { ...group, entries: group.entries.filter(entry => entry.id === 'marketing') }
    return group
  })

WORKFLOWS.push(
  { id: 'projects', label: 'Проекты', icon: Building2, note: 'Команда и ход выполнения проектов', entries: [{ id: 'projects', label: 'Проекты', to: '/projects', section: 'projects', note: 'Команда, задачи, обсуждения и документы' }] },
  { id: 'data', label: 'Архив', icon: Building2, note: 'Сохранённые документы и справочники', entries: [
    ...groupById.company.entries.filter(entry => entry.id === 'source-history'),
    { id: 'customer-returns', label: 'Возвраты покупателей', to: '/moysklad?type=salesreturn', section: 'moysklad', gate: 'clients', readOnly: true, note: 'Сохранённые документы возврата покупателей' },
  ] },
)

export function visibleWorkflows(hasAccess: (section: SectionId, level?: AccessLevel) => boolean, salesManager = false): WorkGroup[] {
  const groups = salesManager ? WORKFLOWS.filter(g => ['crm', 'partners', 'costing'].includes(g.id)) : WORKFLOWS
  return groups.map((g) => ({
    ...g,
    entries: g.entries.filter((e) => {
      if (salesManager) {
        const [path, search = ''] = e.to.split('?')
        if (!salesRouteAllowed(path, search)) return false
      }
      return (e.public || hasAccess(e.section, e.minimumAccess)) && (!e.gate || hasAccess(e.gate))
    }),
  })).filter((g) => g.entries.length > 0)
}

export function purchaseJournalTab(query: URLSearchParams) {
  const tab = query.get('tab')
  if (tab === 'returns' || (!tab && query.has('return'))) return 'returns'
  if (tab === 'receipts' || (!tab && query.has('receipt'))) return 'receipts'
  return 'orders'
}

export function workflowContext(pathname: string, search: string, groups: WorkGroup[] = WORKFLOWS) {
  const query = new URLSearchParams(search)
  if (pathname.startsWith('/costing/catalog/') || pathname.startsWith('/costing/models/')) {
    pathname = '/costing'
    query.set('tab', 'catalog')
  }
  if (pathname === '/purchasing') query.set('tab', purchaseJournalTab(query))
  if ((pathname === '/partners' || pathname.startsWith('/partners/')) && !query.has('category')) query.set('category', 'ALL')
  if (pathname === '/warehouse') {
    const tab = query.get('tab') || 'queue'
    const reason = query.get('reason')
    if (tab === 'queue' || tab === 'returns' || tab === 'reservations' ||
      (tab === 'history' && reason !== 'receipt' && reason !== 'write_off')) query.set('tab', 'materials')
    if (tab === 'documents' && !query.get('kind')) query.set('kind', 'inventory')
  }
  if (!query.has('tab')) {
    const defaults: Record<string, string> = {
      '/sales': query.has('shipment') ? 'shipments' : 'orders',
      '/crm': 'deal',
      '/costing': 'estimates',
      '/accounting': 'review',
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
