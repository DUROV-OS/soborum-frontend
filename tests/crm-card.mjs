import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4192'
const browser = await chromium.launch({ headless: true })
const report = { base, synthetic_api: true, checks: [] }
const entry = (id, kind, name, data = {}, version = 1) => ({ id, kind, name, data, version, archived: false, updated_at: '2026-11-04T09:00:00Z' })
const event = (id, text, details = {}, source = 'soborum', day = 4) => ({ id, text, details, source, created_at: `2026-11-0${day}T09:00:00Z` })

async function setup({ mobile = false, level = 'full', selected = 101, malformed = false } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1540, height: 1000 } })
  await context.addInitScript(() => localStorage.setItem('soborbum.auth.token', 'synthetic-token'))
  const page = await context.newPage(), errors = [], writes = [], reads = []
  page.setDefaultTimeout(15000)
  page.on('pageerror', error => errors.push(error.message))
  const pipelines = [entry(1, 'pipeline', 'Допродажная воронка')]
  const stages = [entry(10, 'stage', 'Новая заявка', { pipeline_id: 1, sort: 1, outcome: 'open', color: '#93c5fd' }), entry(11, 'stage', 'Взята в работу', { pipeline_id: 1, sort: 2, outcome: 'open', color: '#c4b5fd' }), entry(12, 'stage', 'Отказ', { pipeline_id: 1, sort: 3, outcome: 'lost', color: '#fca5a5' })]
  const records = new Map([
    entry(100, 'deal', 'Связанная сделка', { pipeline_id: 1, stage_id: 10, amount: 3450000, currency: 'RUB', responsible_user_id: 6, contact_ids: [201], company_id: 301, is_unsorted: true, custom_fields: [{ field_id: 99, field_name: 'Площадь дома', values: [{ value: 120 }] }] }, 7),
    entry(101, 'inquiry', 'Заявка из формы', { pipeline_id: 1, deal_id: 100, source_name: 'Сайт Durov House', contact_name: 'Ирина Тестовая', phone: '+7 900 111-22-33', email: 'test@example.test' }, 3),
    entry(102, 'deal', 'Активная сделка', { pipeline_id: 1, stage_id: 10, amount: 5000000, currency: 'RUB', responsible_user_id: 6, contact_ids: [201], company_id: 301, is_unsorted: false }, 4),
    entry(201, 'contact', 'Ирина Тестовая', { phone: '+7 900 111-22-33', email: 'test@example.test', company_id: 301, custom_fields: [{ field_name: 'Город', values: [{ value: 'Тула' }] }] }),
    entry(301, 'company', 'Тестовая компания', { phone: '+7 495 222-33-44', custom_fields: [{ field_name: 'ИНН', values: [{ value: '0000000000' }] }] }),
    entry(999, 'task', 'Связаться с Ириной', { entity_id: 100, responsible_user_id: 6, due_at: '2026-11-05T10:00:00Z', completed: false, description: 'Обсудить проект', task_type: 'Звонок' }, 5),
  ].map(item => [item.id, item]))
  if (malformed) {
    for (const [id, label] of [[100, 'Поле входящей сделки'], [102, 'Поле активной сделки'], [201, 'Поле контакта']]) {
      records.get(id).data.custom_fields = [null, {}, { field_name: label, values: [null, { value: 'Сохранённое значение' }] }]
    }
    records.get(301).data.custom_fields = null
  }
  const allTasks = [...Array.from({ length: 101 }, (_, index) => entry(2000 + index, 'task', `Другая задача ${index}`, { entity_id: 99999, completed: false })), records.get(999)]
  const history = new Map([
    [101, [event('website-1', 'Заявка с сайта', { client_id: 1 })]],
    [100, [event('amo-call', 'Входящий звонок', { note_type: 'call_in', params: { phone: '+7 900 111-22-33', duration: 87, call_result: 'Договорились о встрече' } }, 'amocrm'), event('amo-note', 'Старое примечание', { note_type: 'common', params: { text: 'Старое примечание' } }, 'amocrm', 3), event('amo-mail', 'Письмо: Проект дома', { note_type: 'amomail_message', params: { subject: 'Проект дома', from: 'sales@example.test', content_summary: '<b>Планировка согласована</b><script>window.untrusted = true</script>' } }, 'amocrm', 2), event('local-change', 'Карточка изменена', { before: { data: { amount: 3000000, stage_id: 10 } }, after: { payload: { amount: 3450000, stage_id: 11 } } }, 'soborum', 1)]],
    [102, []],
  ])
  const state = { failNext: 0, delayHistory: 0 }
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method()
    let body = [], status = 200
    if (method === 'GET') reads.push(path + url.search)
    if (method === 'POST' && /\/notes$/.test(path)) {
      const input = request.postDataJSON(), selectedId = +path.split('/')[4]
      writes.push({ method, path, input })
      const saved = event(`local-note-${writes.length}`, input.text, { text: input.text })
      history.set(selectedId, [saved, ...(history.get(selectedId) || [])]); body = { id: saved.id, text: input.text }
    } else if (method === 'PATCH') {
      const input = request.postDataJSON(), saved = records.get(+path.split('/')[4])
      writes.push({ method, path, input })
      if (state.failNext) { status = state.failNext; state.failNext = 0; body = { detail: 'Запись уже изменена другим сотрудником' } }
      else if (!saved || saved.version !== input.version) { status = 409; body = { detail: 'Неверная версия' } }
      else { saved.data = { ...saved.data, ...input.data }; if ('archived' in input) saved.archived = input.archived; saved.version++; body = saved }
    } else if (!['GET', 'HEAD'].includes(method)) throw new Error(`Unexpected write ${method} ${path}`)
    if (method === 'GET') {
      if (path === '/api/auth/me') body = { id: 6, full_name: 'Гостев Денис', role: 'worker', job_role: 'manager', is_active: true, module_access: { clients: level, tasks: 'edit', ai: 'view' } }
      else if (path === '/api/crm/catalog') body = { pipelines, stages, users: [{ id: 6, name: 'Гостев Денис' }], counts: { deal: 1, inquiry: 1, contact: 1, company: 1, task: allTasks.length } }
      else if (path === '/api/crm/kanban-summary') body = { columns: stages.map(stage => ({ pipeline_id: 1, stage_id: stage.id, count: stage.id === 10 ? 1 : 0, amounts: {}, unpriced_count: 0 })), unmapped_count: 0 }
      else if (/^\/api\/crm\/entries\/\d+$/.test(path)) body = records.get(+path.split('/')[4]) || null
      else if (/\/history$/.test(path)) { const list = history.get(+path.split('/')[4]) || [], offset = +(url.searchParams.get('offset') || 0); body = { total: list.length, items: list.slice(offset, offset + 2) } }
      else if (/\/files$/.test(path)) { const list = +path.split('/')[4] === 100 ? [{ id: 501, name: 'Планировка.pdf', size: 1234 }, { id: 502, name: 'Смета.pdf', size: 4567 }] : [], offset = +(url.searchParams.get('offset') || 0); body = { total: list.length, items: list.slice(offset, offset + 1) } }
      else if (path === '/api/crm/entries') {
        const p = url.searchParams, kind = p.get('kind'), offset = +(p.get('offset') || 0), limit = +(p.get('limit') || 50)
        const items = kind === 'task' ? allTasks : [...records.values()].filter(item => item.kind === kind && !item.archived && (!p.get('stage_id') || item.data.stage_id === +p.get('stage_id')) && (kind !== 'deal' || !item.data.is_unsorted))
        body = { total: items.length, items: items.slice(offset, offset + limit) }
      } else if (path === '/api/notifications/unread-count') body = { unread_count: 0 }
      else if (path === '/api/crm/attention') body = { total: 0, items: [], counts: {}, settings: { response_hours: 24, idle_days: 3 } }
      else if (path === '/api/costing/context') body = { estimates: [], templates: [], links: [], order_lines: null, can_import_recipe: false }
      else if (path === '/api/crm/agency-sources') body = { total: 0, items: [], configured: false }
    }
    if (/\/history$/.test(path) && url.searchParams.get('offset') === '2' && state.delayHistory) {
      const delay = state.delayHistory; state.delayHistory = 0
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(`${base}/crm?entry=${selected}`)
  const dialog = page.getByRole('dialog', { name: records.get(selected).name, exact: true })
  await dialog.waitFor()
  await dialog.getByRole('status').waitFor({ state: 'detached' })
  return { page, context, dialog, errors, writes, reads, records, state }
}

