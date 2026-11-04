import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4192'
const browser = await chromium.launch({ headless: true })
const report = { base, synthetic_api: true, checks: [] }
const record = (id, kind, created, data = {}) => ({ id, kind, name: `${kind} ${id}`, data,
  effective_owner_id: 6, archived: false, version: 1, updated_at: '2026-11-04T09:00:00Z',
  source_created_at: created, source_created_at_kind: created ? 'amocrm' : 'unknown' })
const chronology = (a, b) => a.source_created_at && b.source_created_at
  ? Date.parse(b.source_created_at) - Date.parse(a.source_created_at) || b.id - a.id
  : a.source_created_at ? -1 : b.source_created_at ? 1 : b.id - a.id

try {
  const context = await browser.newContext({ viewport: { width: 1540, height: 1000 } })
  await context.addInitScript(() => localStorage.setItem('soborbum.auth.token', 'synthetic-date-token'))
  const page = await context.newPage(), errors = [], reads = [], writes = []
  page.setDefaultTimeout(12000)
  page.on('pageerror', error => errors.push(error.message))
  const pipeline = record(1, 'pipeline', null)
  pipeline.name = 'Допродажная воронка'
  const first = record(10, 'stage', null, { pipeline_id: 1, outcome: 'open', sort: 1, color: '#93c5fd' })
  first.name = 'Новая заявка'
  const next = record(11, 'stage', null, { pipeline_id: 1, outcome: 'open', sort: 2, color: '#c4b5fd' })
  next.name = 'В работе'
  const stamp = index => new Date(Date.UTC(2026, 10, 3, 21, 0, index)).toISOString()
  // Larger imported IDs are older. The two record kinds interleave by source date.
  const deals = Array.from({ length: 126 }, (_, index) => record(100 + index, 'deal', stamp(252 - index * 2),
    { pipeline_id: 1, stage_id: 10, amount: 10, responsible_user_id: 6 }))
  const inquiries = Array.from({ length: 126 }, (_, index) => record(1000 + index, 'inquiry', stamp(253 - index * 2),
    { pipeline_id: 1, contact_name: `Incoming ${index}`, responsible_user_id: 6 }))
  deals.push(record(9000, 'deal', null, { pipeline_id: 1, stage_id: 10, amount: 5, responsible_user_id: 6 }))
  inquiries.push(record(9001, 'inquiry', null, { pipeline_id: 1, contact_name: 'Unknown original date' }))
  deals.push(record(3000, 'deal', '2026-11-03T20:59:59Z', { pipeline_id: 1, stage_id: 10, amount: 7, responsible_user_id: 6 }))
  const stageTwo = record(4000, 'deal', '2026-11-04T21:00:00Z', { pipeline_id: 1, stage_id: 11, amount: 20, responsible_user_id: 6 })
  deals.push(stageTwo)
  const filter = (entries, params) => entries.filter(entry => {
    if (params.get('owner_id') && (entry.effective_owner_id || 0) !== Number(params.get('owner_id'))) return false
    if (params.get('pipeline_id') && Number(params.get('pipeline_id')) !== entry.data.pipeline_id) return false
    if (params.get('stage_id') && Number(params.get('stage_id')) !== entry.data.stage_id) return false
    if (params.get('date_unknown') === 'true') return !entry.source_created_at
    if (!params.get('date_from') && !params.get('date_to')) return true
    if (!entry.source_created_at) return false
    const timestamp = Date.parse(entry.source_created_at)
    const start = params.get('date_from') ? Date.parse(params.get('date_from') + 'T00:00:00+03:00') : -Infinity
    const end = params.get('date_to') ? Date.parse(params.get('date_to') + 'T00:00:00+03:00') + 86400000 : Infinity
    return timestamp >= start && timestamp < end
  }).sort(chronology)
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, params = url.searchParams
    if (request.method() !== 'GET') { writes.push(request.method()); return route.abort() }
    reads.push(path + url.search)
    let body = []
    if (path === '/api/auth/me') body = { id: 6, full_name: 'Synthetic manager', role: 'worker', job_role: 'manager', is_active: true, module_access: { clients: 'view', tasks: 'view' } }
    else if (path === '/api/crm/catalog') body = { pipelines: [pipeline], stages: [first, next], users: [{ id: 6, name: 'Synthetic manager' }], counts: { deal: deals.length, inquiry: inquiries.length, task: 0, company: 0, contact: 0 } }
    else if (path === '/api/crm/entries') {
      const entries = filter(params.get('kind') === 'inquiry' ? inquiries : params.get('kind') === 'deal' ? deals : [], params)
      const offset = Number(params.get('offset') || 0), limit = Number(params.get('limit') || 50)
      body = { total: entries.length, items: entries.slice(offset, offset + limit) }
    } else if (path === '/api/crm/kanban-summary') {
      const current = filter([...deals, ...inquiries], params)
      body = { columns: [first, next].map(stage => {
        const cards = current.filter(entry => entry.kind === 'inquiry' ? stage.id === 10 : entry.data.stage_id === stage.id)
        const sum = cards.reduce((total, entry) => total + Number(entry.data.amount || 0), 0)
        return { pipeline_id: 1, stage_id: stage.id, count: cards.length, amounts: sum ? { RUB: sum } : {}, unpriced_count: cards.filter(entry => !entry.data.amount).length }
      }), unmapped_count: 0 }
    } else if (path === '/api/crm/attention') body = { total: 0, items: [], counts: {}, settings: {} }
    else if (path === '/api/notifications/unread-count') body = { unread_count: 0 }
    else if (/\/history$|\/files$/.test(path)) body = { total: 0, items: [] }
    else if (/^\/api\/crm\/entries\/\d+$/.test(path)) body = [...deals, ...inquiries].find(entry => path.endsWith('/' + entry.id))
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(base + '/crm?pipeline=1&view=board')
  const column = page.locator('[data-stage-id="10"]')
  const ready = async total => {
    await page.locator('[aria-label="Канбан сделок"][aria-busy="false"]').waitFor()
    await column.locator('[data-inbox-scope="pipeline"][aria-busy="false"]').waitFor()
    await column.locator(`[data-column-total="${total}"]`).waitFor()
    await column.locator('article').first().waitFor()
  }
  const ids = () => column.locator('article').evaluateAll(nodes => nodes.map(node => Number(node.dataset.dealId || node.dataset.inquiryId)))
  const all = [...deals.filter(entry => entry.data.stage_id === 10), ...inquiries].sort(chronology)
  await ready(all.length)
  assert.deepEqual(await ids(), all.slice(0, 25).map(entry => entry.id))
  assert.equal((await ids())[0], 1000)
  assert.equal((await ids())[1], 100)
  assert.ok(reads.some(value => value.includes('kind=deal') && value.includes('stage_id=10') && value.includes('offset=100')))
  assert.ok(reads.some(value => value.includes('kind=inquiry') && value.includes('offset=100')))
  while (await column.getByRole('button', { name: /^Показать ещё карточки/ }).count()) await column.getByRole('button', { name: /^Показать ещё карточки/ }).click()
  assert.deepEqual(await ids(), all.map(entry => entry.id))
  assert.deepEqual((await ids()).slice(-2), [9001, 9000])
  assert.equal(await column.getByText('Исходная дата неизвестна', { exact: true }).count(), 2)
  report.checks.push('126 deals and 126 inquiries merge chronologically before display pagination; unknown source dates are last')

  await page.getByLabel('Дата заявки с', { exact: true }).fill('2026-11-04')
  await page.getByLabel('Дата заявки по', { exact: true }).fill('2026-11-04')
  await ready(252)
  await column.locator('[data-stage-budget]').getByText(/1.*260.*₽/).waitFor()
  assert.equal(await page.locator('[data-deal-id="3000"], [data-deal-id="4000"]').count(), 0)
  assert.match(await column.locator('article').first().locator('time').textContent(), /04\.11\..*00:04/)
  const dateReads = reads.filter(value => value.includes('date_from=2026-11-04') && value.includes('date_to=2026-11-04'))
  assert.ok(dateReads.some(value => value.includes('kanban-summary')))
  assert.ok(dateReads.some(value => value.includes('kind=deal') && value.includes('offset=100')))
  assert.ok(dateReads.some(value => value.includes('kind=inquiry') && value.includes('offset=100')))
  report.checks.push('Moscow inclusive day flows through both paginated sources and full column budgets')

  const ownerSummary = page.waitForResponse(response => {
    const url = new URL(response.url())
    return url.pathname.endsWith('/kanban-summary') && url.searchParams.get('owner_id') === '6' && url.searchParams.get('date_from') === '2026-11-04'
  })
  await page.getByLabel('Фильтр по ответственному').selectOption('6')
  await ownerSummary
  await ready(252)
  assert.ok(reads.some(value => value.includes('owner_id=6') && value.includes('date_from=2026-11-04') && value.includes('kanban-summary')))
  await page.getByRole('button', { name: 'Список', exact: true }).click()
  await page.getByRole('table').waitFor()
  assert.ok(reads.some(value => value.includes('kind=deal') && value.includes('date_from=2026-11-04') && !value.includes('stage_id=')))
  await page.getByRole('button', { name: 'Канбан', exact: true }).click()
  await ready(252)
  report.checks.push('date filters remain combined with owner and persist between board and list')

  await page.getByLabel('Без исходной даты', { exact: true }).check()
  await ready(2)
  assert.deepEqual(await ids(), [9001, 9000])
  assert.equal(await page.getByLabel('Дата заявки с', { exact: true }).inputValue(), '')
  assert.equal(await page.getByLabel('Дата заявки с', { exact: true }).isDisabled(), true)
  assert.ok(reads.some(value => value.includes('date_unknown=true') && value.includes('kanban-summary')))
  await page.getByLabel('Без исходной даты', { exact: true }).uncheck()
  await ready(all.length)
  assert.deepEqual(await ids(), all.slice(0, 25).map(entry => entry.id))
  report.checks.push('unknown-date bucket is explicit and reset restores all original cards')
  assert.deepEqual(errors, [])
  assert.deepEqual(writes, [])
  await mkdir('test-results', { recursive: true })
  await writeFile('test-results/crm-dates.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  await context.close()
} finally {
  await browser.close()
}
