import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4192'
const browser = await chromium.launch({ headless: true })
const report = { base, synthetic_api: true, checks: [] }
const record = (id, kind, name, data = {}) => ({ id, kind, name, data, archived: false, version: 3, updated_at: '2026-11-04T09:00:00Z' })

async function setup({ level = 'full', failSecondPage = false, mobile = false } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1540, height: 1000 } })
  await context.addInitScript(() => localStorage.setItem('soborbum.auth.token', 'synthetic-inbox-token'))
  const page = await context.newPage(), reads = [], writes = [], errors = []
  page.setDefaultTimeout(12000)
  page.on('pageerror', error => errors.push(error.message))
  const pipelines = [record(1, 'pipeline', 'Допродажная воронка'), record(2, 'pipeline', 'Воронка сделки')]
  const stages = [record(10, 'stage', 'Новая заявка', { pipeline_id: 1, sort: 10, outcome: 'open', color: '#93c5fd' }), record(11, 'stage', 'Взята в работу', { pipeline_id: 1, sort: 20, outcome: 'open', color: '#c4b5fd' }), record(20, 'stage', 'Задаток', { pipeline_id: 2, sort: 10, outcome: 'open', color: '#86efac' })]
  const linked = record(2000, 'deal', 'Исходное название сделки', { pipeline_id: 1, stage_id: 10, is_unsorted: true, amount: 4876543, currency: 'RUB', contact_ids: [333, 334], company_id: 444, responsible_user_id: 7, custom_fields: [{ field_id: 91, values: [{ value: 'Проверенное условие' }] }], loss_reason: '' })
  const inquiries = Array.from({ length: 172 }, (_, i) => record(7000 + i, 'inquiry', 'Источник заявки', { pipeline_id: 1, contact_name: i === 0 ? 'Клиент со связанной сделкой' : i === 1 ? 'tardy record' : `Клиент ${i}`, source_name: 'Форма сайта', deal_id: i === 0 ? linked.id : 2100 + i, accepted_deal_id: null, phone: `7999000${String(i).padStart(4, '0')}` }))
  inquiries.push(record(8000, 'inquiry', 'Заявка с сайта', { pipeline_id: null, contact_name: 'Unique web request', source_name: 'Сайт', accepted_deal_id: null }))
  inquiries.push(record(8001, 'inquiry', 'Другая воронка', { pipeline_id: 2, contact_name: 'Другой клиент', accepted_deal_id: null }))
  const deals = [record(99, 'deal', 'Обычная новая сделка', { pipeline_id: 1, stage_id: 10, amount: 100000, currency: 'RUB', responsible_user_id: 6 })]
  const state = { failSecondPage, delayedQuery: null, releaseDelayed: null, onDelayed: null }
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    let body = [], status = 200
    if (request.method() !== 'GET') {
      writes.push({ method: request.method(), path, body: request.postDataJSON() })
      if (request.method() === 'POST' && path === '/api/crm/entries/7000/accept') {
        const input = request.postDataJSON()
        body = { ...linked, name: input.name, data: input.data }
        inquiries[0].archived = true
        inquiries[0].data.accepted_deal_id = linked.id
        deals.push(body)
      } else { status = 400; body = { detail: 'Unexpected synthetic write' } }
    } else {
      reads.push(path + url.search)
      if (path === '/api/auth/me') body = { id: 6, full_name: 'Менеджер проверки', role: 'worker', job_role: 'manager', is_active: true, module_access: { clients: level, tasks: 'edit' } }
      else if (path === '/api/crm/catalog') body = { pipelines, stages, users: [{ id: 6, name: 'Менеджер проверки' }, { id: 7, name: 'Прежний ответственный' }], counts: { inquiry: inquiries.filter(entry => !entry.archived).length, deal: deals.length } }
      else if (path === '/api/crm/entries/2000') body = linked
      else if (path === '/api/crm/entries') {
        const params = url.searchParams, kind = params.get('kind'), query = params.get('query') || ''
        const offset = +(params.get('offset') || 0), limit = +(params.get('limit') || 50)
        const candidates = kind === 'inquiry' ? inquiries : kind === 'deal' ? deals : []
        const filtered = candidates.filter(entry => !entry.archived && JSON.stringify(entry).toLowerCase().includes(query.toLowerCase()) && (!params.get('pipeline_id') || String(entry.data.pipeline_id) === params.get('pipeline_id')) && (!params.get('stage_id') || String(entry.data.stage_id) === params.get('stage_id'))).sort((a, b) => b.id - a.id)
        body = { total: filtered.length, items: filtered.slice(offset, offset + limit) }
        if (kind === 'inquiry' && offset === 100 && state.failSecondPage) { state.failSecondPage = false; status = 500; body = { detail: 'Ошибка второй страницы' } }
        if (kind === 'inquiry' && query === state.delayedQuery) {
          await new Promise(resolve => { state.releaseDelayed = resolve; state.onDelayed?.() })
        }
      } else if (/\/history$|\/files$/.test(path)) body = { total: 0, items: [] }
      else if (path === '/api/notifications/unread-count') body = { unread_count: 0 }
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(base + '/crm')
  return { page, context, reads, writes, errors, state, linked, inquiries }
}

async function ready(page, count = 173) {
  await page.locator(`[data-inbox-scope="pipeline"][data-total="${count}"][aria-busy="false"]`).waitFor()
}

