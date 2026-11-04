import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4192'
const browser = await chromium.launch({ headless: true })
const report = { base, synthetic_api: true, checks: [] }
const entry = (id, kind, name, data = {}) => ({ id, kind, name, data, archived: false, version: 1,
  source_created_at: '2026-11-04T09:00:00+00:00', source_created_at_kind: 'local', effective_owner_id: 6,
  updated_at: '2026-11-04T09:00:00+00:00' })

async function setup(level = 'edit', selected = null) {
  const context = await browser.newContext({ viewport: { width: 1540, height: 1000 } })
  await context.addInitScript(() => localStorage.setItem('soborbum.auth.token', 'synthetic-spam-token'))
  const page = await context.newPage(), writes = [], reads = [], errors = []
  page.setDefaultTimeout(12000)
  page.on('pageerror', error => errors.push(error.message))
  const pipelines = [entry(1, 'pipeline', 'Допродажная воронка')]
  const stages = [entry(10, 'stage', 'Новая заявка', { pipeline_id: 1, sort: 1, outcome: 'open', color: '#93c5fd' })]
  const hidden = entry(1000, 'deal', 'Связанная сделка', { pipeline_id: 1, stage_id: 10, is_unsorted: true, amount: 100, responsible_user_id: 6 })
  const regular = entry(2000, 'deal', 'Обычная сделка', { pipeline_id: 1, stage_id: 10, amount: 400, responsible_user_id: 6 })
  const inquiry = entry(1010, 'inquiry', 'Заявка проверки', { pipeline_id: 1, deal_id: hidden.id, contact_name: 'Заявка проверки', is_spam: false })
  const flagged = entry(1011, 'inquiry', 'Ранее помеченная заявка', { pipeline_id: 1, contact_name: 'Ранее помеченная заявка', is_spam: true })
  const accepted = entry(1012, 'inquiry', 'Принятая заявка', { pipeline_id: 1, accepted_deal_id: regular.id, is_spam: false })
  accepted.archived = true
  const records = [hidden, regular, inquiry, flagged, accepted]
  const histories = new Map(records.map(record => [record.id, []]))
  const state = { conflict: false }
  const candidates = (kind, params) => records.filter(record => {
    const spam = params.get('spam') || 'normal'
    if (record.kind !== kind || (kind === 'deal' && (record.data.is_unsorted || spam === 'spam'))) return false
    const archive = params.get('archive') || 'active'
    if (archive !== 'all' && record.archived !== (archive === 'archived')) return false
    if (kind === 'inquiry' && spam !== 'all' && Boolean(record.data.is_spam) !== (spam === 'spam')) return false
    if (params.has('owner_id') && record.effective_owner_id !== Number(params.get('owner_id'))) return false
    if (params.get('pipeline_id') && record.data.pipeline_id !== Number(params.get('pipeline_id'))) return false
    if (params.get('stage_id') && record.data.stage_id !== Number(params.get('stage_id'))) return false
    if (params.get('date_unknown') === 'true') return !record.source_created_at
    const timestamp = Date.parse(record.source_created_at)
    if (params.get('date_from') && timestamp < Date.parse(params.get('date_from') + 'T00:00:00+03:00')) return false
    if (params.get('date_to') && timestamp >= Date.parse(params.get('date_to') + 'T00:00:00+03:00') + 86400000) return false
    return true
  }).sort((left, right) => right.id - left.id)
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    let body = [], status = 200
    if (request.method() === 'PATCH') {
      const payload = request.postDataJSON()
      writes.push({ path, payload })
      assert.equal(path, '/api/crm/entries/1010')
      assert.deepEqual(Object.keys(payload).sort(), ['data', 'version'])
      assert.deepEqual(Object.keys(payload.data), ['is_spam'])
      if (state.conflict || payload.version !== inquiry.version) {
        state.conflict = false; status = 409; body = { detail: 'Запись уже изменена. Обновите карточку.' }
      } else {
        const before = structuredClone(inquiry.data)
        inquiry.data = { ...inquiry.data, is_spam: payload.data.is_spam }
        inquiry.version++
        histories.get(inquiry.id).unshift({ id: 'local-' + inquiry.version, source: 'soborum', created_at: '2026-11-04T09:01:00Z', text: 'Карточка изменена',
          details: { before: { data: before }, after: { payload: structuredClone(inquiry.data) } } })
        body = inquiry
      }
    } else {
      assert.equal(request.method(), 'GET', 'No archive, delete, acceptance or bulk write is allowed in this test')
      reads.push(path + url.search)
      if (path === '/api/auth/me') body = { id: 6, full_name: 'Synthetic manager', role: 'worker', job_role: 'manager', is_active: true, module_access: { clients: level, tasks: 'view' } }
      else if (path === '/api/crm/catalog') body = { pipelines, stages, users: [{ id: 6, name: 'Synthetic manager' }], counts: { deal: 1, inquiry: candidates('inquiry', new URLSearchParams()).length, task: 0, company: 0, contact: 0 } }
      else if (path === '/api/crm/entries') {
        const filtered = candidates(url.searchParams.get('kind'), url.searchParams)
        const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 50)
        body = { total: filtered.length, items: filtered.slice(offset, offset + limit) }
      } else if (path === '/api/crm/kanban-summary') {
        const cards = [...candidates('deal', url.searchParams), ...candidates('inquiry', url.searchParams).filter(record => !record.data.accepted_deal_id)]
        const budgets = cards.map(record => record.kind === 'inquiry' ? records.find(candidate => candidate.id === record.data.deal_id)?.data.amount || 0 : record.data.amount || 0)
        const sum = budgets.reduce((total, amount) => total + amount, 0)
        body = { columns: [{ pipeline_id: 1, stage_id: 10, count: cards.length, amounts: sum ? { RUB: sum } : {}, unpriced_count: budgets.filter(amount => !amount).length }], unmapped_count: 0 }
      } else if (/\/history$/.test(path)) body = { total: histories.get(Number(path.split('/')[4])).length, items: histories.get(Number(path.split('/')[4])) }
      else if (/\/files$/.test(path)) body = { total: 0, items: [] }
      else if (/^\/api\/crm\/entries\/\d+$/.test(path)) body = records.find(record => path.endsWith('/' + record.id))
      else if (path === '/api/crm/attention') body = { total: 0, items: [], counts: {}, settings: {} }
      else if (path === '/api/notifications/unread-count') body = { unread_count: 0 }
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(base + '/crm?pipeline=1&view=board' + (selected ? '&entry=' + selected : ''))
  return { context, page, writes, reads, errors, state, inquiry, hidden, regular, histories }
}

