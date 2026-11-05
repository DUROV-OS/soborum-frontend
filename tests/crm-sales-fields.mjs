import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
const base = 'http://127.0.0.1:4197'
const browser = await chromium.launch({ headless: true })
const report = { ok: false, synthetic_api: true, production_requests: 0, checks: [] }
const entry = (id, kind, name, data = {}) => ({ id, kind, name, data, version: 1, archived: false, updated_at: '2026-11-05T10:00:00Z' })
async function setup({ selected = 101, role = 'worker', eligible = true, mobile = false } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, serviceWorkers: 'block' })
  await context.addInitScript(() => {
    localStorage.setItem('soborbum.auth.token', 'synthetic-sales-fields-only')
    for (const key of ['crm', 'tasks']) localStorage.setItem('soborbum.onboarding.' + key, '1')
    window.WebSocket = class { static OPEN = 1; readyState = 0; close() {} send() {} }
  })
  const page = await context.newPage(), writes = [], reads = [], errors = []
  page.setDefaultTimeout(15000)
  page.on('pageerror', error => errors.push(error.message))
  const pipelines = [entry(1, 'pipeline', 'Продажи', { purpose: 'sales' }), entry(32, 'pipeline', 'Агентства недвижимости', { purpose: 'agency' })]
  const stages = [entry(10, 'stage', 'Новые заявки', { pipeline_id: 1, sort: 1, outcome: 'open' }), entry(9782, 'stage', 'Новое агентство', { pipeline_id: 32, sort: 1, outcome: 'open' })]
  const customer = { first_name: 'Ирина', last_name: 'Синтетическая', middle_name: '', city: 'Тамбов', temperature: 'warm', phone_2: '+79000000222', phone_3: '+79000000333' }
  if (role === 'admin') Object.assign(customer, { birth_date: '1991-03-04', marital_status: 'Замужем', marriage_date: '2014-05-06', children_birth_dates: ['2016-07-08'] })
  const records = new Map([
    entry(101, 'contact', 'Клиент для проверки', { phone: '+79000000111', email: 'test@example.invalid', customer, custom_fields: [] }),
    entry(201, 'deal', 'Дом для проверки', { pipeline_id: 1, stage_id: 10, amount: 4500000, currency: 'RUB', contact_ids: [101], needs: { extras: [] } }),
    entry(301, 'inquiry', 'Новая заявка для проверки', { contact_name: 'Проверочный контакт', phone: '+79000000301', source_name: 'Исходный сайт', customer: { city: 'Тамбов' } }),
    entry(801, 'deal', 'АН Первое', { pipeline_id: 32, stage_id: 9782, contact_ids: Array.from({ length: 13 }, (_, i) => 901 + i), agency_profile: { members: [] } }),
    ...Array.from({ length: 13 }, (_, i) => entry(901 + i, 'contact', `Сотрудник ${i + 1}`, { phone: '+7900000' + String(i + 1).padStart(4, '0') })),
    entry(950, 'contact', 'Новый связанный контакт', { phone: '+79000000950' }),
  ].map(row => [row.id, row]))
  const sources = eligible ? [{ id: 801, name: 'АН Первое', contacts: [{ id: 901, name: 'Сотрудник 1', phone: '+79000000001' }] }, { id: 802, name: 'АН Другое', contacts: [{ id: 999, name: 'Сотрудник другого АН', phone: '+79000000999' }] }] : []
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method()
    if (url.origin !== base) return route.abort()
    if (!path.startsWith('/api/')) return route.continue()
    let body = [], status = 200
    reads.push({ method, path, query: Object.fromEntries(url.searchParams) })
    if (method === 'PATCH' && /^\/api\/crm\/entries\/\d+$/.test(path)) {
      const input = request.postDataJSON(), row = records.get(Number(path.split('/')[4]))
      writes.push({ path, input })
      if (!row || row.version !== input.version) { status = 409; body = { detail: 'Неверная версия' } }
      else {
        row.data = { ...row.data, ...input.data }; row.version++
        if (input.name) row.name = input.name
        body = row
      }
    } else if (method !== 'GET') { status = 400; body = { detail: 'Запись запрещена в синтетической проверке' } }
    else if (path === '/api/auth/me') body = { id: 6, full_name: 'Тестовый менеджер', role, job_role: 'manager', is_active: true, access_profile: role === 'admin' ? null : 'sales_manager', module_access: { clients: 'full', tasks: 'edit' } }
    else if (path === '/api/crm/catalog') body = { pipelines, stages, users: [{ id: 6, name: 'Тестовый менеджер' }], counts: {} }
    else if (path === '/api/crm/agency-sources') body = { total: sources.length, items: sources, configured: true }
    else if (path === '/api/crm/entries') {
      const p = url.searchParams
      let rows = [...records.values()].filter(row => row.kind === p.get('kind') && (!p.get('stage_id') || row.data.stage_id === Number(p.get('stage_id'))))
      if (p.get('query')) rows = rows.filter(row => row.name.toLowerCase().includes(p.get('query').toLowerCase()))
      const offset = Number(p.get('offset') || 0), limit = Number(p.get('limit') || 50)
      body = { total: rows.length, items: rows.slice(offset, offset + limit) }
    } else if (/^\/api\/crm\/entries\/\d+$/.test(path)) body = records.get(Number(path.split('/')[4]))
    else if (/\/(history|files)$/.test(path)) body = { total: 0, items: [] }
    else if (path === '/api/crm/kanban-summary') body = { columns: stages.map(stage => ({ pipeline_id: stage.data.pipeline_id, stage_id: stage.id, count: 0, amounts: {}, unpriced_count: 0 })), unmapped_count: 0 }
    else if (path === '/api/costing/context') body = { estimates: [], templates: [], links: [], order_lines: null, can_import_recipe: false }
    else if (path === '/api/notifications/unread-count') body = { unread_count: 0 }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  const chosen = records.get(selected)
  await page.goto(base + `/crm?tab=${chosen.kind}&view=list&entry=${selected}`)
  const card = page.getByRole('dialog', { name: chosen.name, exact: true })
  await card.waitFor()
  await card.getByRole('button', { name: 'Редактировать', exact: true }).waitFor()
  return { context, page, card, writes, reads, records, errors }
}
async function editor(t) {
  await t.card.getByRole('button', { name: 'Редактировать', exact: true }).click()
  const dialog = t.page.getByRole('dialog', { name: /^Изменить · / })
  await dialog.waitFor()
  return dialog
}
try {
  await mkdir('test-results', { recursive: true })
  let t = await setup({ role: 'admin' }), dialog = await editor(t)
  await dialog.getByLabel('Фамилия', { exact: true }).fill('Проверенная')
  await dialog.getByLabel('Телефон №2', { exact: true }).fill('+79000000444')
  await dialog.getByLabel('Дата рождения', { exact: true }).fill('1992-01-02')
  await dialog.getByLabel('Температура клиента', { exact: true }).selectOption('hot')
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await dialog.waitFor({ state: 'detached' })
  assert.equal(t.writes.at(-1).input.data.customer.birth_date, '1992-01-02')
  assert.equal(t.writes.at(-1).input.data.customer.phone_3, '+79000000333')
  assert.equal(t.records.get(101).data.customer.temperature, 'hot')
  assert.equal(t.errors.length, 0)
  report.checks.push('Admin edits names, three phones, family dates and temperature without losing other fields')
  await t.context.close()

  t = await setup({ eligible: false, mobile: true }); dialog = await editor(t)
  assert.equal(await dialog.getByLabel('Дата рождения', { exact: true }).count(), 0)
  assert.equal(await dialog.getByLabel('Семейное положение', { exact: true }).count(), 0)
  assert.equal(await dialog.getByRole('button', { name: 'Добавить дату рождения ребёнка' }).count(), 0)
  await dialog.getByText('Подключённых агентств пока нет.', { exact: false }).waitFor()
  assert.equal(t.writes.length, 0)
  assert.ok(await t.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await t.page.screenshot({ path: 'test-results/crm-sales-fields-mobile.png' })
  await dialog.getByLabel('Город', { exact: true }).fill('Воронеж')
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await dialog.waitFor({ state: 'detached' })
  assert.ok(!('birth_date' in t.writes.at(-1).input.data.customer))
  assert.equal(t.errors.length, 0)
  report.checks.push('Manager cannot see/edit family controls; zero eligible agencies stays empty; mobile fits; no writes before Save')
  await t.context.close()

  t = await setup({ selected: 201 }); dialog = await editor(t)
  await dialog.getByLabel('Цель покупки', { exact: true }).selectOption('renting')
  await dialog.getByLabel('Тип объекта', { exact: true }).selectOption('barn')
  await dialog.getByLabel('Количество комнат', { exact: true }).fill('3')
  await dialog.getByLabel('Отделка', { exact: true }).selectOption('premium')
  await dialog.getByLabel('Баня', { exact: true }).check()
  await dialog.getByLabel('Чан', { exact: true }).check()
  await dialog.getByLabel('Форма оплаты', { exact: true }).selectOption('mortgage')
  await dialog.getByLabel('Первоначальный взнос, ₽', { exact: true }).fill('1000000')
  await dialog.getByLabel('Ипотека оформлена', { exact: true }).selectOption('false')
  await dialog.getByLabel('Партнёрская сделка', { exact: true }).selectOption('true')
  await dialog.getByRole('button', { name: 'АН Первое', exact: true }).click()
  assert.equal(await dialog.getByRole('button', { name: 'Сохранить', exact: true }).isEnabled(), false)
  const agent = dialog.getByLabel('Сотрудник выбранного агентства', { exact: true })
  assert.equal(await agent.locator('option[value="999"]').count(), 0)
  await agent.selectOption('901')
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await dialog.waitFor({ state: 'detached' })
  const data = t.writes.at(-1).input.data
  assert.deepEqual(data.needs.extras, ['sauna', 'hot_tub'])
  assert.equal(data.purchase_terms.mortgage_approved, false)
  assert.deepEqual(data.referral, { agency_id: 801, agent_contact_id: 901 })
  assert.deepEqual(data.contact_ids, [101])
  assert.equal(data.amount, 4500000)
  assert.equal(t.errors.length, 0)
  report.checks.push('Commercial fields and multi-select extras persist; only the selected agency staff can be selected; budget remains separate')
  await t.context.close()

  t = await setup({ selected: 801 }); dialog = await editor(t)
  await dialog.getByLabel('Юридический статус', { exact: true }).selectOption('ooo')
  await dialog.getByLabel('Собственник компании', { exact: true }).selectOption('901')
  await dialog.getByLabel('ЛПР', { exact: true }).selectOption('902')
  await dialog.getByLabel('Маркетолог', { exact: true }).selectOption('903')
  for (let index = 0; index < 10; index++) await dialog.getByLabel(`Агент ${index + 1}`, { exact: true }).selectOption(String(904 + index))
  await dialog.getByLabel('Привязать контакт', { exact: true }).fill('Новый связанный контакт')
  await dialog.getByRole('button', { name: /Новый связанный контакт ·/ }).click()
  await t.page.screenshot({ path: 'test-results/crm-agency-fields-desktop.png' })
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await dialog.waitFor({ state: 'detached' })
  const agencyData = t.writes.at(-1).input.data
  assert.equal(agencyData.agency_profile.members.length, 13)
  assert.equal(agencyData.agency_profile.members.filter(item => item.roles.includes('agent')).length, 10)
  assert.equal(agencyData.contact_ids.length, 14)
  assert.equal(agencyData.stage_id, 9782)
  await t.page.getByRole('dialog', { name: 'АН Первое', exact: true }).getByText('Собственник компании', { exact: true }).waitFor()
  await t.page.getByRole('dialog', { name: 'АН Первое', exact: true }).getByText('ЛПР', { exact: true }).waitFor()
  assert.ok(!t.reads.some(request => request.method !== 'GET' && /\/users/.test(request.path)))
  assert.equal(t.errors.length, 0)
  report.checks.push('Owner, decision maker, marketer and ten external agents; appending a contact keeps all old links and business stage')
  await t.context.close()

  t = await setup({ selected: 201 })
  await t.card.getByRole('button', { name: 'Закрыть', exact: true }).click()
  await Promise.all([
    t.page.waitForResponse(response => response.url().includes('/api/crm/entries?') && new URL(response.url()).searchParams.get('temperature') === 'hot'),
    t.page.getByLabel('Фильтр температуры', { exact: true }).selectOption('hot'),
  ])
  await Promise.all([
    t.page.waitForResponse(response => response.url().includes('/api/crm/kanban-summary?') && new URL(response.url()).searchParams.get('temperature') === 'hot'),
    t.page.waitForResponse(response => response.url().includes('/api/crm/entries?') && new URL(response.url()).searchParams.get('kind') === 'inquiry'),
    t.page.getByRole('button', { name: 'Канбан', exact: true }).click(),
  ])
  assert.ok(t.reads.some(request => request.path === '/api/crm/entries' && request.query.kind === 'inquiry' && request.query.temperature === 'hot'))
  assert.ok(t.reads.some(request => request.path === '/api/crm/entries' && request.query.kind === 'deal' && request.query.temperature === 'hot'))
  assert.equal(t.errors.length, 0)
  report.checks.push('Same temperature reaches list, kanban, inbox and column summaries')
  await t.context.close()

  t = await setup({ selected: 301 }); dialog = await editor(t)
  await dialog.getByLabel('Контакт заявки', { exact: true }).fill('Контакт после уточнения')
  await dialog.getByLabel('Телефон №2', { exact: true }).fill('+79000000302')
  await dialog.getByLabel('Город', { exact: true }).fill('Воронеж')
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await dialog.waitFor({ state: 'detached' })
  assert.equal(t.writes.length, 1)
  assert.equal(t.writes[0].path, '/api/crm/entries/301')
  assert.equal(t.writes[0].input.data.source_name, 'Исходный сайт')
  assert.equal(t.writes[0].input.data.customer.city, 'Воронеж')
  assert.ok(!t.writes[0].input.data.accepted_deal_id)
  assert.equal(t.errors.length, 0)
  report.checks.push('Unaccepted inquiry can be edited in place without acceptance, stage movement or source replacement')
  await t.context.close()
  report.ok = true
} catch (error) {
  report.error = String(error.stack || error)
  process.exitCode = 1
} finally {
  await browser.close()
  await writeFile('test-results/crm-sales-fields.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}
