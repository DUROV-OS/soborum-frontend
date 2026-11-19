import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5177'
const browser = await chromium.launch({ headless: true, channel: process.env.SMOKE_BROWSER_CHANNEL || undefined })
const artifact = 'test-results/collaboration-tabs'
await mkdir(artifact, { recursive: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/Moscow' })
await context.addInitScript(() => {
  localStorage.setItem('soborbum.auth.token', 'synthetic-collaboration-test')
  localStorage.setItem('soborbum.onboarding.chats', '1')
})
const page = await context.newPage()
await page.clock.setFixedTime(new Date('2026-11-18T09:00:00+03:00'))
const errors = [], moves = [], requests = []
page.on('pageerror', e => errors.push(e.message))
let preferences = { version: 0, timezone: 'Europe/Moscow', work_start: 480, work_end: 1140, weekdays: [0,1,2,3,4], categories: {
  meeting: { label: 'Встречи', color: '#4776d0' }, work: { label: 'Задачи', color: '#138b78' }, personal: { label: 'Личное', color: '#8854bf' }, anniversary: { label: 'Юбилеи', color: '#b06b0d' },
} }
let calendarEvent = { id: 1, version: 1, owner_id: 1, can_edit: true, can_delete: true, can_manage_access: true, title: 'Планёрка отдела', start: '2026-11-18T10:00:00+03:00', end: '2026-11-18T11:00:00+03:00', occurrence_start: '2026-11-18T10:00:00+03:00', occurrence_end: '2026-11-18T11:00:00+03:00', occurrence_id: '0', timezone: 'Europe/Moscow', description: 'Обсуждение текущих проектов', location: 'Переговорная', category: 'meeting', availability: 'busy', recurrence: 'none', count: 1, participants: [], responses: {}, cancelled: false }
let failMove = false, mailAccess = true, mailConfigured = true, unread = true
let actor = { id: 1, full_name: 'Тестовый руководитель', email: 'test@example.test', role: 'admin', is_active: true, module_access: {} }
const chats = [
  { id: 1, title: 'Юлия', type: 'DIALOG' }, { id: 2, title: 'Производство', type: 'CHAT' }, { id: 3, title: 'Новости компании', type: 'CHANNEL' },
].map(c => ({ ...c, unread: 0, lastEventTime: null, lastMessage: null, phone: null }))
await page.route('**/api/**', async route => {
  const url = new URL(route.request().url()), path = url.pathname, method = route.request().method()
  requests.push(path)
  let body = [], status = 200
  if (path === '/api/auth/me') body = actor
  else if (path === '/api/notifications/unread-count') body = { count: 0 }
  else if (path.endsWith('/calendar/preferences')) {
    if (method === 'PUT') preferences = { ...route.request().postDataJSON(), version: preferences.version + 1 }
    body = preferences
  } else if (path.endsWith('/calendar/events')) body = [calendarEvent]
  else if (path.endsWith('/calendar/events/1/move')) {
    const input = route.request().postDataJSON(); moves.push(input)
    if (failMove) { status = 409; body = { detail: 'Событие изменено другим сотрудником' } }
    else { calendarEvent = { ...calendarEvent, start: input.start, end: new Date(Date.parse(input.start) + 3600000).toISOString(), occurrence_start: input.start, occurrence_end: new Date(Date.parse(input.start) + 3600000).toISOString(), version: calendarEvent.version + 1 }; body = calendarEvent }
  } else if (path === '/api/max/chats') body = { count: chats.length, chats }
  else if (path === '/api/mail/status') body = { address: 'sales@durov.house', can_access: mailAccess, configured: mailConfigured, mode: 'shared' }
  else if (path === '/api/mail/folders') body = [{ id: 'SU5CT1g', name: 'Входящие', inbox: true, total: 100, unread: unread ? 42 : 41 }, { id: 'U2VudA', name: 'Отправленные', inbox: false, total: 12, unread: 0 }]
  else if (path === '/api/mail/messages') {
    const old = url.searchParams.has('before')
    const sent = url.searchParams.get('folder_id') === 'U2VudA'
    body = { uidvalidity: '81', next_before: sent || old ? null : 9, items: sent ? [] : [
      { uid: old ? 8 : 9, subject: old ? 'Более ранний договор' : 'Договор дома', sender: 'Клиент', to: 'sales@durov.house', date: '2026-11-18T08:00:00Z', unread, size: 100 }
    ] }
  }
  else if (path === '/api/mail/messages/9') body = { uid: 9, subject: 'Договор дома', sender: 'Клиент', to: 'sales@durov.house', date: '2026-11-18T08:00:00Z', text: 'Просьба согласовать договор.', attachments: [{ part: 2, filename: 'Договор.pdf', size: 100 }] }
  else if (path === '/api/mail/messages/9/flags') { unread = !route.request().postDataJSON().read; body = { uid: 9, unread } }
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
})

try {
  await page.goto(base + '/calendar')
  await page.locator('[data-work-start="480"]').first().waitFor()
  const toolNavigation = page.getByRole('navigation', { name: 'Разделы совместной работы' })
  const tool = name => toolNavigation.getByRole('link', { name, exact: true })
  const calendarNavigation = page.getByRole('navigation', { name: 'Разделы календаря' })
  assert.deepEqual(await calendarNavigation.getByRole('link').allTextContents(), ['Мой календарь','Календари команды','Планировщик встреч','Настройки'])
  assert.equal(await calendarNavigation.count(), 1)
  assert.deepEqual(await toolNavigation.getByRole('link').allTextContents(),
    ['Обзор', 'Мессенджер Макс','Календарь','Почта','Durov GPT','Диск','Задачи','Совещания'])
  assert.equal(await tool('Календарь').getAttribute('aria-current'), 'page')
  const side = page.getByRole('complementary', { name: 'Главное меню' })
  assert.equal(await side.getByRole('link', { name: 'Совместная работа', exact: true }).count(), 1)
  assert.equal(await side.getByRole('link', { name: 'Календарь', exact: true }).count(), 0)
  await page.getByRole('navigation', { name: 'Разделы календаря' }).getByRole('link', { name: 'Настройки' }).click()
  await page.getByLabel('Начало рабочего дня').fill('08:30')
  await page.getByLabel('Цвет: Встречи').fill('#aa3344')
  await page.getByRole('button', { name: 'Сохранить настройки' }).click()
  await page.getByText('Настройки сохранены').waitFor()
  await page.reload()
  await page.getByLabel('Начало рабочего дня').waitFor()
  assert.equal(await page.getByLabel('Начало рабочего дня').inputValue(), '08:30')
  assert.equal(await page.getByLabel('Цвет: Встречи').inputValue(), '#aa3344')
  await page.getByRole('navigation', { name: 'Разделы календаря' }).getByRole('link', { name: 'Мой календарь', exact: true }).click()
  await page.locator('[data-work-start="510"]').first().waitFor()
  assert.equal(await page.getByRole('button', { name: /Планёрка отдела,/ }).evaluate(el => getComputedStyle(el).borderLeftColor), 'rgb(170, 51, 68)')
  // Native drag/drop sends a versioned server mutation; a failure preserves the grid.
  const drag = await page.evaluateHandle(() => new DataTransfer())
  await page.getByRole('button', { name: /Планёрка отдела,/ }).dispatchEvent('dragstart', { dataTransfer: drag })
  const target = page.locator('[data-calendar-day]').nth(2), bounds = await target.boundingBox()
  await target.dispatchEvent('drop', { dataTransfer: drag, clientY: bounds.y + (12 - 8) * 60 * 1.2 })
  await page.getByText('Время события изменено', { exact: true }).waitFor()
  assert.equal(moves[0].scope, 'occurrence'); assert.equal(moves[0].occurrence_id, '0')
  failMove = true
  await page.getByRole('button', { name: /Планёрка отдела,/ }).click()
  await page.getByLabel('Новое время события').fill('2026-11-18T14:00')
  await page.getByRole('button', { name: 'Перенести', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'Не удалось перенести событие' }).waitFor()
  await page.locator('[data-work-start]').first().waitFor()
  failMove = false
  calendarEvent.recurrence = 'weekly'; calendarEvent.count = 3
  await page.reload()
  await page.getByRole('button', { name: /Планёрка отдела,/ }).click()
  await page.getByLabel('Новое время события').fill('2026-11-18T14:00')
  await page.getByRole('button', { name: 'Перенести', exact: true }).click()
  await page.getByRole('button', { name: 'Только это событие' }).click()
  await page.getByText('Время события изменено', { exact: true }).waitFor()
  await page.getByRole('button', { name: /Планёрка отдела,/ }).waitFor()
  await page.screenshot({ path: artifact + '/calendar-desktop.png', fullPage: true })
  await page.getByRole('tab', { name: 'Месяц', exact: true }).click()
  await page.getByRole('button', { name: 'Планёрка отдела', exact: true }).waitFor()
  const monthDrag = await page.evaluateHandle(() => new DataTransfer())
  await page.getByRole('button', { name: 'Планёрка отдела', exact: true }).dispatchEvent('dragstart', { dataTransfer: monthDrag })
  await page.getByRole('button', { name: 'Открыть 19.11.2026', exact: true }).locator('..').dispatchEvent('drop', { dataTransfer: monthDrag })
  await page.getByRole('button', { name: 'Всю серию', exact: true }).click()
  await page.getByText('Время события изменено', { exact: true }).waitFor()
  assert.equal(moves.at(-1).scope, 'series')
  assert.equal(moves.at(-1).start, '2026-11-19T11:00:00.000Z')
  await page.screenshot({ path: artifact + '/calendar-month.png', fullPage: true })
  await page.getByLabel('Поиск событий').fill('Планёрка')
  await page.evaluate(() => { window.collaborationSpa = true })
  await tool('Мессенджер Макс').click()
  await page.getByRole('button', { name: /Мессенджер Макс Производство/ }).waitFor()
  const before = requests.filter(p => p === '/api/max/chats').length
  await page.getByRole('button', { name: 'Группы', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: /Юлия/ }).count(), 0)
  assert.equal(await page.getByRole('button', { name: /Новости компании/ }).count(), 0)
  await page.getByRole('button', { name: 'Личные чаты', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: /Юлия/ }).count(), 1)
  assert.equal(requests.filter(p => p === '/api/max/chats').length, before)
  await page.getByRole('button', { name: 'Группы', exact: true }).click()
  await page.getByPlaceholder('Поиск по чатам').fill('Производство')
  await page.screenshot({ path: artifact + '/max-desktop.png', fullPage: true })
  await tool('Календарь').click()
  await page.getByRole('tab', { name: 'Месяц', exact: true }).waitFor()
  assert.equal(await page.getByRole('tab', { name: 'Месяц', exact: true }).getAttribute('aria-selected'), 'true')
  assert.equal(await page.getByLabel('Поиск событий').inputValue(), 'Планёрка')
  await tool('Мессенджер Макс').click()
  await page.getByRole('button', { name: 'Группы', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Группы', exact: true }).getAttribute('aria-pressed'), 'true')
  assert.equal(await page.getByPlaceholder('Поиск по чатам').inputValue(), 'Производство')
  assert.equal(await page.evaluate(() => window.collaborationSpa), true)
  await tool('Почта').click()
  await page.getByRole('button', { name: /Договор дома/ }).waitFor()
  await page.getByRole('button', { name: /Договор дома/ }).click()
  await page.getByText('Просьба согласовать договор.').waitFor()
  await page.waitForFunction(() => document.querySelector('[aria-label="Почтовые папки"]')?.textContent.includes('41'))
  await page.screenshot({ path: artifact + '/mail-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'Более ранние письма' }).click()
  await page.getByRole('button', { name: /Более ранний договор/ }).waitFor()
  await tool('Календарь').click()
  await tool('Почта').click()
  await page.getByRole('button', { name: /Более ранний договор/ }).waitFor()
  await page.getByRole('button', { name: 'Отправленные', exact: true }).click()
  await page.getByText('В этой папке пока нет писем.').waitFor()
  await side.getByRole('link', { name: 'Разделы', exact: true }).click()
  await side.getByRole('link', { name: 'Совместная работа', exact: true }).click()
  await page.getByText('В этой папке пока нет писем.').waitFor()
  assert.equal(await page.getByRole('button', { name: 'Отправленные', exact: true }).getAttribute('aria-current'), 'page')
  assert.equal(await tool('Почта').getAttribute('aria-current'), 'page')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: /Входящие/ }).click()
  await page.getByRole('button', { name: /Договор дома/ }).click()
  await page.getByText('Просьба согласовать договор.').waitFor()
  await page.screenshot({ path: artifact + '/mail-mobile.png', fullPage: true })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.getByRole('button', { name: 'К списку писем' }).click()
  mailAccess = false
  await page.reload()
  await page.getByRole('heading', { name: 'Нет доступа к общему ящику' }).waitFor()
  mailAccess = true; mailConfigured = false
  await page.reload()
  await page.getByRole('heading', { name: 'Почтовый ящик ещё не подключён' }).waitFor()
  await page.goto(base + '/chats')
  await page.getByRole('button', { name: 'Группы', exact: true }).click()
  await page.screenshot({ path: artifact + '/max-mobile.png', fullPage: true })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.goto(base + '/calendar')
  await page.locator('[data-work-start]').first().waitFor()
  await page.getByRole('tab', { name: 'День', exact: true }).click()
  await page.screenshot({ path: artifact + '/calendar-mobile.png', fullPage: true })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.setViewportSize({ width: 1152, height: 800 })
  await page.evaluate(() => { document.documentElement.style.zoom = '1.25' })
  assert(await page.locator('[data-work-start]').first().isVisible())
  actor = { ...actor, role: 'worker', job_role: 'manager', access_profile: 'sales_manager', module_access: { clients: 'edit', tasks: 'edit' } }
  await page.goto(base + '/calendar')
  await page.getByRole('heading', { name: 'Мой календарь', exact: true }).waitFor()
  assert.equal(await page.locator('[data-section-navigation]').getByRole('link', { name: 'Маркетинг', exact: true }).count(), 0)
  await page.goto(base + '/work')
  await page.getByRole('heading', { name: 'Разделы.' }).waitFor()
  assert.equal(await page.getByRole('link', { name: 'Проекты Команда, задачи и документы проектов' }).count(), 1)
  await page.goto(base + '/mail')
  await page.getByRole('heading', { name: 'Почтовый ящик ещё не подключён' }).waitFor()
  assert.deepEqual(errors, [])
  console.log('PASS: navigation, persisted hours/colors, event drag and failure, recurrence scope, MAX filtering, shared mail folders/read flags, mobile and access states')
} finally { await browser.close() }
