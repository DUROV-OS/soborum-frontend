import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const baseURL = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5173'
const fixture = { id: 21, cycle_id: 21, stage: 'lead', created_at: '2026-10-01T08:00:00Z', full_name: 'Тестовый клиент', phone: '9000000000', email: '', contacts: [], chat_links: [], notes: [], tasks: [], houses_count: 1, via_agency: false, lead_unprocessed: false, manager_id: null, manager: null, payment_locked_at: null, documents_locked_at: null, is_paid: true, balance_paid: false, balance_state: 'pending', payment_plan: null, final_price: null, advance_amount: null, order_type: null, contract_file: null, contract_appendix_file: null, house_project_file: null, ar_file: null, kr_file: null, balance_due_date: null }
const movement = (id, amount, status, assessment = 'actual', currency = 'RUB') => ({ id, amount, status, assessment, currency, direction: 'income', doc_date: '2026-10-01T08:00:00Z', account_name: 'Расчётный счёт' })
const rows = [movement(1, 100.10, 'posted'), movement(2, 199.90, 'posted'), movement(3, 500, 'draft'), movement(4, 999, 'posted', 'planned'), movement(5, 1.40, 'posted', 'actual', 'USD'), movement(6, 123, 'cancelled')]
const browser = await chromium.launch({ headless: true })

async function scenario(access, response, overrides = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(() => {
    localStorage.setItem('soborbum.auth.token', 'test-token')
    localStorage.setItem('soborbum.onboarding.clients', '1')
  })
  const page = await context.newPage()
  const requests = []
  const client = { ...fixture, ...overrides }
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    let status = 200, body = []
    if (url.pathname === '/api/auth/me') body = { id: 2, full_name: 'Сотрудник', email: 'worker@example.test', role: 'worker', is_active: true, module_access: { clients: 'edit', ...(access ? { accounting: 'view' } : {}) } }
    else if (url.pathname === '/api/clients/') body = [client]
    else if (url.pathname === '/api/clients/21/payment' && route.request().method() === 'PATCH') { client.is_paid = route.request().postDataJSON().is_paid; body = client }
    else if (url.pathname === '/api/clients/21/balance-payment' && route.request().method() === 'PATCH') { client.balance_paid = true; client.balance_state = 'paid'; body = client }
    else if (url.pathname === '/api/accounting/money-movements') {
      requests.push(url.searchParams)
      if (response === 'error') { status = 503; body = { detail: 'Недоступно' } }
      else body = response === 'empty' ? [] : rows
    } else { status = 404; body = { detail: 'Не найдено' } }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(baseURL + '/clients/21')
  await page.getByText('Тестовый клиент', { exact: true }).first().waitFor()
  return { context, page, requests }
}

try {
  const accountant = await scenario(true, 'rows')
  const panel = accountant.page.locator('div').filter({ has: accountant.page.getByRole('heading', { name: 'Платежи в бухгалтерии' }) }).last()
  await panel.getByText('Проведённые фактические поступления').waitFor()
  assert.equal(accountant.requests[0].get('client_id'), '21')
  assert.equal(accountant.requests[0].get('subkind'), 'sale_income')
  assert.equal(accountant.requests[0].get('limit'), '101')
  assert.ok(await panel.getByText('300,00 ₽', { exact: true }).isVisible())
  assert.ok(await panel.getByText('1,40 USD', { exact: true }).first().isVisible())
  assert.ok(await panel.getByText('Черновик', { exact: false }).isVisible())
  assert.equal(await panel.getByText('1 422,00 ₽', { exact: true }).count(), 0)
  assert.equal(await panel.locator('a[href="/accounting?movement=1"]').count(), 1)
  await accountant.context.close()

  const empty = await scenario(true, 'empty')
  await empty.page.getByText('В карточке отмечена оплата', { exact: false }).waitFor()
  await empty.context.close()

  const failed = await scenario(true, 'error')
  await failed.page.getByRole('alert').filter({ hasText: 'Не удалось загрузить платежи' }).waitFor()
  assert.equal(await failed.page.getByText('Привязанных операций пока нет.', { exact: true }).count(), 0)
  await failed.context.close()

  const manager = await scenario(false, 'rows')
  assert.equal(await manager.page.getByRole('heading', { name: 'Платежи в бухгалтерии' }).count(), 0)
  assert.equal(manager.requests.length, 0)
  await manager.context.close()

  const advance = await scenario(true, 'rows', { stage: 'payment', payment_plan: 'full_prepayment', is_paid: false })
  await advance.page.getByRole('button', { name: 'Вся сумма поступила', exact: true }).click()
  await advance.page.getByText('Отметка сохранена. Проведение платежа проверяется в бухгалтерии.', { exact: false }).waitFor()
  assert.equal(await advance.page.getByText('Создана проводка в «Бухгалтерии»', { exact: false }).count(), 0)
  assert.equal(await advance.page.locator('a[href="#client-payments"]').count(), 1)
  await advance.context.close()

  const balance = await scenario(true, 'rows', { stage: 'postpayment', payment_plan: 'advance_then_balance', final_price: 1000, advance_amount: 300, balance_paid: false })
  await balance.page.getByText('Остаток по условиям договора: 700 ₽', { exact: true }).waitFor()
  await balance.page.getByRole('button', { name: 'Отметить приём остатка' }).click()
  await balance.page.getByText('Отметка сохранена. Проведение платежа проверяется в бухгалтерии.', { exact: false }).waitFor()
  assert.equal(await balance.page.getByText('Создана проводка в «Бухгалтерии»', { exact: false }).count(), 0)
  assert.equal(await balance.page.locator('a[href="#client-payments"]').count(), 1)
  await balance.context.close()
  console.log('Client payments: statuses, currencies, missing data, error and access passed')
} finally { await browser.close() }