try {
  await mkdir('test-results', { recursive: true })
  const t = await setup(), { page, dialog } = t
  await dialog.getByText('87 сек.', { exact: true }).waitFor()
  await dialog.getByRole('button', { name: 'Ирина Тестовая', exact: true }).waitFor()
  await dialog.getByRole('button', { name: 'Тестовая компания', exact: true }).waitFor()
  await dialog.getByText('Площадь дома', { exact: true }).waitFor()
  await dialog.getByText('Связаться с Ириной', { exact: true }).waitFor()
  assert.ok(t.reads.includes('/api/crm/entries?kind=task&archive=active&limit=100&offset=100'))
  assert.equal(t.writes.length, 0)
  assert.equal(await dialog.getByLabel('Этап сделки').count(), 0)
  assert.ok(await dialog.getByRole('button', { name: 'Взять в работу', exact: true }).isEnabled())
  report.checks.push('inquiry preserves identity; linked hidden deal history, contacts, company, custom fields, files and page-2 task are loaded without accepting')
  await dialog.getByRole('button', { name: 'Загрузить ещё файлы', exact: true }).click()
  await dialog.getByRole('button', { name: /Смета.pdf/ }).waitFor()
  await dialog.getByRole('button', { name: /Загрузить ещё события/ }).click()
  await dialog.getByRole('button', { name: 'Письма', exact: true }).click()
  await dialog.getByText('Планировка согласована', { exact: true }).waitFor()
  assert.equal(await page.evaluate(() => window.untrusted), undefined)
  assert.equal(await dialog.locator('script').count(), 0)
  await dialog.getByRole('button', { name: 'Изменения', exact: true }).click()
  await dialog.getByText('3000000', { exact: true }).waitFor()
  await dialog.getByText('3450000', { exact: true }).waitFor()
  await dialog.getByRole('button', { name: 'Все', exact: true }).click()
  assert.ok(t.reads.includes('/api/crm/entries/100/history?offset=2'))
  assert.ok(t.reads.includes('/api/crm/entries/100/files?offset=1'))
  report.checks.push('per-entity history/file pagination; mail rendered as plain text; before/after field changes and event filters')
  await dialog.getByLabel('Текст заметки').fill('Договорились о следующем звонке')
  await dialog.getByRole('button', { name: 'Сохранить заметку', exact: true }).click()
  await dialog.getByText('Договорились о следующем звонке', { exact: true }).waitFor()
  assert.equal(t.writes.at(-1).path, '/api/crm/entries/101/notes')
  const complete = dialog.getByRole('button', { name: 'Завершить', exact: true })
  assert.equal(await complete.isDisabled(), true)
  await dialog.getByLabel('Результат задачи Связаться с Ириной').fill('Клиент согласовал встречу')
  await complete.click()
  await dialog.getByText('Открытых задач нет', { exact: true }).waitFor()
  assert.deepEqual(t.writes.at(-1), { method: 'PATCH', path: '/api/crm/entries/999', input: { version: 5, data: { completed: true, result: 'Клиент согласовал встречу' } } })
  assert.equal(t.records.get(100).version, 7)
  assert.equal(t.records.get(101).version, 3)
  report.checks.push('internal note writes inquiry ID; task result required and version checked; no implicit inquiry or deal changes')
  await page.screenshot({ path: 'test-results/crm-card-desktop.png', fullPage: true })
  assert.deepEqual(t.errors, []); await t.context.close()

  const d = await setup({ selected: 102 })
  await d.dialog.getByLabel('Этап сделки').selectOption('12')
  assert.equal(await d.dialog.getByRole('button', { name: 'Сохранить этап', exact: true }).isDisabled(), true)
  await d.dialog.getByLabel('Причина отказа').fill('Отложили строительство')
  d.state.failNext = 409
  await d.dialog.getByRole('button', { name: 'Сохранить этап', exact: true }).click()
  await d.dialog.getByRole('alert').getByText('Запись уже изменена другим сотрудником').waitFor()
  assert.equal(d.records.get(102).data.stage_id, 10)
  await d.dialog.getByRole('button', { name: 'Сохранить этап', exact: true }).click()
  await d.dialog.getByRole('button', { name: 'Сохранить этап', exact: true }).waitFor({ state: 'detached' })
  assert.deepEqual(d.writes.at(-1).input, { version: 4, data: { pipeline_id: 1, stage_id: 12, loss_reason: 'Отложили строительство' } })
  assert.equal(d.records.get(102).version, 5)
  await d.dialog.getByRole('button', { name: 'В архив', exact: true }).click()
  await d.dialog.getByRole('button', { name: 'Вернуть из архива', exact: true }).waitFor()
  assert.deepEqual(d.writes.at(-1).input, { version: 5, archived: true })
  assert.equal(d.records.get(102).archived, true)
  report.checks.push('deal stage change requires loss reason, sends current version, keeps form on 409, refreshes only on success')
  assert.deepEqual(d.errors, []); await d.context.close()

  const r = await setup()
  r.state.delayHistory = 400
  const lateHistory = r.page.waitForResponse(response => response.url().endsWith('/api/crm/entries/100/history?offset=2'))
  await r.dialog.getByRole('button', { name: /Загрузить ещё события/ }).click()
  await r.dialog.getByRole('button', { name: 'Ирина Тестовая', exact: true }).click()
  const contactDialog = r.page.getByRole('dialog', { name: 'Ирина Тестовая', exact: true })
  await contactDialog.getByText('История пока пуста', { exact: true }).waitFor()
  await lateHistory
  assert.equal(await contactDialog.getByText('Проект дома', { exact: true }).count(), 0)
  assert.equal(await contactDialog.getByText('Планировка согласована', { exact: true }).count(), 0)
  assert.deepEqual(r.errors, []); await r.context.close()
  report.checks.push('archive uses latest version; late history response cannot replace the next opened contact')

  const m = await setup({ mobile: true, level: 'view' })
  assert.ok(await m.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  assert.equal(await m.dialog.getByRole('button', { name: 'Взять в работу', exact: true }).count(), 0)
  assert.equal(await m.dialog.getByRole('button', { name: 'В архив', exact: true }).count(), 0)
  await m.page.screenshot({ path: 'test-results/crm-card-mobile-data.png', fullPage: true })
  await m.dialog.getByRole('tab', { name: 'История', exact: true }).click()
  await m.dialog.getByText('87 сек.', { exact: true }).waitFor()
  assert.ok(await m.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  assert.equal(await m.dialog.getByLabel('Текст заметки').count(), 0)
  await m.page.screenshot({ path: 'test-results/crm-card-mobile-history.png', fullPage: true })
  assert.equal(m.writes.length, 0)
  for (const session of [t, d, r, m]) assert.equal(session.reads.some(path => /^\/api\/(clients|production|warehouse|accounting|moysklad)/.test(path)), false)
  assert.deepEqual(m.errors, []); await m.context.close()
  report.checks.push('mobile data/history tabs fit 390px; view-only cannot write; no ERP/cost API access')

  const imported = await setup({ malformed: true })
  await imported.dialog.getByText('Поле входящей сделки', { exact: true }).waitFor()
  await imported.dialog.getByRole('button', { name: 'Ирина Тестовая', exact: true }).click()
  const importedContact = imported.page.getByRole('dialog', { name: 'Ирина Тестовая', exact: true })
  await importedContact.getByText('Поле контакта', { exact: true }).waitFor()
  await importedContact.getByText('—, Сохранённое значение', { exact: true }).waitFor()
  assert.equal(new URL(imported.page.url()).pathname, '/crm')
  assert.equal(await imported.page.evaluate(() => localStorage.getItem('soborbum.auth.token')), 'synthetic-token')
  assert.deepEqual(imported.errors, []); assert.deepEqual(imported.writes, [])
  await imported.context.close()
  const importedDeal = await setup({ selected: 102, malformed: true })
  await importedDeal.dialog.getByText('Поле активной сделки', { exact: true }).waitFor()
  await importedDeal.dialog.getByLabel('Этап сделки').waitFor()
  assert.deepEqual(importedDeal.errors, []); assert.deepEqual(importedDeal.writes, [])
  await importedDeal.context.close()
  report.checks.push('null custom-field records and values survive inquiry-to-contact navigation and direct active-deal opening; hidden legacy drawer cannot crash the CRM page')
  await writeFile('test-results/crm-card.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally { await browser.close() }
