import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4192'
const browser = await chromium.launch({ headless: true })
const report = { base, synthetic_api: true, checks: [] }
const record = (id, kind, name, data = {}) => ({ id, kind, name, data, archived: false, version: 1, updated_at: '2026-11-04T09:00:00Z' })
async function setup({ mobile = false, level = 'full' } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1540, height: 1000 } })
  await context.addInitScript(() => localStorage.setItem('soborbum.auth.token', 'synthetic-token'))
  const page = await context.newPage(), errors = [], writes = [], reads = []
  page.setDefaultTimeout(10000)
  page.on('pageerror', e => errors.push(e.message))
  const pipelines = [record(1, 'pipeline', 'Допродажная воронка'), record(2, 'pipeline', 'Воронка сделки')]
  const stages = [record(10, 'stage', 'Новая заявка', { pipeline_id: 1, sort: 10, color: '#93c5fd', outcome: 'open' }), record(11, 'stage', 'Взята в работу', { pipeline_id: 1, sort: 20, color: '#c4b5fd', outcome: 'open' }), record(12, 'stage', 'Отказ', { pipeline_id: 1, sort: 30, color: '#fca5a5', outcome: 'lost' }), record(20, 'stage', 'Внесён задаток', { pipeline_id: 2, sort: 10, color: '#86efac', outcome: 'open' })]
  const deals = Array.from({ length: 63 }, (_, i) => record(100 + i, 'deal', `Дом для семьи ${i + 1}`, { pipeline_id: 1, stage_id: 10, amount: (i + 1) * 100000, currency: 'RUB', responsible_user_id: 6 }))
  deals.push(record(200, 'deal', 'Встреча в офисе', { pipeline_id: 1, stage_id: 11, amount: 3500000, responsible_user_id: 6 }))
  const state = { failNext: 0, failColumn: false }
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    let body = [], status = 200
    if (request.method() === 'GET') reads.push(path + url.search)
    else if (request.method() === 'PATCH') {
      const input = request.postDataJSON(), entry = deals.find(e => path === `/api/crm/entries/${e.id}`)
      writes.push({ path, input })
      if (state.failNext) { status = state.failNext; state.failNext = 0; body = { detail: status === 409 ? 'Запись уже изменена' : 'Временно недоступно' } }
      else if (!entry || entry.version !== input.version) { status = 409; body = { detail: 'Версия изменилась' } }
      else {
        const target = stages.find(s => s.id === input.data.stage_id)
        assert.equal(target.data.pipeline_id, input.data.pipeline_id)
        if (target.data.outcome === 'lost') assert.ok(input.data.loss_reason.trim())
        entry.data = { ...entry.data, ...input.data }; entry.version++; body = entry
      }
    } else if (!['HEAD', 'GET'].includes(request.method())) {
      throw Error('Unexpected write: ' + request.method() + ' ' + path)
    }
    if (request.method() === 'GET') {
      if (path === '/api/auth/me') body = { id: 6, full_name: 'Гостев Денис', role: 'worker', job_role: 'manager', is_active: true, module_access: { clients: level, tasks: 'edit', ai: 'view' } }
      else if (path === '/api/crm/catalog') body = { pipelines, stages, users: [{ id: 6, name: 'Гостев Денис' }], counts: { deal: deals.length, contact: 0, company: 0, inquiry: 0, task: 0 } }
      else if (path === '/api/crm/entries') {
        const p = url.searchParams, kind = p.get('kind'), query = p.get('query') || ''
        const filtered = kind === 'deal' ? deals.filter(e => (!p.get('pipeline_id') || e.data.pipeline_id === +p.get('pipeline_id')) && (!p.get('stage_id') || e.data.stage_id === +p.get('stage_id')) && e.name.toLowerCase().includes(query.toLowerCase())).sort((a,b) => b.id-a.id) : []
        const offset = +(p.get('offset') || 0), limit = +(p.get('limit') || 50)
        body = { total: filtered.length, items: filtered.slice(offset, offset + limit) }
        if (state.failColumn && p.get('stage_id') === '11') { state.failColumn = false; status = 500; body = { detail: 'Не удалось загрузить этап' } }
      } else if (/\/history$|\/files$/.test(path)) body = { total: 0, items: [] }
      else if (path === '/api/notifications/unread-count') body = { unread_count: 0 }
      else if (path === '/api/crm/attention') body = { total: 0, items: [], counts: {}, settings: { response_hours: 24, idle_days: 3 } }
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(base + '/crm')
  await page.getByRole('region', { name: 'Этап: Новая заявка', exact: true }).locator('article').first().waitFor()
  return { page, context, errors, writes, reads, deals, state }
}
try {
  const t = await setup(), { page } = t
  const first = page.getByRole('region', { name: 'Этап: Новая заявка', exact: true })
  const second = page.getByRole('region', { name: 'Этап: Взята в работу', exact: true })
  assert.equal(await page.getByRole('button', { name: 'Канбан', exact: true }).getAttribute('aria-pressed'), 'true')
  assert.equal(await first.locator('article').count(), 25)
  await second.getByText('Встреча в офисе', { exact: true }).waitFor()
  await first.getByRole('button', { name: 'Показать ещё · 25 из 63' }).click()
  await first.getByRole('button', { name: 'Показать ещё · 50 из 63' }).click()
  await first.getByText('Дом для семьи 1', { exact: true }).waitFor()
  assert.equal(await first.locator('article').count(), 63)
  report.checks.push('default board; all stages loaded independently; 63-card pagination')
  await first.locator('[data-deal-id="162"]').dragTo(second)
  await second.getByText('Дом для семьи 63', { exact: true }).waitFor()
  assert.deepEqual(t.writes.at(-1).input, { version: 1, data: { pipeline_id: 1, stage_id: 11 } })
  await page.reload()
  await second.getByText('Дом для семьи 63', { exact: true }).waitFor()
  report.checks.push('drag stage; persisted after reload; original version sent')
  await second.getByRole('button', { name: 'Переместить: Дом для семьи 63', exact: true }).click()
  let dialog = page.getByRole('dialog', { name: 'Переместить сделку' })
  await dialog.getByLabel('Воронка назначения').selectOption('2')
  await dialog.getByLabel('Этап назначения').selectOption('20')
  await dialog.getByRole('button', { name: 'Переместить', exact: true }).click()
  await page.getByRole('region', { name: 'Этап: Внесён задаток' }).getByText('Дом для семьи 63', { exact: true }).waitFor()
  assert.deepEqual(t.writes.at(-1).input, { version: 2, data: { pipeline_id: 2, stage_id: 20 } })
  assert.equal(new URL(page.url()).searchParams.get('pipeline'), '2')
  report.checks.push('cross-funnel transfer atomically updates stage and pipeline; destination opens')
  await page.locator('[aria-label="Воронки продаж"]').getByRole('button', { name: 'Допродажная воронка' }).click()
  await first.locator('article').first().waitFor()
  await first.locator('[data-deal-id="161"]').dragTo(page.locator('[aria-label="Воронки продаж"]').getByRole('button', { name: 'Воронка сделки', exact: true }))
  dialog = page.getByRole('dialog', { name: 'Переместить сделку' })
  assert.equal(await dialog.getByLabel('Воронка назначения').inputValue(), '2')
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
  assert.equal(t.writes.length, 2)
  report.checks.push('drag onto another funnel opens target-stage picker; cancellation does not write')
  await first.locator('[data-deal-id="161"]').dragTo(page.getByRole('region', { name: 'Этап: Отказ', exact: true }))
  dialog = page.getByRole('dialog', { name: 'Переместить сделку' })
  assert.equal(await dialog.getByRole('button', { name: 'Переместить', exact: true }).isDisabled(), true)
  await dialog.getByLabel('Причина отказа').fill('Клиент выбрал другой проект')
  await dialog.getByRole('button', { name: 'Переместить', exact: true }).click()
  await page.getByRole('region', { name: 'Этап: Отказ', exact: true }).getByText('Дом для семьи 62', { exact: true }).waitFor()
  assert.equal(t.writes.at(-1).input.data.loss_reason, 'Клиент выбрал другой проект')
  report.checks.push('lost-stage transfer requires explicit reason')
  t.state.failNext = 409
  await first.locator('[data-deal-id="160"]').dragTo(second)
  await page.getByRole('alert').filter({ hasText: 'Карточку уже изменил другой сотрудник' }).waitFor()
  await first.locator('[data-deal-id="160"]').waitFor()
  assert.equal(await second.locator('[data-deal-id="160"]').count(), 0)
  report.checks.push('409 conflict refreshes without false move')
  t.state.failNext = 500
  await first.locator('[data-deal-id="160"]').dragTo(second)
  await page.getByRole('alert').filter({ hasText: 'Перенос не сохранён' }).waitFor()
  assert.equal(await first.locator('[data-deal-id="160"]').count(), 1)
  report.checks.push('failed write keeps card in source')
  await first.getByRole('button', { name: 'Добавить сделку', exact: true }).click()
  const create = page.getByRole('dialog', { name: 'Создать · Сделка' })
  assert.equal(await create.getByLabel(/^Воронка/).inputValue(), '1')
  assert.equal(await create.getByLabel(/^Этап/).inputValue(), '10')
  await create.getByRole('button', { name: 'Отмена', exact: true }).click()
  await first.locator('article').first().getByRole('button', { name: 'Следующий шаг' }).click()
  await page.getByRole('dialog', { name: 'Создать · Задача' }).waitFor()
  await page.getByRole('dialog').getByRole('button', { name: 'Отмена', exact: true }).click()
  await first.locator('article').first().getByRole('button').first().click()
  await page.getByText('Добавить заметку', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
  report.checks.push('stage-prefilled creation; next-step action; existing detail and history')
  t.state.failColumn = true
  await page.getByRole('button', { name: 'Обновить доску' }).click()
  await second.getByRole('alert').waitFor()
  await second.getByRole('button', { name: 'Повторить загрузку' }).click()
  await second.getByText('Встреча в офисе', { exact: true }).waitFor()
  report.checks.push('per-stage network failure and retry')
  await page.getByLabel('Поиск в продажах').fill('Встреча в офисе')
  await second.getByText('Встреча в офисе', { exact: true }).waitFor()
  await first.getByText('По этому запросу сделок нет').waitFor()
  assert.equal(await page.locator('[data-deal-id]').count(), 1)
  await page.getByLabel('Поиск в продажах').fill('')
  await first.locator('article').first().waitFor()
  await page.getByRole('button', { name: 'Список', exact: true }).click()
  await page.getByRole('table').waitFor()
  await page.getByRole('button', { name: 'Канбан', exact: true }).click()
  await first.locator('article').first().waitFor()
  report.checks.push('search and list toggle')
  const menu = page.getByRole('complementary', { name: 'Главное меню' })
  const hrefs = await menu.locator('nav a').evaluateAll(els => els.map(e => e.getAttribute('href')))
  assert.equal(new Set(hrefs).size, hrefs.length)
  for (const label of ['Компании', 'Работа', 'Продажи', 'Поставщики', 'Производство']) assert.equal(await menu.getByRole('link', { name: label, exact: true }).count(), 0)
  assert.equal(await menu.locator('nav [aria-current="page"]').count(), 1)
  assert.equal(t.reads.some(path => /^\/api\/(production|warehouse|accounting|clients|moysklad)/.test(path)), false)
  await mkdir('test-results', { recursive: true })
  await page.screenshot({ path: 'test-results/crm-kanban-desktop.png', fullPage: true })
  assert.deepEqual(t.errors, [])
  await t.context.close()
  const m = await setup({ mobile: true })
  assert.ok(await m.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await m.page.locator('article').first().getByRole('button', { name: /^Переместить:/ }).click()
  await m.page.getByLabel('Воронка назначения').selectOption('2')
  await m.page.getByLabel('Этап назначения').selectOption('20')
  await m.page.getByRole('dialog').getByRole('button', { name: 'Переместить', exact: true }).click()
  await m.page.getByRole('region', { name: 'Этап: Внесён задаток' }).locator('article').waitFor()
  await m.page.screenshot({ path: 'test-results/crm-kanban-mobile.png', fullPage: true })
  assert.deepEqual(m.errors, []); await m.context.close()
  report.checks.push('unique manager menu; no production/cost requests; mobile transfer without dragging')
  const v = await setup({ level: 'view' })
  assert.equal(await v.page.locator('article[draggable="true"]').count(), 0)
  assert.equal(await v.page.getByRole('button', { name: /^Переместить:/ }).count(), 0)
  assert.equal(await v.page.getByRole('button', { name: 'Добавить сделку', exact: true }).count(), 0)
  assert.deepEqual(v.writes, []); assert.deepEqual(v.errors, []); await v.context.close()
  report.checks.push('read-only access cannot move or create')
  await writeFile('test-results/crm-kanban.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally { await browser.close() }
