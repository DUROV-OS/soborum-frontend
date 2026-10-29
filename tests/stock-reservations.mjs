import assert from 'node:assert/strict'
import { chromium } from 'playwright'
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173'
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => {
    localStorage.setItem('soborbum.auth.token', 'synthetic-reservation-test')
    localStorage.setItem('soborbum.onboarding.warehouse', '1')
  })
  const owner = {
    id: 1,
    full_name: 'Проверка резервов',
    email: 'owner@example.test',
    role: 'admin',
    module_access: {},
    is_active: true,
    created_at: new Date().toISOString(),
  }
  const material = {
    id: 1,
    title: 'Брус',
    code: 'RES-1',
    warehouse: 'Склад Технология',
    unit: 'шт',
    category: 'без категории',
    is_archived: false,
    is_fractional: false,
    quantity_in_stock: 10,
    purchase_price: 20,
    reserved_quantity: 0,
    available_quantity: 10,
    reservation_shortage: 0,
    threshold: 0,
    total_requested: 0,
    needs_supply: false,
    created_at: new Date().toISOString(),
  }
  const rows = []
  let released = 0,
    issued = 0,
    archived = 0,
    previewed = 0
  function event(row, kind, q, note) {
    row.events.push({
      id: row.events.length + 1,
      kind,
      quantity: q,
      actor_id: 1,
      note,
      movement_id: kind === 'issued' ? 17 : null,
      created_at: new Date().toISOString(),
    })
  }
  function refreshMaterial() {
    material.reserved_quantity = rows.reduce((s, r) => s + r.remaining_quantity, 0)
    material.available_quantity = material.quantity_in_stock - material.reserved_quantity
  }
  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname,
      method = req.method()
    let body = []
    if (path === '/api/auth/me') body = owner
    else if (path === '/api/auth/users') body = [owner]
    else if (path.includes('/unread')) body = { count: 0, unread_count: 0 }
    else if (path.endsWith('/analytics'))
      body = {
        status: 'unknown',
        source: 'rules',
        summary: 'Проверка резерва',
        generated_at: new Date().toISOString(),
      }
    else if (path === '/api/warehouse/materials') body = [material]
    else if (path === '/api/warehouse/reservations/catalog')
      body = { houses: [{ id: 3, name: 'Дом № 3' }], orders: [] }
    else if (path === '/api/warehouse/reservations' && method === 'GET') {
      const status = url.searchParams.get('status'),
        archive = url.searchParams.get('archive')
      const items = rows.filter(
        (r) =>
          (status === 'all' ||
            (status === 'active' ? r.remaining_quantity > 0 : r.remaining_quantity === 0)) &&
          (archive === 'all' || r.archived === (archive === 'archived')),
      )
      body = { total: items.length, items }
    } else if (path === '/api/warehouse/reservations' && method === 'POST') {
      const input = req.postDataJSON()
      assert.equal(input.material_id, 1)
      assert.ok(input.request_id)
      const q = Number(input.quantity)
      assert.ok(q <= material.available_quantity)
      const row = {
        id: rows.length + 1,
        material_id: 1,
        material_title: material.title,
        material_code: material.code,
        warehouse: material.warehouse,
        unit: 'шт',
        purpose: input.purpose || 'Дом № 3',
        production_id: input.production_id,
        quantity: q,
        remaining_quantity: q,
        released_quantity: 0,
        consumed_quantity: 0,
        available_quantity: material.available_quantity - q,
        available_for_issue: q,
        shortage: 0,
        status: 'active',
        version: 1,
        archived: false,
        events: [],
      }
      event(row, 'created', q, row.purpose)
      rows.push(row)
      refreshMaterial()
      body = row
    } else if (path.match(/\/reservations\/\d+/)) {
      const id = Number(path.match(/\/reservations\/(\d+)/)[1]),
        row = rows.find((r) => r.id === id)
      assert.ok(row)
      if (method === 'GET') body = row
      else if (path.endsWith('/archive')) {
        assert.equal(req.postDataJSON().version, row.version)
        row.archived = req.postDataJSON().archived
        row.version++
        archived++
        body = row
      } else {
        const input = req.postDataJSON(),
          q = Number(input.quantity)
        assert.equal(input.version, row.version)
        assert.ok(input.request_id)
        if (path.endsWith('/release')) {
          row.released_quantity += q
          released += q
          event(row, 'released', q, input.note)
        } else {
          assert.equal(input.received_by, 'Цех')
          row.consumed_quantity += q
          material.quantity_in_stock -= q
          issued += q
          event(row, 'issued', q, input.note)
        }
        row.remaining_quantity -= q
        row.status = row.remaining_quantity ? 'active' : 'closed'
        row.version++
        row.available_for_issue = row.remaining_quantity
        refreshMaterial()
        body = row
      }
    } else if (path === '/api/warehouse/techcard-issue/houses')
      body = [
        {
          production_id: 3,
          house_name: 'Дом № 3',
          client_name: null,
          house_model_title: null,
          positions_to_issue: 1,
        },
      ]
    else if (path === '/api/warehouse/techcard-issue/3/preview') {
      previewed++
      body = {
        production_id: 3,
        house_label: 'Дом № 3',
        house_model_title: null,
        zero_norm_count: 0,
        unmatched_materials_count: 0,
        lines: [
          {
            warehouse_material_id: 1,
            material_title: 'Брус',
            material_code: 'RES-1',
            unit: 'шт',
            is_fractional: false,
            norm_total: 2,
            provided: 0,
            requested: 0,
            to_issue: 2,
            in_stock: 7,
            available_quantity: 7,
            balance_after: 5,
            shortage: false,
            blocks: [{ block_id: 1, block_name: 'Каркас', to_issue: 2 }],
          },
        ],
      }
    } else if (path === '/api/warehouse/operations/destinations') body = { destinations: [], received_by: [] }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(base + '/warehouse?tab=reservations', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Зарезервировать', exact: true }).click()
  let form = page.getByRole('dialog', { name: 'Резерв материала', exact: true })
  await form.getByLabel('Материал резерва', { exact: true }).selectOption('1')
  await form.getByLabel('Назначение резерва', { exact: true }).fill('Заказ цеха')
  await form.getByLabel('Количество резерва', { exact: true }).fill('11')
  assert.equal(await form.getByRole('button', { name: 'Зарезервировать', exact: true }).isDisabled(), true)
  await form.getByLabel('Количество резерва', { exact: true }).fill('6')
  await form.getByRole('button', { name: 'Зарезервировать', exact: true }).click()
  let drawer = page.getByRole('dialog', { name: 'Резерв № 1', exact: true })
  await drawer.getByRole('button', { name: 'Снять резерв', exact: true }).click()
  form = page.getByRole('dialog', { name: 'Снятие резерва', exact: true })
  await form.getByLabel('Количество действия с резервом').fill('2')
  await form.getByLabel('Основание действия с резервом').fill('Потребность уменьшилась')
  await form.getByRole('button', { name: 'Снять резерв', exact: true }).click()
  await drawer.getByText('Осталось: 4 · Выдано: 0 · Снято: 2', { exact: true }).waitFor()
  await drawer.getByRole('button', { name: 'Выдать из резерва', exact: true }).click()
  form = page.getByRole('dialog', { name: 'Выдача из резерва', exact: true })
  await form.getByLabel('Количество действия с резервом').fill('3')
  await form.getByLabel('Основание действия с резервом').fill('Передано в цех')
  await form.getByLabel('Получатель резерва').fill('Цех')
  await form.getByRole('button', { name: 'Оформить выдачу', exact: true }).click()
  await drawer.getByText('Осталось: 1 · Выдано: 3 · Снято: 2', { exact: true }).waitFor()
  await drawer.getByRole('link', { name: 'Движение склада № 17', exact: true }).waitFor()
  await drawer.getByRole('button', { name: 'Снять резерв', exact: true }).click()
  form = page.getByRole('dialog', { name: 'Снятие резерва', exact: true })
  await form.getByLabel('Основание действия с резервом').fill('Остаток больше не нужен')
  await form.getByRole('button', { name: 'Снять резерв', exact: true }).click()
  await drawer.getByRole('button', { name: 'В архив', exact: true }).click()
  await drawer.getByRole('button', { name: 'Вернуть из архива', exact: true }).waitFor()
  assert.equal(issued, 3)
  assert.equal(released, 3)
  assert.equal(archived, 1)
  assert.equal(material.quantity_in_stock, 7)
  await drawer.getByRole('button', { name: 'Закрыть', exact: true }).click()
  await page.getByRole('button', { name: 'Зарезервировать', exact: true }).click()
  form = page.getByRole('dialog', { name: 'Резерв материала', exact: true })
  await form.getByLabel('Тип назначения резерва').selectOption('house')
  await form.getByLabel('Дом резерва').selectOption('3')
  await form.getByLabel('Материал резерва', { exact: true }).selectOption('1')
  await form.getByLabel('Количество резерва').fill('2')
  await form.getByRole('button', { name: 'Зарезервировать', exact: true }).click()
  drawer = page.getByRole('dialog', { name: 'Резерв № 2', exact: true })
  await drawer.getByRole('button', { name: 'Выдать по техкарте', exact: true }).click()
  await page.getByLabel('К отпуску: Брус', { exact: true }).waitFor()
  assert.equal(previewed, 1)
  assert.equal(await page.getByLabel('К отпуску: Брус', { exact: true }).inputValue(), '2')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(base + '/warehouse?tab=reservations&material=1&reserve=1', {
    waitUntil: 'networkidle',
  })
  form = page.getByRole('dialog', { name: 'Резерв материала', exact: true })
  await form.getByLabel('Материал резерва', { exact: true }).waitFor()
  assert.equal(await form.getByLabel('Материал резерва', { exact: true }).inputValue(), '1')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.screenshot({
    path: 'test-results/reservations-mobile.png',
    fullPage: true,
  })
  assert.deepEqual(errors, [])
  console.log(
    'Reservations UI: free stock bound, partial release/issue, audit, archive, house issue and mobile passed',
  )
} finally {
  await browser.close()
}
