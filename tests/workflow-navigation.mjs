import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173'
const sidebarLabels = async menu =>
  (await menu.locator('nav > ul > li > :is(a, button)').allTextContents()).map(label => label.trim())
const ownerMenu = [
  'Разделы', 'Пульс', 'Совместная работа', 'CRM', 'Партнёры', 'Продажи', 'Контрагенты', 'Склад', 'Закупки',
  'Номенклатура', 'Производство', 'Проекты', 'Каталог и цены', 'Типовые проекты домов', 'Маркетинг', 'Бухгалтерия', 'Архив',
  'Совет директоров', 'Агенты', 'Предложения ИИ', 'Уведомления', 'Мои заявки', 'Заявки',
  'Доступы и настройки',
]
const browser = await chromium.launch({ headless: true, channel: process.env.SMOKE_BROWSER_CHANNEL || undefined })
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  })
  await context.addInitScript(() => {
    localStorage.setItem('soborbum.auth.token', 'synthetic-navigation-test')
    for (const id of ['warehouse', 'cycle', 'clients'])
      localStorage.setItem('soborbum.onboarding.' + id, '1')
  })
  const page = await context.newPage(),
    errors = [],
    requests = []
  let actor = {
    id: 1,
    full_name: 'Проверка меню',
    email: 'owner@example.test',
    role: 'admin',
    is_active: true,
    module_access: {},
  }
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname
    requests.push(path + url.search)
    let body = []
    if (path === '/api/auth/me') body = actor
    else if (path.endsWith('/analytics'))
      body = {
        status: 'unknown',
        source: 'rules',
        generated_at: new Date().toISOString(),
        summary: 'Тестовый обзор',
      }
    else if (path === '/api/notifications/unread-count') body = { count: 0 }
    else if (path === '/api/sales/catalog') body = { counterparties: [], organizations: [], materials: [] }
    else if (path === '/api/purchasing/catalog') body = { suppliers: [], materials: [], accounts: [] }
    else if (path === '/api/costing/access') body = { internal: actor.role === 'admin' }
    else if (path === '/api/costing/catalog/models') body = { items: [] }
    else if (path === '/api/house-models/catalog') body = { series: [], individual: [] }
    else if (path === '/api/warehouse/warehouses') body = ['Склад проверки']
    else if (path === '/api/moysklad/catalog')
      body = {
        categories: [
          { type: 'invoiceout', title: 'Счета покупателям', count: 9, archived: 1 },
          { type: 'invoicein', title: 'Счета поставщиков', count: 10, archived: 1 },
          { type: 'product', title: 'Товары', count: 5, archived: 0 },
        ],
        source_completed_at: '2026-10-28T19:38:50Z',
        warnings: [],
      }
    else if (path === '/api/crm/catalog') body = { pipelines: [], stages: [], users: [], counts: {} }
    else if (path === '/api/crm/attention')
      body = { total: 0, counts: {}, items: [], settings: { response_hours: 24, idle_days: 3 } }
    else if (path.startsWith('/api/dashboard/today/section/'))
      body = { action: null, checked: false, clear_text: null, agent_note: null }
    else if (
      path.startsWith('/api/sales/orders') ||
      path.startsWith('/api/sales/shipments') ||
      path.startsWith('/api/purchasing/orders') ||
      path.startsWith('/api/purchasing/receipts') ||
      path.startsWith('/api/purchasing/returns') ||
      path === '/api/moysklad/records' ||
      path === '/api/warehouse/documents' ||
      path === '/api/warehouse/reservations' ||
      path === '/api/crm/entries'
    )
      body = { total: 0, items: [] }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(base + '/work', { waitUntil: 'networkidle' })
  const main = page.getByRole('main'),
    sidebar = page.getByRole('complementary', { name: 'Главное меню' })
  assert.deepEqual(await sidebarLabels(sidebar), ownerMenu)
  for (const name of ['Продажи', 'CRM', 'Партнёры', 'Каталог и цены', 'Типовые проекты домов',
    'Закупки', 'Контрагенты', 'Склад', 'Номенклатура', 'Производство', 'Бухгалтерия', 'Архив'])
    await main.getByRole('heading', { name, exact: true }).waitFor()
  await sidebar.getByRole('button', { name: 'Архив', exact: true }).click()
  await sidebar.locator('#workflow-data').getByRole('link', { name: /Возвраты покупателей/ }).click()
  await page.waitForURL('**/moysklad?type=salesreturn')
  await sidebar.getByRole('link', { name: 'Разделы', exact: true }).click()
  await main.getByRole('region', { name: 'Контрагенты', exact: true }).getByRole('link', { name: /Реестр контрагентов/ }).waitFor()
  assert.equal(await main.getByRole('region', { name: 'Закупки', exact: true }).locator('a[href="/suppliers"]').count(), 0)
  const purchases = page.getByRole('navigation', { name: 'Разделы закупок' })
  await sidebar.getByRole('link', { name: 'Закупки', exact: true }).click()
  await purchases.getByRole('link', { name: 'Заказы поставщикам', exact: true }).waitFor()
  assert.equal(await purchases.getByRole('link', { name: 'Контрагенты', exact: true }).count(), 0)
  await sidebar.getByRole('link', { name: 'Разделы', exact: true }).click()
  assert.equal(await main.getByRole('region', { name: 'CRM', exact: true }).locator('a[href="/suppliers"]').count(), 0)
  await main.getByRole('link', { name: /Заказы покупателей/ }).click()
  const sales = page.getByRole('navigation', { name: 'Раздел «Продажи»' })
  await sales.waitFor()
  assert.deepEqual(await sales.getByRole('link').allTextContents(),
    ['Заказы покупателей', 'Счета покупателям', 'Отгрузки', 'Счета-фактуры выданные'])
  const shipments = sales.getByRole('link', { name: 'Отгрузки', exact: true })
  await shipments.click()
  assert.equal(await shipments.getAttribute('aria-current'), 'page')
  await page.reload({ waitUntil: 'networkidle' })
  assert.equal(await shipments.getAttribute('aria-current'), 'page')
  await page.goBack({ waitUntil: 'networkidle' })
  assert.equal(await sales.getByRole('link', { name: 'Заказы покупателей', exact: true }).getAttribute('aria-current'), 'page')
  await sidebar.getByRole('link', { name: 'Закупки', exact: true }).click()
  for (const name of ['Приёмки', 'Возвраты поставщикам']) {
    const link = purchases.getByRole('link', { name, exact: true })
    await link.click()
    assert.equal(await link.getAttribute('aria-current'), 'page')
  }
  const warehouse = sidebar.getByRole('link', { name: 'Склад', exact: true })
  const warehouseTabs = page.getByRole('navigation', { name: 'Раздел «Склад»' })
  const catalogTabs = page.getByRole('navigation', { name: 'Раздел «Номенклатура»' })
  await warehouse.click()
  assert.deepEqual(await warehouseTabs.getByRole('link').allTextContents(),
    ['Инвентаризация', 'Списания', 'Оприходования', 'Перемещения', 'Остатки', 'Склады'])
  for (const [label, path, parameter, value] of [
    ['Перемещения', '/api/warehouse/documents', 'kind', 'transfer'],
    ['Инвентаризация', '/api/warehouse/documents', 'kind', 'inventory'],
    ['Списания', '/api/warehouse/journal', 'reason', 'write_off'],
    ['Оприходования', '/api/warehouse/journal', 'reason', 'receipt'],
  ]) {
    const link = warehouseTabs.getByRole('link', { name: label, exact: true })
    await Promise.all([
      page.waitForRequest(r => new URL(r.url()).pathname === path && new URL(r.url()).searchParams.get(parameter) === value),
      link.click(),
    ])
    assert.equal(await link.getAttribute('aria-current'), 'page')
  }
  await warehouseTabs.getByRole('link', { name: 'Склады', exact: true }).click()
  await main.getByRole('link', { name: 'Склад проверки', exact: true }).click()
  assert.equal(await main.getByLabel('Склад', { exact: true }).inputValue(), 'Склад проверки')
  assert.equal(await warehouseTabs.getByRole('link', { name: 'Остатки', exact: true }).getAttribute('aria-current'), 'page')
  await main.getByRole('tab', { name: 'Очередь выдачи', exact: true }).click()
  assert.equal(await warehouseTabs.getByRole('link', { name: 'Остатки', exact: true }).getAttribute('aria-current'), 'page')
  const nomenclature = sidebar.getByRole('link', { name: 'Номенклатура', exact: true })
  await nomenclature.click()
  await main.getByRole('heading', { name: 'Товары и материалы', exact: true }).waitFor()
  assert.equal(await nomenclature.getAttribute('aria-current'), 'page')
  assert.deepEqual(await catalogTabs.getByRole('link').allTextContents(),
    ['Товары', 'Услуги', 'Комплекты', 'Группы', 'Фильтр', 'Модификации'])
  for (const [label, type] of [['Услуги', 'service'], ['Комплекты', 'bundle'], ['Группы', 'productfolder'], ['Модификации', 'variant']]) {
    const link = catalogTabs.getByRole('link', { name: label, exact: true })
    await Promise.all([
      page.waitForRequest(r => new URL(r.url()).pathname === '/api/moysklad/records' && new URL(r.url()).searchParams.get('entity_type') === type),
      link.click(),
    ])
    assert.equal(await link.getAttribute('aria-current'), 'page')
    assert.equal(await nomenclature.getAttribute('aria-current'), 'page')
  }
  await catalogTabs.getByRole('link', { name: 'Фильтр', exact: true }).click()
  await main.getByRole('heading', { name: 'Фильтр номенклатуры', exact: true }).waitFor()
  await main.getByLabel('Склад', { exact: true }).waitFor()
  await sidebar.getByRole('button', { name: 'Производство', exact: true }).click()
  await sidebar.locator('#workflow-production').getByRole('link', { name: 'Заявки производства', exact: true }).click()
  await main.getByRole('heading', { name: 'Заявки производства', exact: true }).waitFor()
  assert.equal(await page.getByRole('navigation', { name: 'Раздел Производство' }).getByRole('link', { name: 'Заявки производства', exact: true }).getAttribute('aria-current'), 'page')
  assert.equal(await warehouseTabs.count(), 0)
  const cycle = page.getByRole('navigation', { name: 'Раздел Производство' }).getByRole('link', { name: 'Цикл клиента', exact: true })
  await cycle.click()
  await page.waitForURL('**/cycles')
  assert.equal(await cycle.getAttribute('aria-current'), 'page')
  await sidebar.getByRole('link', { name: 'Продажи', exact: true }).click()
  await sales.getByRole('link', { name: 'Счета-фактуры выданные', exact: true }).click()
  await main.getByRole('heading', { name: 'Счета-фактуры выданные', exact: true }).waitFor()
  const customerInvoices = sales.getByRole('link', { name: 'Счета покупателям', exact: true })
  await customerInvoices.click()
  await page.getByRole('heading', { name: 'Счета покупателям', exact: true }).waitFor()
  assert.equal(await customerInvoices.getAttribute('aria-current'), 'page')
  await page.getByLabel('Архив', { exact: true }).selectOption('archived')
  await page.reload({ waitUntil: 'networkidle' })
  assert.equal(await page.getByLabel('Архив', { exact: true }).inputValue(), 'archived')
  assert.ok(
    requests.some(
      (r) =>
        r.includes('/api/moysklad/records?') &&
        r.includes('entity_type=invoiceout') &&
        r.includes('archive=archived'),
    ),
  )
  await sidebar.getByRole('link', { name: 'CRM', exact: true }).click()
  const crmTabs = page.getByRole('navigation', { name: 'Разделы CRM', exact: true })
  await crmTabs.waitFor()
  assert.deepEqual(await crmTabs.getByRole('tab').allTextContents(),
    ['Входящие', 'Сделки', 'Контакты', 'Компании', 'Задачи', 'Воронки', 'Клиенты и договоры', 'Этапы'])
  await crmTabs.getByRole('tab', { name: 'Клиенты и договоры', exact: true }).click()
  await page.waitForURL('**/clients')
  const crmLinks = page.getByRole('navigation', { name: 'Раздел «CRM»', exact: true })
  await crmLinks.getByRole('link', { name: 'Контакты', exact: true }).click()
  await page.getByRole('tab', { name: /^Контакты(?: · \d+)?$/ }).click()
  await page.getByRole('tab', { name: /^Контакты(?: · \d+)?$/ }).waitFor()
  assert.equal(
    await page.getByRole('tab', { name: /^Контакты(?: · \d+)?$/ }).getAttribute('aria-selected'),
    'true',
  )
  await sidebar.getByRole('link', { name: 'Партнёры', exact: true }).click()
  const partnerTabs = page.getByRole('navigation', { name: 'Разделы партнёров', exact: true })
  await partnerTabs.waitFor()
  assert.deepEqual((await partnerTabs.getByRole('tab').allTextContents()).map(text => text.split(' · ')[0]),
    ['Все', 'Агентства недвижимости', 'Риелторы', 'Специалисты по земле', 'Коммерция'])
  const realtors = partnerTabs.getByRole('tab', { name: /^Риелторы/ })
  await realtors.click()
  await page.reload({ waitUntil: 'networkidle' })
  assert.equal(await realtors.getAttribute('aria-selected'), 'true')
  await sidebar.getByRole('link', { name: 'Каталог и цены', exact: true }).click()
  const catalog = page.getByRole('navigation', { name: 'Разделы смет', exact: true })
  await catalog.getByRole('button', { name: 'Помощник', exact: true }).waitFor()
  assert.deepEqual(await catalog.getByRole('button').allTextContents(),
    ['Прайс', 'Помощник', 'Материалы для смет', 'Клиентские сметы', 'Типовые сметы', 'Розничные цены',
      'Допы и замены', 'Пакеты опций', 'Настройки', 'Журнал изменений', 'Как работать'])
  await sidebar.getByRole('link', { name: 'Типовые проекты домов', exact: true }).click()
  await page.waitForURL('**/house-models')
  await main.getByRole('heading', { name: 'Типовые проекты домов', exact: true }).waitFor()
  assert.ok(requests.some((r) => r.startsWith('/api/warehouse/documents?') && r.includes('kind=inventory')))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click()
  const ownerMobileMenu = page.getByRole('dialog', { name: 'Главное меню' })
  assert.deepEqual(await sidebarLabels(ownerMobileMenu), ownerMenu)
  await ownerMobileMenu.getByRole('link', { name: 'CRM', exact: true }).click()
  await page.getByRole('tab', { name: 'Компании', exact: true }).click()
  assert.equal(
    await page.getByRole('tab', { name: 'Компании', exact: true }).getAttribute('aria-selected'),
    'true',
  )
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.screenshot({ path: 'test-results/workflow-mobile.png', fullPage: true })
  // New session: navigation must not expose finance or sales pages to warehouse-only staff.
  actor = { ...actor, role: 'worker', module_access: { warehouse: 'view' } }
  await page.goto(base + '/work', { waitUntil: 'networkidle' })
  assert.equal(await main.getByRole('heading', { name: 'Бухгалтерия', exact: true }).count(), 0)
  assert.equal(await main.getByRole('link', { name: /Заказы покупателей/ }).count(), 0)
  assert.equal(await main.getByRole('link', { name: /Счета покупателям/ }).count(), 0)
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click()
  const mobileMenu = page.getByRole('dialog', { name: 'Главное меню' })
  await mobileMenu.getByRole('link', { name: 'Номенклатура', exact: true }).click()
  await mobileMenu.waitFor({ state: 'hidden' })
  await page.getByRole('heading', { name: 'Товары и материалы', exact: true }).waitFor()
  assert.equal(await catalogTabs.getByRole('link').count(), 6)
  actor = { ...actor, job_role: 'manager', module_access: { clients: 'edit', costing: 'full', accounting: 'view' } }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(base + '/work', { waitUntil: 'networkidle' })
  for (const name of ['CRM', 'Партнёры', 'Каталог и цены'])
    await main.getByRole('heading', { name, exact: true }).waitFor()
  assert.deepEqual(await sidebarLabels(sidebar), [
    'Разделы', 'Пульс', 'Совместная работа', 'CRM', 'Партнёры', 'Каталог и цены', 'Уведомления', 'Мои заявки',
    'Команда', 'Подать заявку',
  ])
  assert.equal(await sidebar.getByRole('link', { name: 'Продажи', exact: true }).count(), 0)
  assert.equal(await main.locator('a[href="/clients"], a[href="/crm?tab=pipeline"], a[href="/costing?tab=prices"]').count(), 0)
  await sidebar.getByRole('link', { name: 'CRM', exact: true }).click()
  await crmTabs.getByRole('tab', { name: 'Входящие', exact: true }).waitFor()
  assert.equal(await crmTabs.getByRole('tab', { name: /Клиенты и договоры|Этапы/ }).count(), 0)
  assert.deepEqual(errors, [])
  console.log(
    'Workflow navigation passed: process groups, correct register links, same-page switching, reload/back, archive, mobile and module grants',
  )
} finally {
  await browser.close()
}
