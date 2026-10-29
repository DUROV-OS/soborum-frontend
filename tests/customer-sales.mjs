import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173'
const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(() => localStorage.setItem('soborbum.auth.token', 'synthetic-sales-test'))
  const page = await context.newPage(),
    errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const actor = {
    id: 1,
    full_name: 'Проверка продаж',
    email: 'owner@example.test',
    role: 'admin',
    is_active: true,
    module_access: {},
  }
  const catalog = {
    counterparties: [{ id: 1, name: 'Покупатель', inn: null, active: true }],
    organizations: [{ id: 1, name: 'Тестовая организация' }],
    materials: [
      {
        id: 1,
        title: 'Брус',
        code: 'SALES-TEST',
        warehouse: 'Склад Технология',
        unit: 'шт',
        is_fractional: false,
        available_quantity: 10,
      },
    ],
  }
  let order = null,
    document = null,
    createBody = null,
    reserveBody = null,
    stock = 10,
    postCount = 0,
    cancelCount = 0
  const line = (quantity, price) => ({
    material_id: 1,
    title: 'Брус',
    unit: 'шт',
    stock_tracked: true,
    quantity,
    unit_price: price,
    line_total: String(Number(quantity) * Number(price)),
    order_line: 0,
    shipped_quantity: 0,
    remaining_quantity: Number(quantity),
    reserved_quantity: 0,
  })
  await page.route('**/api/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname,
      method = request.method()
    const body = method === 'POST' || method === 'PATCH' ? request.postDataJSON() : null
    let result = []
    if (path === '/api/auth/me') result = actor
    else if (path === '/api/notifications/unread-count') result = { count: 0 }
    else if (path === '/api/sales/catalog') result = catalog
    else if (path === '/api/sales/orders' && method === 'POST') {
      createBody = body
      order = {
        ...body,
        id: 1,
        number: 'ЗП-1',
        status: 'draft',
        fulfillment: 'waiting',
        version: 1,
        total: 600,
        currency: 'RUB',
        opening_paid: 0,
        source_id: null,
        source_state: null,
        archived: false,
        financial_fields_locked: false,
        counterparty_name: 'Покупатель',
        organization_name: 'Тестовая организация',
        lines: [line('6', '100')],
        events: [],
        shipments: [],
      }
      result = order
    } else if (path === '/api/sales/orders') result = { total: order ? 1 : 0, items: order ? [order] : [] }
    else if (path === '/api/sales/orders/1') result = order
    else if (path === '/api/sales/orders/1/confirm') {
      order.status = 'confirmed'
      order.version++
      result = order
    } else if (path === '/api/sales/orders/1/archive') {
      order.archived = body.archived
      order.version++
      result = order
    } else if (path === '/api/warehouse/reservations' && method === 'POST') {
      reserveBody = body
      order.lines[0].reserved_quantity = Number(body.quantity)
      order.financial_fields_locked = true
      result = { id: 1, ...body, remaining_quantity: Number(body.quantity) }
    } else if (path === '/api/sales/shipments' && method === 'POST') {
      assert.equal(body.lines[0].quantity, '2')
      assert.equal(body.order_id, 1)
      document = {
        ...body,
        id: 1,
        number: 'ОТ-1',
        status: 'draft',
        version: 1,
        order_version: order.version,
        counterparty_name: 'Покупатель',
        organization_name: 'Тестовая организация',
        total: 200,
        currency: 'RUB',
        historical: false,
        archived: false,
        operation_id: null,
        cancel_operation_id: null,
        cancellation_note: null,
        events: [],
        lines: [line('2', '100')],
      }
      order.shipments = [document]
      result = document
    } else if (path === '/api/sales/shipments')
      result = { total: document ? 1 : 0, items: document ? [document] : [] }
    else if (path === '/api/sales/shipments/1') result = document
    else if (path === '/api/sales/shipments/1/post') {
      assert.ok(body.request_id)
      assert.equal(body.order_version, order.version)
      postCount++
      stock -= 2
      document.status = 'posted'
      document.version++
      document.operation_id = 17
      order.version++
      order.fulfillment = 'partial'
      order.lines[0].shipped_quantity = 2
      order.lines[0].remaining_quantity = 4
      order.lines[0].reserved_quantity -= 2
      document.order_version = order.version
      result = document
    } else if (path === '/api/sales/shipments/1/cancel') {
      assert.equal(body.note, 'Ошибка оформления')
      assert.ok(body.request_id)
      cancelCount++
      stock += 2
      document.status = 'cancelled'
      document.version++
      document.cancel_operation_id = 18
      document.cancellation_note = body.note
      order.version++
      order.fulfillment = 'waiting'
      order.lines[0].shipped_quantity = 0
      order.lines[0].remaining_quantity = 6
      result = document
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) })
  })
  await page.goto(base + '/sales', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Новый заказ', exact: true }).click()
  let form = page.getByRole('dialog', { name: 'Новый заказ покупателя', exact: true })
  await form.getByLabel('Покупатель заказа').selectOption('1')
  await form.getByLabel('Товар заказа 0').selectOption('1')
  await form.getByLabel('Количество заказа 0').fill('6')
  await form.getByLabel('Цена заказа 0').fill('100')
  await form.getByRole('button', { name: 'Сохранить заказ', exact: true }).click()
  let drawer = page.getByRole('dialog', { name: 'Заказ № ЗП-1', exact: true })
  await drawer.getByRole('button', { name: 'Подтвердить заказ', exact: true }).click()
  await drawer.getByRole('button', { name: 'Создать отгрузку', exact: true }).waitFor()
  assert.equal(createBody.counterparty_id, 1)
  assert.equal(createBody.lines[0].quantity, '6')
  await drawer.getByLabel('Резерв строки 0').fill('4')
  await drawer.getByRole('button', { name: 'В резерв', exact: true }).click()
  await drawer.getByText('Выдано: 0 · Осталось: 6 · В резерве: 4', { exact: true }).waitFor()
  assert.equal(reserveBody.sales_order_id, 1)
  assert.equal(reserveBody.sales_line, 0)
  await drawer.getByRole('button', { name: 'Создать отгрузку', exact: true }).click()
  form = page.getByRole('dialog', { name: 'Новая отгрузка', exact: true })
  await form.getByLabel('Количество отгрузки 0').fill('7')
  await form.getByLabel('Получатель отгрузки').fill('Получатель')
  assert.equal(await form.getByRole('button', { name: 'Сохранить черновик' }).isDisabled(), true)
  await form.getByLabel('Количество отгрузки 0').fill('2')
  await form.getByRole('button', { name: 'Сохранить черновик' }).click()
  drawer = page.getByRole('dialog', { name: 'Отгрузка № ОТ-1', exact: true })
  assert.equal(stock, 10)
  await drawer.getByRole('button', { name: 'Провести отгрузку', exact: true }).click()
  await drawer.getByRole('link', { name: 'Отпуск со склада № 17', exact: true }).waitFor()
  assert.equal(stock, 8)
  assert.equal(postCount, 1)
  await drawer.getByRole('button', { name: 'Отменить отгрузку', exact: true }).click()
  form = page.getByRole('dialog', { name: 'Отмена отгрузки', exact: true })
  await form.getByLabel('Причина отмены продажи').fill('Ошибка оформления')
  await form.getByRole('button', { name: 'Подтвердить отмену', exact: true }).click()
  await drawer.getByText('Встречное оприходование № 18', { exact: true }).waitFor()
  assert.equal(stock, 10)
  assert.equal(cancelCount, 1)
  await drawer.getByRole('link', { name: 'Открыть заказ', exact: true }).click()
  drawer = page.getByRole('dialog', { name: 'Заказ № ЗП-1', exact: true })
  await drawer.getByText('Выдано: 0 · Осталось: 6 · В резерве: 2', { exact: true }).waitFor()
  await drawer.getByRole('button', { name: 'Закрыть', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Новый заказ', exact: true }).click()
  form = page.getByRole('dialog', { name: 'Новый заказ покупателя', exact: true })
  await form.getByLabel('Товар заказа 0').waitFor()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.screenshot({ path: 'test-results/customer-sales-mobile.png', fullPage: true })
  assert.deepEqual(errors, [])
  console.log(
    'Sales UI passed: order/confirm, reserve, bounded draft, partial post, reversal, shared order link and mobile; synthetic fixtures only',
  )
} finally {
  await browser.close()
}
