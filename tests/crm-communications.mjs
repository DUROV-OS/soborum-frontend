import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4198'
const artifacts = process.env.COMMUNICATIONS_ARTIFACTS || 'test-results/communications'
const browser = await chromium.launch({ headless: true })
const report = { synthetic_api: true, real_calls: 0, real_messages: 0, checks: [] }
await mkdir(artifacts, { recursive: true })
const entry = (id, kind, name, data = {}) => ({ id, kind, name, data, version: 1, archived: false })
const deal = entry(11, 'deal', 'Заявка на баню', { contact_ids: [12], pipeline_id: 1, stage_id: 2, amount: 100, responsible_user_id: 6 })
const contact = entry(12, 'contact', 'Клиент Анна', { phone: '+79000000000' })
const call = { id: 1, phone: '79000000000', direction: 'in', started_at: '2026-11-04T10:00:00Z', duration: 60, employee: '101', status: 'Success', client_id: null, crm_entity_id: 12, deal_id: null, deal_match_status: 'ambiguous', match_status: 'matched', audio_ready: false, processing: 'waiting_recording', error: '', transcript: '', segments: [], analysis: {}, reviewed_at: null }
const chat = { key: 'crm:1', chat_id: 123, label: 'Рабочий чат клиента', owner_id: 12, can_unlink: false }
const message = (id, text, isOutgoing = false) => ({ id, text, isOutgoing, time: 1793786400000, senderName: 'Анна', attaches: [] })

async function setup({ level = 'edit', mobile = false, admin = false } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, serviceWorkers: 'block' })
  await context.addInitScript(() => {
    localStorage.setItem('soborbum.auth.token', 'synthetic-communications-token')
    for (const key of ['crm', 'admin']) localStorage.setItem('soborbum.onboarding.' + key, '1')
    window.WebSocket = class { static OPEN = 1; readyState = 0; close() {} send() {} }
  })
  const page = await context.newPage(), errors = [], writes = [], requests = []
  page.setDefaultTimeout(15000)
  page.on('pageerror', e => errors.push(e.message))
  const state = { linked: false, sent: false, failSend: true, calls: 0 }
  const accounts = [
    { id: 6, full_name: 'Денис', email: 'denis@example.invalid', role: 'worker', is_active: true, module_access: { clients: 'edit' } },
    { id: 5, full_name: 'Мария', email: 'maria@example.invalid', role: 'worker', is_active: true, module_access: { clients: 'edit' } },
  ]
  let routing = { version: 1, enabled: false, main_phone: '79066773555', wait_seconds: 20, pbx_setup_confirmed: false, members: [], fallback: 'other_manager_keep_owner' }
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname
    requests.push({ method: req.method(), path })
    if (req.method() !== 'GET') writes.push({ path, body: req.postDataJSON() })
    let body = [], status = 200
    if (path === '/api/auth/me') body = { ...accounts[0], role: admin ? 'admin' : 'worker', job_role: admin ? null : 'manager', module_access: { clients: level, tasks: 'view' }, work_phone: '+79001110001' }
    else if (/^\/api\/auth\/(users|accounts)$/.test(path)) body = accounts
    else if (path === '/api/crm/catalog') body = { pipelines: [entry(1, 'pipeline', 'Продажи')], stages: [entry(2, 'stage', 'Новые заявки', { pipeline_id: 1, outcome: 'open' })], users: [{ id: 6, name: 'Денис' }], counts: {} }
    else if (path === '/api/crm/entries') body = { total: url.searchParams.get('kind') === 'deal' ? 1 : 0, items: url.searchParams.get('kind') === 'deal' ? [deal] : [] }
    else if (path === '/api/crm/entries/11') body = deal
    else if (path === '/api/crm/entries/12') body = contact
    else if (/\/(history|files)$/.test(path)) body = { total: 0, items: [] }
    else if (path === '/api/crm/kanban-summary') body = { columns: [], unmapped_count: 0 }
    else if (path === '/api/crm/calls') {
      const related = url.searchParams.get('related')
      body = { total: related ? (state.linked ? 0 : 1) : (state.linked ? 1 : 0), items: related ? (state.linked ? [] : [call]) : (state.linked ? [{ ...call, deal_id: 11, deal_match_status: 'manual' }] : []) }
    } else if (path === '/api/crm/calls/1/link') { state.linked = true; body = { ...call, deal_id: 11 } }
    else if (path === '/api/crm/entries/11/chats') body = { items: [chat] }
    else if (path === '/api/crm/entries/11/chats/123/messages') {
      if (req.method() === 'POST') {
        assert.equal(req.postDataJSON().text, 'Расчёт готов')
        await new Promise(resolve => setTimeout(resolve, 80))
        if (state.failSend) { state.failSend = false; status = 502; body = { detail: 'Не удалось подтвердить отправку в MAX. Проверьте переписку перед повтором.' } }
        else { state.sent = true; body = { message: message('sent', 'Расчёт готов', true) } }
      } else body = { chatId: 123, messages: [message('1', 'Пришлите расчёт'), ...(state.sent ? [message('sent', 'Расчёт готов', true)] : [])] }
    } else if (path === '/api/crm/communications/status') body = { megafon: { configured: true, webhook_configured: true, state: 'unchecked', can_call: !admin, extension: '101', checked_at: null }, max: { configured: true, state: 'reauth_required', checked_at: null } }
    else if (path === '/api/crm/calls/dial') { state.calls++; await new Promise(resolve => setTimeout(resolve, 80)); body = { state: 'unknown', request_id: req.postDataJSON().request_id } }
    else if (path === '/api/crm/telephony/routing') {
      if (req.method() === 'PUT') { routing = { ...req.postDataJSON(), version: routing.version + 1, fallback: 'other_manager_keep_owner' } }
      body = routing
    } else if (path === '/api/crm/communications/check') body = { checked_at: new Date().toISOString(), megafon: { state: 'unavailable' }, max: { state: 'reauth_required' } }
    else if (path === '/api/notifications/unread-count') body = { unread_count: 0 }
    else if (path === '/api/costing/context') body = { estimates: [], templates: [], links: [], order_lines: null, can_import_recipe: false }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  return { context, page, errors, writes, requests, state }
}

