import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173'
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() =>
    localStorage.setItem('soborbum.auth.token', 'synthetic-purchase-return-test'),
  )
  const owner = {
    id: 1,
    full_name: 'Проверка возвратов',
    email: 'owner@example.test',
    role: 'admin',
    module_access: {},
    is_active: true,
    created_at: new Date().toISOString(),
  }
  const receipt = {
    id: 10,
    number: 'ПР-10',
    supplier_id: 2,
    status: 'posted',
    occurred_at: new Date().toISOString(),
    lines: [
      {
        receipt_line: 0,
        material_id: 1,
        title: 'Брус',
        unit: 'м³',
        quantity: 10,
        unit_price: 20,
        returned_quantity: 0,
        returnable_quantity: 10,
        stock_tracked: true,
      },
    ],
  }
  let row = null,
    created = false,
    refunded = false,
    archived = false
  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname,
      method = req.method()
    let body = []
    if (path === '/api/auth/me') body = owner
    else if (path === '/api/auth/users') body = [owner]
    else if (path.includes('/unread')) body = { count: 0, unread_count: 0 }
    else if (path === '/api/purchasing/catalog')
      body = {
        suppliers: [{ id: 2, name: 'Поставщик', archived: false }],
        materials: [],
        accounts: [{ id: 1, name: 'Банк' }],
      }
    else if (path === '/api/purchasing/orders') body = { total: 0, items: [] }
    else if (path === '/api/purchasing/receipts') body = { total: 1, items: [receipt] }
    else if (path === '/api/purchasing/receipts/10') body = receipt
    else if (path === '/api/purchasing/returns' && method === 'GET')
      body = { total: row ? 1 : 0, items: row ? [row] : [] }
    else if (path === '/api/purchasing/returns' && method === 'POST') {
      const input = req.postDataJSON()
      assert.equal(input.receipt_id, 10)
      assert.equal(input.lines[0].quantity, '3')
      assert.equal(input.lines[0].material_id, 1)
      assert.ok(input.request_id)
      created = true
      row = {
        ...input,
        id: 1,
        number: 'ВП-1',
        receipt_number: 'ПР-10',
        supplier_id: 2,
        amount: 60,
        currency: 'RUB',
        version: 1,
        archived: false,
        refunded: 0,
        refund_pending: 0,
        refund_available: 60,
        refunds: [],
        lines: [{ ...input.lines[0], title: 'Брус', unit: 'м³', unit_price: '20' }],
      }
      body = row
    } else if (path === '/api/purchasing/returns/1') body = row
    else if (path === '/api/purchasing/returns/1/refunds') {
      const input = req.postDataJSON()
      assert.equal(input.amount, '40')
      assert.equal(input.account_id, 1)
      assert.ok(input.request_id)
      refunded = true
      row = {
        ...row,
        refund_pending: 40,
        refund_available: 20,
        refunds: [{ id: 77, status: 'draft', amount: 40 }],
      }
      body = { id: 77, status: 'draft' }
    } else if (path === '/api/purchasing/returns/1/archive') {
      assert.equal(req.postDataJSON().version, 1)
      archived = true
      row = { ...row, archived: true, version: 2 }
      body = row
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(base + '/purchasing', { waitUntil: 'networkidle' })
  await page.getByRole('tab', { name: 'Приёмки', exact: true }).click()
  await page.getByText('№ ПР-10', { exact: true }).click()
  await page.getByRole('button', { name: 'Вернуть поставщику', exact: true }).click()
  let dialog = page.getByRole('dialog', { name: 'Возврат по приёмке № ПР-10', exact: true })
  await dialog.getByLabel('Причина возврата', { exact: true }).fill('Выявлен брак')
  await dialog.getByLabel('Вернуть строку 0', { exact: true }).fill('11')
  assert.equal(await dialog.getByRole('button', { name: 'Оформить возврат', exact: true }).isDisabled(), true)
  await dialog.getByLabel('Вернуть строку 0', { exact: true }).fill('3')
  await dialog.getByRole('button', { name: 'Оформить возврат', exact: true }).click()
  await page.getByText('№ ВП-1', { exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'Возврат № ВП-1', exact: true })
  await dialog.getByRole('button', { name: 'Оформить получение денег', exact: true }).click()
  const refund = page.getByRole('dialog', { name: 'Получение денег от поставщика', exact: true })
  await refund.getByLabel('Сумма возврата денег').fill('40')
  await refund.getByRole('button', { name: 'На согласование', exact: true }).click()
  await dialog.getByRole('link', { name: 'Проводка № 77 · 40 ₽ · На согласовании', exact: true }).waitFor()
  assert.equal(await dialog.getByRole('link').getAttribute('href'), '/accounting?movement=77')
  await dialog.getByRole('button', { name: 'В архив', exact: true }).click()
  await dialog.getByRole('button', { name: 'Вернуть из архива', exact: true }).waitFor()
  assert.ok(created && refunded && archived)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(base + '/purchasing?return=1', { waitUntil: 'networkidle' })
  await page.getByRole('dialog', { name: 'Возврат № ВП-1', exact: true }).waitFor()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.screenshot({
    path: 'C:/Users/trans/.codex/data/purchase-returns-mobile-20261029.png',
    fullPage: true,
  })
  assert.deepEqual(errors, [])
  console.log(
    'Purchase returns: receipt selection, quantity bound, stock return, refund draft link, archive and mobile passed',
  )
} finally {
  await browser.close()
}
