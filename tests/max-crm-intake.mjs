import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5182'
const artifacts = process.env.COMMUNICATIONS_ARTIFACTS || 'test-results/max-crm'
await mkdir(artifacts, { recursive: true })
const browser = await chromium.launch({ headless: true })
const report = { synthetic_api: true, real_messages: 0, checks: [] }
const entry = (id, kind, name, data = {}) => ({ id, kind, name, data, version: 1, archived: false })
const contact = entry(12, 'contact', 'Анна', { phone: '+79000000000' })
const deal = entry(11, 'deal', 'Заявка Анны', { contact_ids: [12], pipeline_id: 1, stage_id: 2, responsible_user_id: 6 })
const message = (id, text, more = {}) => ({ id, text, time: 1794220000000, isOutgoing: false, senderName: 'Анна', isSystem: false, attaches: [], ...more })
const photo = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="green"/></svg>').toString('base64')

async function scenario({ mobile = false, linked = false } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1366, height: 950 }, serviceWorkers: 'block' })
  await context.addInitScript(() => {
    localStorage.setItem('soborbum.auth.token', 'synthetic-max-crm')
    for (const key of ['crm', 'chats', 'notifications']) localStorage.setItem('soborbum.onboarding.' + key, '1')
    window.WebSocket = class { static OPEN = 1; readyState = 1; constructor() { window.maxTestSocket = this } close() {} send() {} }
  })
  const page = await context.newPage(), writes = [], errors = []
  page.setDefaultTimeout(12000)
  page.on('pageerror', e => errors.push(e.message))
  const state = { linked, sent: false, live: false, starts: 0, attachment: false }
  const notification = { id: 1, kind: 'max_message', title: 'Новый клиент написал в MAX', body: 'Анна. Создайте лид или привяжите диалог.', object_type: 'max_unlinked_chat', object_id: 123, created_at: '2026-11-09T09:00:00Z', read_at: null }
  const history = () => ({ chatId: 123, title: 'Анна MAX', isGroup: false, peer: { contactId: '1', name: 'Анна', phone: '+79000000000' }, count: 3,
    messages: [message('1', 'Пришлите расчёт'), message('2', '', { attaches: [{ type: 'PHOTO', baseUrl: photo, name: 'Эскиз клиента' }] }),
      message('3', '', { attaches: [{ type: 'FILE', fileId: '91', name: 'План.pdf', size: 1024 }] }),
      ...(state.live ? [message('4', 'Ещё нужен фундамент')] : []), ...(state.sent ? [message('5', 'Расчёт готов', { isOutgoing: true })] : []),
      ...(state.attachment ? [message('6', '', { isOutgoing: true, attaches: [{ type: 'FILE', name: 'Расчёт.txt', fileId: '100' }] })] : [])] })
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname
    if (req.method() !== 'GET') writes.push({ path, body: req.postData()?.startsWith('{') ? req.postDataJSON() : null })
    let body = []
    if (path === '/api/auth/me') body = { id: 6, full_name: 'Менеджер', email: 'manager@example.invalid', role: 'worker', job_role: 'manager', is_active: true, module_access: { clients: 'edit', tasks: 'edit' } }
    else if (path === '/api/notifications/') body = [notification]
    else if (path === '/api/notifications/1/read') body = { ...notification, read_at: new Date().toISOString() }
    else if (path === '/api/notifications/unread-count') body = { unread_count: state.linked ? 0 : 1 }
    else if (path === '/api/max/chats') body = { count: 1, chats: [{ id: 123, title: 'Анна MAX', unread: 1, lastEventTime: 1794220000000, lastMessage: message('1', 'Пришлите расчёт'), phone: '+79000000000', linkedCrmId: state.linked ? 11 : null, linkedCrmKind: 'deal', linkedCrmName: deal.name }] }
    else if (path === '/api/max/chats/123') body = history()
    else if (path === '/api/crm/catalog') body = { pipelines: [entry(1, 'pipeline', 'Продажи')], stages: [entry(2, 'stage', 'Новые заявки', { pipeline_id: 1, outcome: 'open' })], users: [{ id: 6, name: 'Менеджер' }], counts: {} }
    else if (path === '/api/crm/entries') {
      const items = url.searchParams.get('kind') === 'contact' ? [contact] : url.searchParams.get('kind') === 'deal' ? [deal] : []
      body = { total: items.length, items }
    }
    else if (path === '/api/crm/entries/11') body = deal
    else if (path === '/api/crm/entries/12') body = contact
    else if (path === '/api/crm/chat-links/unlinked/123') body = { name: 'Анна', phone: '+79000000000', suggested: { id: 11, kind: 'deal', name: deal.name } }
    else if (path === '/api/crm/chat-links/by-chat/123') body = state.linked ? { entity_id: 11, entity_kind: 'deal', entity_name: deal.name, max_chat_id: 123, entity_version: 1 } : null
    else if (path === '/api/crm/chat-links/from-max') { state.linked = true; body = { entity_id: 11, entity_kind: 'deal', entity_name: deal.name, max_chat_id: 123 } }
    else if (path === '/api/crm/entries/11/chats') body = { items: state.linked ? [{ key: 'crm:1', chat_id: 123, label: 'Анна MAX', owner_id: 11, can_unlink: true }] : [] }
    else if (path === '/api/crm/entries/11/chat-phones') body = { items: [{ phone: '+79000000000', name: 'Анна' }] }
    else if (path === '/api/crm/entries/11/chats/start') { state.starts++; state.linked = true; body = { chatId: 123, name: 'Анна MAX' } }
    else if (path === '/api/crm/entries/11/chats/123/messages') {
      if (req.method() === 'POST') { state.sent = true; body = { message: message('5', 'Расчёт готов', { isOutgoing: true }) } }
      else body = history()
    } else if (path.endsWith('/messages/attachment')) { state.attachment = true; body = { message: message('6', '', { isOutgoing: true, attaches: [{ type: 'FILE', name: 'Расчёт.txt', fileId: '100' }] }) } }
    else if (/\/(history|files)$/.test(path) || path === '/api/crm/calls') body = { total: 0, items: [] }
    else if (path === '/api/crm/kanban-summary') body = { columns: [], unmapped_count: 0 }
    else if (path === '/api/costing/context') body = { estimates: [], templates: [], links: [], order_lines: null, can_import_recipe: false }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
  return { context, page, writes, errors, state }
}