try {
  const t = await setup(), { page } = t
  await ready(page)
  const column = page.locator('[data-stage-id="10"]'), inbox = column.locator('[data-inbox-scope="pipeline"]')
  await column.locator('[data-column-total="174"]').waitFor()
  assert.equal(await column.locator('[data-column-total]').getAttribute('data-column-total'), '174')
  assert.equal(await inbox.locator('[data-inquiry-id]').count(), 25)
  assert.equal(await column.locator('[data-inquiry-id="8000"]').count(), 1)
  assert.equal(await page.locator('[data-inquiry-id="8001"]').count(), 0)
  assert.equal(await page.getByRole('heading', { name: /Неразобранные|Без воронки/ }).count(), 0)
  while (await inbox.getByRole('button', { name: /^Показать ещё заявки/ }).count()) await inbox.getByRole('button', { name: /^Показать ещё заявки/ }).click()
  const ids = await inbox.locator('[data-inquiry-id]').evaluateAll(nodes => nodes.map(node => Number(node.dataset.inquiryId)))
  assert.deepEqual(ids.sort((a,b) => a-b), [...Array.from({ length: 172 }, (_,i) => 7000+i), 8000])
  assert.equal(new Set(ids).size, 173)
  assert.ok(t.reads.some(path => path.includes('kind=inquiry') && path.includes('offset=100')))
  report.checks.push('all 174 API inquiries paged; 173 canonical incoming cards plus normal deal in New stage; null pipeline uses default; exact IDs without duplicates')

  await inbox.locator('[data-inquiry-id="7000"]').dragTo(page.locator('[data-stage-id="11"]'))
  let dialog = page.getByRole('dialog', { name: 'Создать · Сделка' })
  await dialog.waitFor()
  assert.equal(await dialog.getByLabel(/^Название/).inputValue(), t.linked.name)
  assert.equal(await dialog.getByLabel('Бюджет, ₽').inputValue(), String(t.linked.data.amount))
  assert.equal(await dialog.getByLabel(/^Ответственный/).inputValue(), '7')
  assert.equal(await dialog.getByLabel(/^Этап/).inputValue(), '11')
  await dialog.getByText('Привязано контактов: 2', { exact: true }).waitFor()
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
  assert.deepEqual(t.writes, [])
  report.checks.push('dragging opens existing linked commercial data; cancel sends no mutation')

  await inbox.locator('[data-inquiry-id="7000"]').dragTo(page.locator('[data-stage-id="11"]'))
  dialog = page.getByRole('dialog', { name: 'Создать · Сделка' })
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await page.getByText('Добавить заметку', { exact: true }).waitFor()
  const accepted = t.writes.at(-1)
  assert.equal(accepted.path, '/api/crm/entries/7000/accept')
  assert.equal(accepted.body.name, t.linked.name)
  for (const key of ['amount', 'currency', 'contact_ids', 'company_id', 'custom_fields', 'responsible_user_id']) assert.deepEqual(accepted.body.data[key], t.linked.data[key])
  assert.equal(accepted.body.data.is_unsorted, false)
  assert.equal(accepted.body.data.stage_id, 11)
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
  await ready(page, 172)
  report.checks.push('synthetic acceptance preserves company, custom fields, contacts, owner, amount and name')

  await page.locator('[aria-label="Воронки продаж"]').getByRole('button', { name: 'Воронка сделки', exact: true }).click()
  await ready(page, 1)
  await page.locator('[data-inquiry-id="8001"]').waitFor()
  assert.equal(await page.locator('[data-inquiry-id="8000"]').count(), 0)
  await page.locator('[aria-label="Воронки продаж"]').getByRole('button', { name: 'Допродажная воронка', exact: true }).click()
  await ready(page, 172)
  report.checks.push('inquiry ownership by funnel; default website card belongs only to pre-sales funnel')

  t.state.delayedQuery = 'tardy'
  const delayed = new Promise(resolve => { t.state.onDelayed = resolve })
  await page.getByLabel('Поиск в продажах').fill('tardy')
  await delayed
  await page.getByLabel('Поиск в продажах').fill('Unique web request')
  await ready(page, 1)
  await page.locator('[data-inquiry-id="8000"]').waitFor()
  const oldResponse = page.waitForResponse(response => response.url().includes('kind=inquiry') && new URL(response.url()).searchParams.get('query') === 'tardy')
  t.state.releaseDelayed()
  await oldResponse
  await page.waitForTimeout(100)
  assert.equal(await page.locator('[data-inquiry-id="8000"]').count(), 1)
  assert.equal(await page.locator('[data-inquiry-id="7001"]').count(), 0)
  assert.deepEqual(t.errors, [])
  report.checks.push('delayed old query cannot replace current incoming results')
  await t.context.close()

  const failed = await setup({ failSecondPage: true })
  await failed.page.getByRole('alert').filter({ hasText: 'Ошибка второй страницы' }).waitFor()
  assert.equal(await failed.page.locator('[data-inquiry-id]').count(), 0)
  await failed.page.getByRole('button', { name: 'Повторить загрузку входящих', exact: true }).click()
  await ready(failed.page)
  assert.deepEqual(failed.writes, []); assert.deepEqual(failed.errors, [])
  await failed.context.close()
  report.checks.push('failed later page exposes no partial list; retry restores full count')

  const viewer = await setup({ level: 'view', mobile: true })
  await ready(viewer.page)
  assert.equal(await viewer.page.locator('[data-inquiry-id][draggable="true"]').count(), 0)
  assert.equal(await viewer.page.getByRole('button', { name: /^Взять в работу:/ }).count(), 0)
  assert.ok(await viewer.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  assert.deepEqual(viewer.writes, []); assert.deepEqual(viewer.errors, [])
  await viewer.context.close()
  report.checks.push('read-only incoming cards cannot drag/accept; mobile layout fits viewport')
  await mkdir('test-results', { recursive: true })
  await writeFile('test-results/crm-inbox.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally { await browser.close() }
