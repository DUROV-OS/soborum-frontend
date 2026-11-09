import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5178'
const output = '../../output/cost-approvals-20261109'
const browser = await chromium.launch({ headless: true })
let stage = 'production', production = false, accounting = false, director = false, version = 1, reject = false
const errors = [], submitted = []
const docs = []
const people = { production: { id: 2, name: 'Илья · тест' }, accounting: { id: 4, name: 'Татьяна · тест' }, director: { id: 1, name: 'Руководитель · тест' } }
const basis = { title: 'Северный дом · тест', note: 'Сборка по проекту', lines: [{ material_id: 1, name: 'Брус 150 × 150', unit: 'м³', quantity: '12.5' }], replacements: [] }
const facts = [{ key: 'material:0:1', label: 'Брус 150 × 150', value: '22000', unit: '₽ / м³' }, { key: 'rate:1:realtor', label: 'Комиссия риелтора', value: '2', unit: '% выручки' }]
const state = () => ({ production_approved: production, accounting_approved: accounting, director_approved: director, next_stage: !production ? 'production' : !accounting ? 'accounting' : !director ? 'director' : 'complete' })
const plan = { id: 4, month: '2026-11-01', version: 1, content: { planned_units: 10, factory: '400000', warehouse: '100000', staff: '500000', other: '0', note: 'Синтетический план' }, total: '1000000', per_unit: '100000', approved: true, current: true, accounting_approved: true, director_approved: true, facts: [], documents: [] }
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } })
await context.addInitScript(() => localStorage.setItem('soborbum.auth.token', 'synthetic-token'))
const page = await context.newPage()
page.on('pageerror', e => errors.push(e.message))
await page.route('**/api/**', async route => {
  const req = route.request(), path = new URL(req.url()).pathname, method = req.method()
  let body = [], status = 200
  if (path === '/api/auth/me') body = { id: people[stage].id, full_name: people[stage].name, email: stage + '@test.invalid', role: stage === 'production' ? 'worker' : 'admin', job_role: stage === 'production' ? 'production_manager' : stage === 'director' ? 'director' : 'accountant', is_active: true, module_access: { production: 'full', clients: 'full' } }
  else if (path.endsWith('/governance/access')) body = { financial: stage !== 'production', edit: stage !== 'production', stages: [stage], responsible: people }
  else if (path.endsWith('/governance/queue')) body = { items: [{ id: 2, version: 1, title: basis.title, production_approved: false }], estimates: [{ id: 1, version, title: 'Дом семьи Ивановых · тест', number: 'ТЕСТ-001', state: state() }] }
  else if (path.endsWith('/governance/items/2')) body = { id: 2, version: 1, title: basis.title, production_approved: false, basis }
  else if (path.endsWith('/governance/month-plans')) {
    if (method === 'POST') { submitted.push(req.postDataJSON()); body = { ...plan, id: 9, approved: false }; status = 201 }
    else body = [plan]
  } else if (path.endsWith('/governance/month-plans/9')) body = { ...plan, id: 9, approved: false, accounting_approved: false }
  else if (path.includes('/governance/documents/estimate/1')) {
    assert.equal(method, 'POST'); assert.ok(req.headers()['content-type'].startsWith('multipart/form-data'))
    docs.push({ id: docs.length + 1, title: 'Счёт поставщика.pdf', sha256: 'b'.repeat(64), size_bytes: 24500 }); body = docs.at(-1); status = 201
  } else if (path.endsWith('/governance/estimates/1/' + stage) && method === 'POST') {
    submitted.push(req.postDataJSON())
    if (reject) { body = { detail: 'Версия расчёта изменилась. Обновите основание.' }; status = 409 }
    else { if (stage === 'production') { production = true; version = 2 } else if (stage === 'accounting') accounting = true; else director = true; body = {} }
  } else if (path.endsWith('/governance/estimates/1')) {
    body = { id: 1, version, title: 'Дом семьи Ивановых · тест', number: 'ТЕСТ-001', quantity: '1', note: 'Проверить крыльцо', bom: basis.lines, technical_basis: { parts: [{ item: basis, quantity: '1' }] }, state: state(), history: production ? [{ id: 1, version: 1, actor: people.production.name, stage: 'production', created_at: '2026-11-09T10:00:00Z', reason: 'Состав проверен' }] : [] }
    if (stage !== 'production') Object.assign(body, { facts, documents: docs, overhead_plan: plan, result: { price: '2000000', cost: '1200000', profit: '800000', margin_percent: '40', minimum_price: '1846153.85', status: 'meets_target' } })
  }
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
})
try {
  await mkdir(output, { recursive: true })
  await page.goto(base + '/cost-approvals?kind=estimate&id=1')
  await page.getByRole('heading', { name: 'Материалы на весь проект' }).waitFor()
  assert.equal(await page.getByText('Полная себестоимость', { exact: true }).count(), 0)
  assert.equal(await page.getByRole('tab', { name: 'Месячные расходы' }).count(), 0)
  assert.equal(await page.getByLabel('Прикрепить документ', { exact: true }).count(), 0)
  await page.getByLabel('Состав работ', { exact: true }).fill('Сборка каркаса, контроль геометрии, устройство крыльца.')
  await page.getByLabel('Комментарий к решению', { exact: true }).fill('Материалы и нормы проверены.')
  await page.getByRole('checkbox', { name: 'Лично проверил состав' }).check()
  await page.screenshot({ path: output + '/production-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'Согласовать состав и работы' }).click()
  await page.getByText('Версия 2 · 1 изделий').waitFor()
  assert.equal(submitted[0].work_scope, 'Сборка каркаса, контроль геометрии, устройство крыльца.')
  assert.deepEqual(submitted[0].evidence, [])
  stage = 'accounting'
  await page.reload()
  await page.getByText('Полная себестоимость', { exact: true }).waitFor()
  await page.getByLabel('Прикрепить документ', { exact: true }).setInputFiles({ name: 'evidence.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-synthetic') })
  await page.getByText('Счёт поставщика.pdf', { exact: true }).first().waitFor()
  for (const fact of facts) {
    await page.getByLabel('Документ: ' + fact.label, { exact: true }).selectOption('1')
    await page.getByLabel('Страница и строка: ' + fact.label, { exact: true }).fill('Страница 1, строка 2')
  }
  await page.getByLabel('Комментарий к решению', { exact: true }).fill('Числа сверены с документом.')
  await page.getByRole('checkbox', { name: 'Лично сверил' }).check()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(400)
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile must fit')
  const dialog = page.getByRole('dialog')
  assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Dialog must fit mobile')
  await page.screenshot({ path: output + '/accounting-mobile.png', fullPage: true })
  reject = true
  await page.getByRole('button', { name: 'Подтвердить суммы и документы' }).click()
  await page.getByRole('alert').filter({ hasText: 'Версия расчёта изменилась' }).waitFor()
  assert.equal(await page.getByLabel('Страница и строка: ' + facts[0].label).inputValue(), 'Страница 1, строка 2')
  reject = false
  await page.getByRole('button', { name: 'Подтвердить суммы и документы' }).click()
  await page.getByText('Следующий шаг выполняет Руководитель · тест', { exact: false }).waitFor()
  assert.deepEqual(submitted.at(-1).evidence.map(p => [p.key, p.value, p.document_id]), [['material:0:1', '22000', 1], ['rate:1:realtor', '2', 1]])
  stage = 'director'
  await page.setViewportSize({ width: 1440, height: 1050 })
  await page.reload()
  await page.getByRole('button', { name: 'Утвердить цену', exact: true }).waitFor()
  await page.getByLabel('Комментарий к решению', { exact: true }).fill('Полная себестоимость и маржа проверены.')
  await page.getByRole('checkbox', { name: 'Проверил(а) основания' }).check()
  await page.screenshot({ path: output + '/director-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'Утвердить цену', exact: true }).click()
  await page.getByText('Всё согласовано', { exact: true }).waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: 'Месячные расходы' }).click()
  await page.getByRole('button', { name: 'Новый план / новая версия' }).click()
  await page.getByLabel('Календарный месяц', { exact: true }).fill('2026-12')
  await page.getByLabel('Плановое число изделий', { exact: true }).fill('12')
  for (const label of ['Цех', 'Склад', 'Штатные сотрудники']) await page.getByLabel(label, { exact: true }).fill('100000')
  await page.getByLabel('Прочие постоянные расходы', { exact: true }).fill('0')
  await page.getByLabel('Что входит в план', { exact: true }).fill('Синтетические расходы месяца')
  await page.getByRole('button', { name: 'Создать черновик плана' }).click()
  await page.waitForURL('**kind=month&id=9')
  assert.equal(submitted.at(-1).month, '2026-12-01')
  assert.equal(submitted.at(-1).planned_units, 12)
  assert.deepEqual(errors, [])
  console.log('Approvals UI passed: three roles, no financial controls for production, attachment/proof mapping, conflict preservation, monthly plan, mobile layout.')
} finally { await browser.close() }