try {
  for (const mobile of [false, true]) {
    const t = await scenario({ mobile })
    await t.page.goto(base + '/notifications')
    await t.page.getByText('Новый клиент написал в MAX', { exact: true }).click()
    await t.page.getByText('Пришлите расчёт', { exact: true }).last().waitFor()
    assert.equal(await t.page.getByRole('button', { name: 'Отправить', exact: true }).count(), 0)
    assert.equal(await t.page.getByPlaceholder('Сообщение…', { exact: true }).count(), 0)
    if (!mobile) {
      await t.page.getByRole('button', { name: 'Привязать к клиенту', exact: true }).click()
      await t.page.getByRole('button', { name: 'Привязать к найденной карточке', exact: true }).click()
    } else {
      await t.page.getByRole('button', { name: 'Создать новый лид', exact: true }).click()
      await t.page.getByRole('button', { name: 'Создать и привязать', exact: true }).click()
    }
    const card = t.page.getByRole('dialog', { name: deal.name, exact: true })
    const panel = card.getByRole('region', { name: 'Связь с клиентом', exact: true })
    await panel.getByText('Пришлите расчёт', { exact: true }).waitFor()
    const link = t.writes.find(w => w.path.endsWith('/from-max')).body
    assert.ok(mobile ? link.create.kind === 'deal' : link.entity_id === 11)
    await panel.getByRole('img', { name: 'Эскиз клиента', exact: true }).waitFor()
    await panel.getByRole('button', { name: /План.pdf/ }).waitFor()
    assert.equal(t.writes.filter(w => /\/messages/.test(w.path)).length, 0)
    t.state.live = true
    await t.page.evaluate(() => window.maxTestSocket.onmessage({ data: JSON.stringify({ type: 'chat_updated', chatId: 123 }) }))
    await panel.getByText('Ещё нужен фундамент', { exact: true }).waitFor()
    await panel.getByRole('textbox', { name: 'Сообщение клиенту в MAX', exact: true }).fill('Расчёт готов')
    await panel.getByRole('button', { name: 'Отправить в MAX', exact: true }).click()
    await panel.getByText('Расчёт готов', { exact: true }).waitFor()
    assert.equal(t.writes.filter(w => /\/messages$/.test(w.path)).length, 1)
    assert.ok(t.writes.every(w => !w.path.startsWith('/api/max/')))
    assert.deepEqual(t.errors, [])
    assert.ok(await t.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await t.page.screenshot({ path: `${artifacts}/${mobile ? 'mobile' : 'desktop'}.png` })
    report.checks.push(`${mobile ? 'mobile' : 'desktop'}: notification → choice → card with inline media, live update, scoped reply`)
    await t.context.close()
  }
  const t = await scenario()
  await t.page.goto(base + '/crm?tab=deal&entry=11')
  const card = t.page.getByRole('dialog', { name: deal.name, exact: true })
  await card.getByRole('button', { name: 'Действия с номером +79000000000', exact: true }).first().click()
  await t.page.getByRole('button', { name: 'Написать в MAX', exact: true }).click()
  const panel = card.getByRole('region', { name: 'Связь с клиентом', exact: true })
  await panel.getByRole('button', { name: 'Написать первым в MAX', exact: true }).click()
  await panel.getByRole('button', { name: 'Найти и открыть диалог', exact: true }).click()
  await panel.getByText('Пришлите расчёт', { exact: true }).waitFor()
  assert.equal(t.state.starts, 1)
  assert.equal(t.writes.filter(w => /messages/.test(w.path)).length, 0)
  await panel.locator('input[type=file]').setInputFiles({ name: 'Расчёт.txt', mimeType: 'text/plain', buffer: Buffer.from('Quote') })
  await panel.getByRole('button', { name: 'Отправить в MAX', exact: true }).click()
  await panel.getByRole('button', { name: /Расчёт.txt/ }).waitFor()
  assert.equal(t.writes.filter(w => w.path.endsWith('/messages/attachment')).length, 1)
  assert.deepEqual(t.errors, [])
  report.checks.push('phone action opens same card; first-contact lookup does not send; attachment uses card endpoint')
  await t.context.close()
  report.ok = true
  await writeFile(artifacts + '/report.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
} finally { await browser.close() }