try {
  for (const level of ['edit', 'view']) {
    const mobile = level === 'view'
    const t = await setup({ level, mobile })
    await t.page.goto(base + '/crm?tab=deal&view=list&entry=11')
    const card = t.page.getByRole('dialog', { name: deal.name, exact: true })
    await card.waitFor()
    if (mobile) await card.getByRole('tab', { name: 'История', exact: true }).click()
    const panel = card.getByRole('region', { name: 'Связь с клиентом', exact: true })
    await panel.getByText('Пришлите расчёт', { exact: true }).waitFor()
    await panel.getByRole('button', { name: 'Звонки', exact: true }).click()
    await panel.getByText('Звонки этой заявки', { exact: false }).waitFor()
    assert.equal(t.writes.length, 0)
    assert.equal(await panel.getByText('Входящий · 79000000000', { exact: true }).count(), 0)
    await panel.getByRole('button', { name: 'Другие звонки клиента', exact: true }).click()
    await panel.getByText('Входящий · 79000000000', { exact: true }).click()
    if (level === 'edit') {
      await panel.getByRole('button', { name: 'Привязать к этой заявке', exact: true }).click()
      await panel.getByRole('button', { name: 'Вернуться к звонкам заявки', exact: true }).click()
      await panel.getByText('Входящий · 79000000000', { exact: true }).waitFor()
    } else assert.equal(await panel.getByRole('button', { name: 'Привязать к этой заявке', exact: true }).count(), 0)
    await panel.getByRole('button', { name: 'MAX', exact: true }).click()
    await panel.getByText('Пришлите расчёт', { exact: true }).waitFor()
    await panel.getByText('Общий чат связанного клиента.', { exact: false }).waitFor()
    if (level === 'edit') {
      const draft = panel.getByRole('textbox', { name: 'Сообщение клиенту в MAX', exact: true })
      await draft.fill('Расчёт готов')
      await panel.getByRole('button', { name: 'Отправить в MAX', exact: true }).evaluate(button => { button.click(); button.click() })
      await panel.getByRole('alert').filter({ hasText: 'Не удалось подтвердить' }).waitFor()
      assert.equal(await draft.inputValue(), 'Расчёт готов')
      assert.equal(t.writes.filter(w => w.path.endsWith('/messages')).length, 1)
      assert.ok(await panel.getByRole('button', { name: 'Отправить в MAX', exact: true }).isDisabled())
      await panel.getByRole('button', { name: 'Обновить переписку', exact: true }).click()
      await panel.getByRole('button', { name: 'Проверил: сообщение не доставлено', exact: true }).click()
      await panel.getByRole('button', { name: 'Отправить в MAX', exact: true }).click()
      await panel.getByLabel('История переписки', { exact: true }).getByText('Расчёт готов', { exact: true }).waitFor()
      assert.equal(await draft.inputValue(), '')
      await t.page.screenshot({ path: artifacts + '/desktop.png' })
      await card.getByRole('button', { name: 'Действия с номером +79000000000', exact: true }).first().click()
      await t.page.getByRole('dialog', { name: 'Действия с номером', exact: true }).getByRole('button', { name: 'Позвонить', exact: true }).click()
      const callDialog = t.page.getByRole('dialog', { name: 'Звонок из CRM', exact: true })
      const dial = callDialog.getByRole('button', { name: 'Позвонить через МегаФон', exact: true })
      await dial.waitFor()
      assert.equal(t.state.calls, 0)
      await dial.evaluate(button => { button.click(); button.click() })
      await callDialog.getByRole('status').filter({ hasText: 'Результат запроса неизвестен' }).waitFor()
      assert.equal(t.state.calls, 1)
      assert.equal(t.writes.filter(w => w.path === '/api/crm/calls/dial').length, 1)
    } else {
      assert.equal(await panel.getByRole('button', { name: 'Отправить в MAX', exact: true }).count(), 0)
      assert.equal(t.writes.length, 0)
      assert.ok(await t.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      await t.page.screenshot({ path: artifacts + '/mobile.png' })
    }
    assert.deepEqual(t.errors, [])
    report.checks.push(level + ': call/deal links, shared MAX chat, permissions, draft preservation, explicit single-shot actions, responsive card')
    await t.context.close()
  }
  const t = await setup({ admin: true })
  await t.page.goto(base + '/admin')
  await t.page.getByText('Звонки и автоматические заявки', { exact: true }).click()
  const settings = t.page.locator('details').filter({ has: t.page.getByText('Звонки и автоматические заявки', { exact: true }) })
  await settings.getByRole('button', { name: 'Добавить менеджера', exact: true }).click()
  await settings.getByLabel('Менеджер', { exact: true }).selectOption('6')
  await settings.getByLabel('Логин / внутренний номер ВАТС', { exact: true }).fill('101')
  await settings.getByRole('button', { name: 'Добавить менеджера', exact: true }).click()
  await settings.getByLabel('Менеджер', { exact: true }).nth(1).selectOption('5')
  await settings.getByLabel('Логин / внутренний номер ВАТС', { exact: true }).nth(1).fill('102')
  await settings.getByRole('button', { name: 'Сохранить настройки связи', exact: true }).click()
  await settings.getByRole('status').filter({ hasText: 'выключено' }).waitFor()
  const write = t.writes.find(w => w.path.endsWith('/telephony/routing'))
  assert.equal(write.body.enabled, false)
  assert.deepEqual(write.body.members.map(m => m.user_id), [6, 5])
  assert.equal(write.body.main_phone, '79066773555')
  await settings.getByRole('button', { name: 'Проверить связь без звонка и сообщений', exact: true }).click()
  await settings.getByText('Последняя проверка:', { exact: false }).waitFor()
  assert.equal(t.state.calls, 0)
  assert.deepEqual(t.errors, [])
  report.checks.push('admin: two managers, draft routing disabled, main number, read-only provider diagnostics, MAX reauth shown')
  await t.context.close()
  report.ok = true
  await writeFile(artifacts + '/report.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
} finally { await browser.close() }
