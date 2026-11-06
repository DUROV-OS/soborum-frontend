import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { chromium } from 'playwright'

const base = 'http://127.0.0.1:4198'
const browser = await chromium.launch({ headless: true })
const report = { ok: false, synthetic_api: true, real_messages: 0, checks: [] }
function png(width = 96, height = 64, color = [32, 124, 166, 255]) {
  function chunk(kind, data) {
    const body = Buffer.concat([Buffer.from(kind), data]), crc = Buffer.alloc(4), length = Buffer.alloc(4)
    let value = 0xffffffff
    for (const byte of body) { value ^= byte; for (let i = 0; i < 8; i++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0) }
    crc.writeUInt32BE((value ^ 0xffffffff) >>> 0); length.writeUInt32BE(data.length)
    return Buffer.concat([length, body, crc])
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6
  const pixels = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let c = 0; c < 4; c++)
    pixels[y * (width * 4 + 1) + 1 + x * 4 + c] = x > width / 3 && x < width * 2 / 3 && y > height / 4 && y < height * 3 / 4 ? 255 : color[c]
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))])
}
const first = png(), second = png(96, 64, [100, 70, 170, 255])
const entry = (id, kind, name, data = {}) => ({ id, kind, name, data, version: 1, archived: false, updated_at: '2026-11-06T09:00:00Z' })
const file = (buffer = first, name = 'synthetic-logo.png', mimeType = 'image/png') => ({ name, mimeType, buffer })
async function until(check) { for (let i = 0; i < 100; i++) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 50)) } assert.fail('Expected UI state did not arrive') }
async function setup({ level = 'full', agency = true, saved = false, mobile = false, archived = false } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, serviceWorkers: 'block' })
  await context.addInitScript(() => {
    localStorage.setItem('soborbum.auth.token', 'synthetic-agency-logo-only')
    for (const key of ['crm', 'tasks']) localStorage.setItem('soborbum.onboarding.' + key, '1')
    window.WebSocket = class { static OPEN = 1; readyState = 0; close() {} send() {} }
    window.logoObjectUrls = { created: [], revoked: [] }
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL)
    URL.createObjectURL = blob => { const url = create(blob); window.logoObjectUrls.created.push(url); return url }
    URL.revokeObjectURL = url => { window.logoObjectUrls.revoked.push(url); revoke(url) }
  })
  const page = await context.newPage(), writes = [], reads = [], errors = []
  page.setDefaultTimeout(15000)
  page.on('pageerror', error => errors.push(error.message))
  const pipelines = [entry(1, 'pipeline', 'Продажи', { purpose: 'sales' }), entry(32, 'pipeline', 'Агентства недвижимости', { purpose: 'agency' })]
  const stages = [entry(10, 'stage', 'Новые заявки', { pipeline_id: 1, sort: 1, outcome: 'open' }), entry(9782, 'stage', 'Новое агентство', { pipeline_id: 32, sort: 1, outcome: 'open' }), entry(9785, 'stage', 'Работаем', { pipeline_id: 32, sort: 2, outcome: 'open' })]
  const row = entry(801, 'deal', agency ? 'АН Проверочное' : 'Проверочная продажа', { pipeline_id: agency ? 32 : 1, stage_id: agency ? 9782 : 10, amount: 4500000, currency: 'RUB', contact_ids: [], agency_profile: { legal_status: 'ooo', members: [] } })
  row.archived = archived
  const state = { image: saved ? first : null, failOnce: 0, delay: 0 }
  const meta = () => state.image ? { content_type: 'image/png', width: 96, height: 64, byte_size: state.image.length, sha256: createHash('sha256').update(state.image).digest('hex'), updated_at: '2026-11-06T09:00:00Z' } : null
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method()
    if (url.origin !== base) return route.abort()
    if (!path.startsWith('/api/')) return route.continue()
    reads.push({ method, path, search: url.search, headers: request.headers() })
    assert.ok(!/token|bearer/i.test(url.search))
    let body = [], status = 200
    if (path.startsWith('/api/crm/agencies/801/logo')) {
      assert.equal(request.headers().authorization, 'Bearer synthetic-agency-logo-only')
      if (method !== 'GET') {
        const bytes = request.postDataBuffer(), input = method === 'DELETE' ? request.postDataJSON() : null
        writes.push({ method, path, bytes, input, headers: request.headers() })
        if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay))
        if (state.failOnce) { status = state.failOnce; state.failOnce = 0; body = { detail: status === 409 ? 'Карточка уже изменена. Обновите её.' : 'Выберите неподвижное изображение без анимации' } }
        else if (method === 'PUT' ? request.headers()['if-match'] !== `"${row.version}"` : input.version !== row.version) { status = 409; body = { detail: 'Карточка уже изменена. Обновите её.' } }
        else { row.version++; state.image = method === 'PUT' ? bytes : null; body = { entry: row, logo: meta() } }
      } else if (path.endsWith('/content')) {
        assert.equal(request.headers()['if-match'], `"${meta().sha256}"`)
        return route.fulfill({ status: 200, contentType: 'image/png', body: state.image, headers: { 'Cache-Control': 'private, no-store' } })
      } else body = { agency_id: row.id, version: row.version, logo: meta() }
    } else if (method !== 'GET') { writes.push({ method, path }); status = 400; body = { detail: 'Unexpected synthetic mutation' } }
    else if (path === '/api/auth/me') body = { id: 6, full_name: 'Тестовый менеджер', role: 'worker', job_role: 'manager', is_active: true, access_profile: 'sales_manager', module_access: { clients: level, tasks: 'edit' } }
    else if (path === '/api/crm/catalog') body = { pipelines, stages, users: [{ id: 6, name: 'Тестовый менеджер' }], counts: {} }
    else if (path === '/api/crm/entries') body = { total: url.searchParams.get('kind') === 'deal' ? 1 : 0, items: url.searchParams.get('kind') === 'deal' ? [row] : [] }
    else if (path === '/api/crm/entries/801') body = row
    else if (/\/(history|files)$/.test(path)) body = { total: 0, items: [] }
    else if (path === '/api/crm/kanban-summary') body = { columns: stages.map(stage => ({ pipeline_id: stage.data.pipeline_id, stage_id: stage.id, count: 0, amounts: {}, unpriced_count: 0 })), unmapped_count: 0 }
    else if (path === '/api/costing/context') body = { estimates: [], templates: [], links: [], order_lines: null, can_import_recipe: false }
    else if (path === '/api/notifications/unread-count') body = { unread_count: 0 }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(base + '/crm?tab=deal&view=list&entry=801')
  const card = page.getByRole('dialog', { name: row.name, exact: true }), logo = card.getByRole('region', { name: 'Логотип компании', exact: true })
  await card.waitFor()
  if (agency) await logo.getByText(saved ? 'Сохранённый логотип' : 'Логотип ещё не добавлен', { exact: true }).waitFor()
  return { context, page, card, logo, writes, reads, errors, row, state }
}
async function choose(t, candidate = file()) {
  await t.logo.getByLabel('Изображение логотипа компании', { exact: true }).setInputFiles(candidate)
}
async function save(t) {
  await t.logo.getByRole('button', { name: 'Сохранить логотип', exact: true }).click()
  await t.logo.getByText('Логотип сохранён', { exact: true }).waitFor()
  await t.logo.getByText('Сохранённый логотип', { exact: true }).waitFor()
}
async function close(t) {
  assert.deepEqual(t.errors, [])
  await t.card.getByRole('button', { name: 'Закрыть', exact: true }).click()
  await until(() => t.page.evaluate(() => window.logoObjectUrls.created.every(url => window.logoObjectUrls.revoked.includes(url))))
  await t.context.close()
}
try {
  await mkdir('test-results', { recursive: true })
  let t = await setup()
  const before = structuredClone(t.row.data)
  await t.card.getByLabel('Текст заметки', { exact: true }).fill('Несохранённая тестовая заметка')
  await choose(t)
  await t.logo.getByAltText('Предпросмотр нового логотипа').waitFor()
  assert.equal(t.writes.length, 0)
  await t.page.screenshot({ path: 'test-results/crm-agency-logo-preview.png' })
  await save(t)
  assert.deepEqual(t.writes[0].bytes, first)
  assert.equal(t.writes[0].headers['content-type'], 'image/png')
  assert.equal(t.writes[0].headers['if-match'], '"1"')
  assert.deepEqual(t.row.data, before)
  assert.equal(await t.card.getByLabel('Текст заметки', { exact: true }).inputValue(), 'Несохранённая тестовая заметка')
  await choose(t, file(second)); await save(t)
  assert.deepEqual(t.state.image, second)
  assert.equal(t.writes[1].headers['if-match'], '"2"')
  await t.logo.getByRole('button', { name: 'Удалить логотип…', exact: true }).click()
  await t.logo.getByRole('button', { name: 'Отмена удаления', exact: true }).click()
  assert.equal(t.writes.length, 2)
  await t.page.screenshot({ path: 'test-results/crm-agency-logo-desktop.png' })
  await t.logo.getByRole('button', { name: 'Удалить логотип…', exact: true }).click()
  await t.logo.getByRole('button', { name: 'Удалить логотип', exact: true }).click()
  await t.logo.getByText('Логотип удалён', { exact: true }).waitFor()
  assert.deepEqual(t.writes[2].input, { version: 3 }); assert.equal(t.state.image, null)
  await close(t)
  report.checks.push('Preview then explicit raw PUT; replacement and confirmed FULL deletion; fields, stage and draft note preserved; object URLs released')

  for (const level of ['view', 'edit']) {
    t = await setup({ level, saved: true, mobile: level === 'edit' })
    assert.equal(await t.logo.getByRole('button', { name: 'Удалить логотип…', exact: true }).count(), 0)
    assert.equal(await t.logo.getByLabel('Изображение логотипа компании', { exact: true }).count(), level === 'edit' ? 1 : 0)
    if (level === 'edit') {
      await choose(t); await save(t)
      assert.ok(await t.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      await t.page.screenshot({ path: 'test-results/crm-agency-logo-mobile.png' })
    } else assert.equal(t.writes.length, 0)
    await close(t)
  }
  report.checks.push('VIEW reads only; EDIT replaces without delete; mobile 390px fits')

  t = await setup({ saved: true })
  for (const [candidate, text] of [
    [file(Buffer.from('<svg/>'), 'logo.svg', 'image/svg+xml'), 'Выберите изображение PNG, JPEG или WebP'],
    [file(Buffer.from('html'), 'pretend.png'), 'Файл не является изображением PNG, JPEG или WebP'],
    [file(Buffer.alloc(0)), 'Выбран пустой файл'],
    [file(Buffer.alloc(5 * 1024 * 1024 + 1)), 'Размер файла должен быть не больше 5 МБ'],
    [file(png(4097, 1)), 'Изображение слишком большое: максимум 4096 пикселей по стороне и 8 мегапикселей'],
  ]) { await choose(t, candidate); await t.logo.getByText(text, { exact: true }).waitFor(); assert.equal(t.writes.length, 0) }
  await choose(t); t.state.failOnce = 422
  await t.logo.getByRole('button', { name: 'Сохранить логотип', exact: true }).click()
  await t.logo.getByText('Выберите неподвижное изображение без анимации', { exact: true }).waitFor()
  assert.equal(await t.logo.getByRole('button', { name: 'Сохранить логотип', exact: true }).isEnabled(), false)
  assert.deepEqual(t.state.image, first)
  await close(t)
  report.checks.push('SVG/disguised HTML/empty/oversize/dimension validation; authoritative server rejection disables retry and preserves prior logo')

  t = await setup({ saved: true })
  await choose(t, file(second)); t.row.version++; t.row.data.amount = 7654321
  await t.logo.getByRole('button', { name: 'Сохранить логотип', exact: true }).click()
  await t.logo.getByText('Карточка уже изменена. Обновите её.', { exact: true }).waitFor()
  assert.equal(await t.logo.getByRole('button', { name: 'Сохранить логотип', exact: true }).isEnabled(), false)
  assert.equal(t.writes.length, 1)
  await t.logo.getByRole('button', { name: 'Обновить карточку перед сохранением', exact: true }).click()
  await t.logo.getByText('Карточка обновлена. Проверьте текущий логотип и повторите сохранение, если замена ещё нужна.', { exact: true }).waitFor()
  assert.equal(t.writes.length, 1)
  await save(t)
  assert.equal(t.writes[1].headers['if-match'], '"2"'); assert.equal(t.row.data.amount, 7654321)
  await close(t)
  report.checks.push('409 retains preview, blocks retries until refresh; refreshed data wins and no automatic resubmission')

  t = await setup()
  await t.card.getByLabel('Этап сделки', { exact: true }).selectOption('9785')
  await t.logo.getByText('Сначала сохраните выбранный этап.', { exact: true }).waitFor()
  assert.equal(await t.logo.getByRole('button', { name: 'Выбрать изображение', exact: true }).isEnabled(), false)
  assert.equal(await t.card.getByLabel('Этап сделки', { exact: true }).inputValue(), '9785')
  assert.equal(t.writes.length, 0)
  await close(t)
  for (const options of [{ agency: false }, { archived: true, saved: true }]) {
    t = await setup(options)
    assert.equal(await t.card.getByLabel('Изображение логотипа компании', { exact: true }).count(), 0)
    if (!options.agency && !options.archived) assert.ok(!t.reads.some(read => read.path.includes('/logo')))
    await close(t)
  }
  report.checks.push('Unsaved stage is protected; sales cards have no logo route; archived agency is read-only')
  report.ok = true
} catch (error) { report.error = String(error.stack || error); process.exitCode = 1 }
finally { await browser.close(); await writeFile('test-results/crm-agency-logo.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)) }