try {
  const test = await setup(), { page } = test
  const column = page.locator('[data-stage-id="10"]')
  await column.locator('[data-column-total="2"]').waitFor()
  assert.equal(await page.locator('[data-inquiry-id="1011"]').count(), 0)
  await column.locator('[data-stage-budget]').getByText('500 ₽', { exact: true }).waitFor()
  await page.locator('[data-inquiry-id="1010"]').getByRole('button', { name: 'Заявка проверки', exact: true }).click()
  await page.getByRole('button', { name: 'Пометить как спам', exact: true }).click()
  await page.getByRole('button', { name: 'Убрать отметку «Спам»', exact: true }).waitFor()
  await column.locator('[data-column-total="1"]').waitFor()
  await column.locator('[data-stage-budget]').getByText('400 ₽', { exact: true }).waitFor()
  assert.equal(await page.locator('[data-inquiry-id="1010"]').count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Взять в работу', exact: true }).count(), 0)
  await page.getByRole('region', { name: 'История работы с клиентом', exact: true }).getByText('Спам', { exact: true }).waitFor()
  assert.deepEqual(test.writes[0].payload, { version: 1, data: { is_spam: true } })
  await page.getByRole('button', { name: 'Убрать отметку «Спам»', exact: true }).click()
  await page.getByRole('button', { name: 'Пометить как спам', exact: true }).waitFor()
  await column.locator('[data-column-total="2"]').waitFor()
  assert.deepEqual(test.writes[1].payload, { version: 2, data: { is_spam: false } })
  assert.equal(test.inquiry.archived, false)
  assert.equal(test.hidden.data.is_unsorted, true)
  assert.equal(test.hidden.data.amount, 100)
  assert.equal(test.regular.data.amount, 400)
  report.checks.push('explicit versioned mark removes only pending inquiry from default cards/count/budget; undo restores it with history and linked data intact')
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click()

  await page.getByLabel('Фильтр спама').selectOption('spam')
  await column.locator('[data-column-total="1"]').waitFor()
  await page.locator('[data-inquiry-id="1011"]').waitFor()
  assert.equal(await page.locator('[data-deal-id]').count(), 0)
  assert.equal(await page.locator('[data-inquiry-id="1011"]').getAttribute('draggable'), 'false')
  await page.getByLabel('Фильтр спама').selectOption('all')
  await column.locator('[data-column-total="3"]').waitFor()
  assert.equal(await page.locator('[data-deal-id="2000"]').count(), 1)
  await page.getByLabel('Дата заявки с', { exact: true }).fill('2026-11-04')
  await page.getByLabel('Дата заявки по', { exact: true }).fill('2026-11-04')
  const combined = page.waitForResponse(response => {
    const url = new URL(response.url())
    return url.pathname.endsWith('/kanban-summary') && url.searchParams.get('spam') === 'all' && url.searchParams.get('owner_id') === '6' && url.searchParams.get('date_to') === '2026-11-04'
  })
  await page.getByLabel('Фильтр по ответственному').selectOption('6')
  await combined
  await column.locator('[data-column-total="3"]').waitFor()
  assert.ok(test.reads.some(path => path.includes('kind=inquiry') && path.includes('spam=all') && path.includes('date_to=2026-11-04') && path.includes('owner_id=6')))
  report.checks.push('normal/spam/all filters preserve date and owner scope; spam-only shows no ordinary deal or acceptance/drag action')

  await page.getByLabel('Фильтр спама').selectOption('normal')
  await column.locator('[data-column-total="2"]').waitFor()
  await page.locator('[data-inquiry-id="1010"]').getByRole('button', { name: 'Заявка проверки', exact: true }).click()
  test.state.conflict = true
  await page.getByRole('button', { name: 'Пометить как спам', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'Запись уже изменена' }).waitFor()
  assert.equal(test.inquiry.data.is_spam, false)
  await page.getByRole('button', { name: 'Обновить карточку', exact: true }).click()
  await page.getByRole('button', { name: 'Пометить как спам', exact: true }).click()
  await page.getByRole('button', { name: 'Убрать отметку «Спам»', exact: true }).click()
  await page.getByRole('button', { name: 'Пометить как спам', exact: true }).waitFor()
  await column.locator('[data-column-total="2"]').waitFor()
  assert.equal(test.inquiry.data.is_spam, false)
  assert.equal(test.writes.length, 5)
  assert.equal(test.histories.get(1010).length, 4)
  assert.deepEqual(test.errors, [])
  await test.context.close()
  report.checks.push('409 leaves original state and requires explicit refresh/retry; no automatic archive/delete/acceptance/bulk writes')

  for (const [level, selected] of [['view', 1010], ['edit', 1012], ['edit', 2000]]) {
    const restricted = await setup(level, selected)
    await restricted.page.getByRole('button', { name: 'Закрыть', exact: true }).waitFor()
    await restricted.page.getByRole('region', { name: 'История работы с клиентом', exact: true }).waitFor()
    await restricted.page.waitForFunction(() => ![...document.querySelectorAll('[role="status"]')].some(node => node.textContent.includes('Загрузка карточки')))
    assert.equal(await restricted.page.getByRole('button', { name: 'Пометить как спам', exact: true }).count(), 0)
    assert.equal(await restricted.page.getByRole('button', { name: 'Убрать отметку «Спам»', exact: true }).count(), 0)
    assert.deepEqual(restricted.writes, [])
    assert.deepEqual(restricted.errors, [])
    await restricted.context.close()
  }
  report.checks.push('read-only, accepted inquiry and ordinary deal cards expose no spam mutation')
  await mkdir('test-results', { recursive: true })
  await writeFile('test-results/crm-spam.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally {
  await browser.close()
}
