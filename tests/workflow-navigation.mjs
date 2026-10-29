import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173'
const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  })
  await context.addInitScript(() => {
    localStorage.setItem('soborbum.auth.token', 'synthetic-navigation-test')
    localStorage.setItem('soborbum.onboarding.warehouse', '1')
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
  for (const name of ['Продажи', 'Закупки', 'Склад', 'Товары', 'Производство', 'Деньги', 'CRM'])
    await main.getByRole('heading', { name, exact: true }).waitFor()
  await main.getByRole('link', { name: /Заказы покупателей/ }).click()
  await page.getByRole('tab', { name: 'Заказы покупателей', exact: true }).waitFor()
  await sidebar.getByRole('link', { name: 'Отгрузки', exact: true }).click()
  await page.getByRole('tab', { name: 'Отгрузки', exact: true }).waitFor()
  assert.equal(
    await page.getByRole('tab', { name: 'Отгрузки', exact: true }).getAttribute('aria-selected'),
    'true',
  )
  await page.reload({ waitUntil: 'networkidle' })
  assert.equal(
    await page.getByRole('tab', { name: 'Отгрузки', exact: true }).getAttribute('aria-selected'),
    'true',
  )
  await page.goBack({ waitUntil: 'networkidle' })
  assert.equal(
    await page.getByRole('tab', { name: 'Заказы покупателей', exact: true }).getAttribute('aria-selected'),
    'true',
  )
  await sidebar.getByRole('button', { name: 'Закупки', exact: true }).click()
  await sidebar.getByRole('link', { name: 'Приёмки', exact: true }).click()
  assert.equal(
    await page.getByRole('tab', { name: 'Приёмки', exact: true }).getAttribute('aria-selected'),
    'true',
  )
  await sidebar.getByRole('link', { name: 'Возвраты поставщикам', exact: true }).click()
  assert.equal(
    await page.getByRole('tab', { name: 'Возвраты поставщикам', exact: true }).getAttribute('aria-selected'),
    'true',
  )
  await sidebar.getByRole('button', { name: 'Склад', exact: true }).click()
  await sidebar.getByRole('link', { name: 'Перемещения', exact: true }).click()
  await page.getByLabel('Вид складского документа').waitFor()
  assert.equal(await page.getByLabel('Вид складского документа').inputValue(), 'transfer')
  await sidebar.getByRole('link', { name: 'Инвентаризации', exact: true }).click()
  assert.equal(await page.getByLabel('Вид складского документа').inputValue(), 'inventory')
  if (
    (await sidebar.getByRole('button', { name: 'Продажи', exact: true }).getAttribute('aria-expanded')) ===
    'false'
  )
    await sidebar.getByRole('button', { name: 'Продажи', exact: true }).click()
  await sidebar.getByRole('link', { name: /Счета покупателям/ }).click()
  await page.getByRole('heading', { name: 'Счета покупателям', exact: true }).waitFor()
  assert.equal(await page.getByLabel('Раздел МоегоСклада').inputValue(), 'invoiceout')
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
  await sidebar.getByRole('button', { name: 'CRM', exact: true }).click()
  await sidebar.getByRole('link', { name: 'Контакты', exact: true }).click()
  await page.getByRole('tab', { name: 'Контакты', exact: true }).waitFor()
  assert.equal(
    await page.getByRole('tab', { name: 'Контакты', exact: true }).getAttribute('aria-selected'),
    'true',
  )
  assert.ok(requests.some((r) => r.startsWith('/api/warehouse/documents?') && r.includes('kind=inventory')))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click()
  await sidebar.getByRole('link', { name: 'Компании', exact: true }).click()
  assert.equal(
    await page.getByRole('tab', { name: 'Компании', exact: true }).getAttribute('aria-selected'),
    'true',
  )
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.screenshot({ path: 'test-results/workflow-mobile.png', fullPage: true })
  // New session: navigation must not expose finance or sales pages to warehouse-only staff.
  actor = { ...actor, role: 'worker', module_access: { warehouse: 'view' } }
  await page.goto(base + '/work', { waitUntil: 'networkidle' })
  assert.equal(await main.getByRole('heading', { name: 'Деньги', exact: true }).count(), 0)
  assert.equal(await main.getByRole('link', { name: /Заказы покупателей/ }).count(), 0)
  assert.equal(await main.getByRole('link', { name: /Счета покупателям/ }).count(), 0)
  await main.getByRole('link', { name: /Номенклатура/ }).click()
  await page.getByRole('heading', { name: 'Товары и материалы', exact: true }).waitFor()
  assert.deepEqual(errors, [])
  console.log(
    'Workflow navigation passed: process groups, correct register links, same-page switching, reload/back, archive, mobile and module grants',
  )
} finally {
  await browser.close()
}
