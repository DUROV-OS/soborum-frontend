import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4192'
const browser = await chromium.launch({ headless: true })
const report = { base, synthetic_api: true, checks: [] }
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const message = (id, text, isOutgoing = false) => ({ id, text, isOutgoing, isSystem: false, systemText: null, time: 1793782800000, senderId: 'synthetic-user', senderName: 'Клиент', elements: [], attaches: [] })

async function setup({ phone = '8 (900) 111-22-33', level = 'full', mobile = false } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1540, height: 1000 } })
  await context.addInitScript(() => {
    localStorage.setItem('soborbum.auth.token', 'synthetic-phone-token')
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.__syntheticCopiedPhone = value } } })
  })
  const page = await context.newPage(), reads = [], writes = [], errors = [], external = []
  page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (new URL(request.url()).origin !== new URL(base).origin) external.push(request.url()) })
  const contact = { id: 201, kind: 'contact', name: 'Клиент Анна', data: { phone, email: '', custom_fields: [] }, archived: false, version: 3, updated_at: '2026-11-04T09:00:00Z', source_created_at: '2026-11-04T09:00:00Z', source_created_at_kind: 'local' }
  const state = { failSend: 0, failLookup: 0 }
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    let body = [], status = 200
    if (request.method() === 'GET') {
      reads.push(path + url.search)
      if (path === '/api/auth/me') body = { id: 6, full_name: 'Денис', role: 'worker', job_role: 'manager', is_active: true, work_phone: '+7 911 222-33-44', telephony_extension: '106', module_access: { clients: level, tasks: 'view' } }
      else if (path === '/api/crm/catalog') body = { pipelines: [], stages: [], users: [{ id: 6, name: 'Денис' }], counts: { contact: 1 } }
      else if (path === '/api/crm/entries/201') body = contact
      else if (path === '/api/crm/entries') body = { total: url.searchParams.get('kind') === 'contact' ? 1 : 0, items: url.searchParams.get('kind') === 'contact' ? [contact] : [] }
      else if (/\/(history|files)$/.test(path)) body = { total: 0, items: [] }
      else if (path === '/api/notifications/unread-count') body = { unread_count: 0 }
      else if (path === '/api/max/chats/777') body = { chatId: 777, title: 'Клиент Анна', viewerId: 'synthetic-work-user', isGroup: false, peer: null, count: 1, messages: [message('previous-1', 'Предыдущее сообщение клиента')] }
    } else {
      const input = request.postDataJSON(); writes.push({ method: request.method(), path, input })
      if (request.method() === 'POST' && path === '/api/max/contacts') {
        if (state.failLookup) { status = state.failLookup; state.failLookup = 0; body = { detail: 'RAW_PRIVATE_BACKEND_DETAIL' } }
        else body = { chatId: 777, userId: 'synthetic-client' }
      } else if (request.method() === 'POST' && path === '/api/max/messages') {
        await pause(40)
        if (state.failSend) { status = state.failSend; state.failSend = 0; body = { detail: 'RAW_PRIVATE_BACKEND_DETAIL' } }
        else body = { message: message('sent-' + writes.length, input.text, true) }
      } else { status = 400; body = { detail: 'Unexpected synthetic mutation' } }
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(base + '/crm?tab=contact&entry=201')
  const card = page.getByRole('dialog', { name: 'Клиент Анна', exact: true })
  await card.waitFor(); await card.getByRole('status').waitFor({ state: 'detached' })
  await page.waitForLoadState('networkidle')
  return { page, context, card, phone, reads, writes, errors, external, state }
}

async function openMenu(t) {
  await t.card.getByRole('button', { name: `Действия с номером ${t.phone}`, exact: true }).click()
  const dialog = t.page.getByRole('dialog', { name: 'Действия с номером', exact: true })
  await dialog.waitFor(); return dialog
}
async function openMax(t) {
  const menu = await openMenu(t)
  await menu.getByRole('button', { name: 'Написать в MAX', exact: true }).click()
  const dialog = t.page.getByRole('dialog', { name: 'Переписка в MAX', exact: true })
  await dialog.getByRole('button', { name: 'Открыть переписку', exact: true }).click()
  await dialog.getByText('Предыдущее сообщение клиента', { exact: true }).waitFor()
  return dialog
}

try {
  const t = await setup(), beforeReads = [...t.reads], beforeExternal = [...t.external]
  let menu = await openMenu(t)
  assert.deepEqual(t.reads, beforeReads); assert.deepEqual(t.writes, [])
  await menu.getByRole('button', { name: 'Копировать номер', exact: true }).click()
  await menu.getByText('Номер скопирован', { exact: true }).waitFor()
  assert.equal(await t.page.evaluate(() => window.__syntheticCopiedPhone), '+79001112233')
  await menu.getByRole('button', { name: 'Написать в Telegram', exact: true }).click()
  const telegram = t.page.getByRole('dialog', { name: 'Корпоративный Telegram', exact: true })
  await telegram.getByRole('status').filter({ hasText: 'Сообщение не отправлено' }).waitFor()
  assert.equal(await telegram.locator('a[href*="t.me"], a[href^="tg:"]').count(), 0)
  assert.deepEqual(t.reads, beforeReads); assert.deepEqual(t.writes, []); assert.deepEqual(t.external, beforeExternal)
  await telegram.getByRole('button', { name: 'Назад к действиям', exact: true }).click()
  await menu.getByRole('button', { name: 'Позвонить', exact: true }).click()
  const call = t.page.getByRole('dialog', { name: 'Звонок из CRM', exact: true })
  await call.getByText('+7 911 222-33-44', { exact: true }).waitFor()
  await call.getByText('106', { exact: true }).waitFor()
  await call.getByRole('status').filter({ hasText: 'Звонок не выполнен' }).waitFor()
  assert.equal(await call.locator('a[href^="tel:"]').count(), 0)
  assert.deepEqual(t.reads, beforeReads); assert.deepEqual(t.writes, []); assert.deepEqual(t.external, beforeExternal)
  await call.getByRole('button', { name: 'Назад к действиям', exact: true }).click()
  report.checks.push('opening phone menu, copying normalized E.164, corporate Telegram pending status and call status cause no API request, message, personal Telegram navigation or telephone call; current employee work phone is shown')

  menu = t.page.getByRole('dialog', { name: 'Действия с номером', exact: true })
  await menu.getByRole('button', { name: 'Написать в MAX', exact: true }).click()
  const max = t.page.getByRole('dialog', { name: 'Переписка в MAX', exact: true })
  assert.deepEqual(t.writes, []); assert.deepEqual(t.reads, beforeReads)
  await max.getByRole('button', { name: 'Открыть переписку', exact: true }).click()
  await max.getByText('Предыдущее сообщение клиента', { exact: true }).waitFor()
  assert.deepEqual(t.writes, [{ method: 'POST', path: '/api/max/contacts', input: { phone: '+79001112233', first_name: 'Клиент Анна', last_name: null } }])
  assert.equal(t.reads.filter(path => path === '/api/max/chats/777?limit=30').length, 1)
  await max.getByLabel('Сообщение клиенту в MAX', { exact: true }).fill('Сообщение из синтетического теста')
  await max.getByRole('button', { name: 'Отправить', exact: true }).evaluate(button => { button.click(); button.click() })
  await max.getByText('Сообщение отправлено', { exact: true }).waitFor()
  assert.deepEqual(t.writes.filter(write => write.path === '/api/max/messages'), [{ method: 'POST', path: '/api/max/messages', input: { chat_id: 777, text: 'Сообщение из синтетического теста', notify: true } }])
  assert.equal(await max.getByLabel('Сообщение клиенту в MAX', { exact: true }).inputValue(), '')
  assert.deepEqual(t.errors, []); assert.deepEqual(t.external, beforeExternal)
  await t.context.close()
  report.checks.push('MAX lookup and history require explicit Open; no automatic message; double send click results in exactly one explicit synthetic send')

  const failed = await setup(), failedMax = await openMax(failed)
  failed.state.failSend = 502
  await failedMax.getByLabel('Сообщение клиенту в MAX', { exact: true }).fill('Сохранить черновик при сбое')
  await failedMax.getByRole('button', { name: 'Отправить', exact: true }).click()
  await failedMax.getByRole('alert').filter({ hasText: 'Не удалось подтвердить отправку' }).waitFor()
  assert.equal(await failedMax.getByLabel('Сообщение клиенту в MAX', { exact: true }).inputValue(), 'Сохранить черновик при сбое')
  assert.equal(await failedMax.getByRole('button', { name: 'Отправить', exact: true }).isDisabled(), true)
  assert.equal((await failedMax.innerText()).includes('RAW_PRIVATE_BACKEND_DETAIL'), false)
  assert.equal(failed.writes.filter(write => write.path === '/api/max/messages').length, 1)
  await failedMax.getByRole('button', { name: 'Обновить переписку', exact: true }).click()
  await failedMax.getByRole('status').filter({ hasText: 'Переписка обновлена' }).waitFor()
  assert.equal(await failedMax.getByRole('button', { name: 'Отправить', exact: true }).isDisabled(), true)
  await failedMax.getByRole('checkbox', { name: /Я проверил переписку/ }).click()
  assert.equal(await failedMax.getByRole('button', { name: 'Отправить', exact: true }).isEnabled(), true)
  await failedMax.getByRole('button', { name: 'Отправить', exact: true }).click()
  await failedMax.getByText('Сообщение отправлено', { exact: true }).waitFor()
  assert.equal(failed.writes.filter(write => write.path === '/api/max/messages').length, 2)
  assert.deepEqual(failed.errors, []); await failed.context.close()
  report.checks.push('ambiguous 502 preserves draft, suppresses raw backend detail and blocks repeat send until user checks history and explicitly acknowledges retry')

  const unavailable = await setup(), unavailableMenu = await openMenu(unavailable)
  unavailable.state.failLookup = 502
  await unavailableMenu.getByRole('button', { name: 'Написать в MAX', exact: true }).click()
  const unavailableMax = unavailable.page.getByRole('dialog', { name: 'Переписка в MAX', exact: true })
  await unavailableMax.getByRole('button', { name: 'Открыть переписку', exact: true }).click()
  await unavailableMax.getByRole('alert').filter({ hasText: 'Рабочее подключение MAX недоступно' }).waitFor()
  assert.equal((await unavailableMax.innerText()).includes('RAW_PRIVATE_BACKEND_DETAIL'), false)
  assert.equal(unavailable.writes.filter(write => write.path === '/api/max/messages').length, 0)
  assert.deepEqual(unavailable.errors, []); await unavailable.context.close()
  report.checks.push('MAX connection failure shows a clear recovery message without exposing backend detail or sending anything')

  const invalid = await setup({ phone: 'два номера: 9001112233 / 9002223344' }), invalidMenu = await openMenu(invalid)
  await invalidMenu.getByText('Для связи нужен один номер с кодом страны. Исправьте телефон в карточке.', { exact: true }).waitFor()
  for (const name of ['Написать в MAX', 'Написать в Telegram', 'Позвонить']) assert.equal(await invalidMenu.getByRole('button', { name, exact: true }).isDisabled(), true)
  assert.deepEqual(invalid.writes, []); assert.deepEqual(invalid.errors, []); await invalid.context.close()
  const viewer = await setup({ level: 'view', mobile: true }), viewerMenu = await openMenu(viewer)
  for (const name of ['Написать в MAX', 'Написать в Telegram', 'Позвонить']) assert.equal(await viewerMenu.getByRole('button', { name, exact: true }).isDisabled(), true)
  assert.equal(await viewerMenu.getByRole('button', { name: 'Копировать номер', exact: true }).isEnabled(), true)
  assert.ok(await viewer.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  assert.deepEqual(viewer.writes, []); assert.deepEqual(viewer.errors, []); await viewer.context.close()
  report.checks.push('invalid phone and view-only users cannot message or call; mobile action menu fits viewport and still allows copying')

  await mkdir('test-results', { recursive: true })
  await writeFile('test-results/crm-phone-actions.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally { await browser.close() }
