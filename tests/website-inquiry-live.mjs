import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5197'
assert.equal(new URL(base).hostname, '127.0.0.1')
const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(() => {
    localStorage.setItem('soborbum.auth.token', 'local-website-inquiry-test')
    window.testChimes = 0
    window.AudioContext = class {
      state = 'running'
      currentTime = 0
      destination = {}
      createOscillator() {
        return {
          frequency: {}, connect: gain => gain, disconnect() {}, stop() {},
          start: () => { window.testChimes += 1 }
        }
      }
      createGain() {
        return {
          connect() {}, disconnect() {},
          gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        }
      }
      async close() {}
    }
  })
  let cursor = 1
  let wake = () => {}
  const entries = [{ id: 101, name: 'Существующая заявка' }]
  let subscribed = false
  const now = '2026-11-25T06:00:00Z'
  const record = (entry, kind = 'inquiry', data = {}) => ({
    ...entry, kind, version: 1, archived: false, source_id: 'website/' + entry.id,
    source_created_at: now, source_date_origin: 'website', created_at: now, updated_at: now,
    data: { contact_name: entry.name, source_name: 'Яндекс Директ', ...data },
  })

  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    const path = url.pathname
    if (process.env.LEAD_TEST_DIAGNOSTIC) console.error(path)
    if (path === '/api/crm/inquiries/live') {
      if (url.searchParams.get('cursor') === String(cursor)) {
        subscribed = true
        await new Promise(resolve => {
          wake = resolve
          setTimeout(resolve, 1200).unref()
        })
      }
      try {
        if (url.searchParams.get('cursor') === String(cursor)) return await route.fulfill({ status: 204 })
        return await route.fulfill({ json: { cursor: String(cursor), entries: entries.map(row => ({ id: row.id, notify: true })) } })
      } catch {
        // Navigating away cancels an open long-poll request.
        return
      }
    }

    let body
    if (path === '/api/auth/me') body = {
      id: 27, role: 'worker', job_role: 'manager', access_profile: 'sales_manager', is_active: true,
      full_name: 'Тестовый менеджер', email: 'sales@example.test', module_access: { clients: 'full', tasks: 'edit' },
    }
    else if (path === '/api/auth/me/workspace') body = null
    else if (['/api/feedback/requests', '/api/projects/calendar/reminders'].includes(path)) body = []
    else if (path === '/api/crm/catalog') body = {
      pipelines: [record({ id: 1, name: 'Допродажная воронка' }, 'pipeline')],
      stages: [record({ id: 2, name: 'Входящие' }, 'stage', { pipeline_id: 1, outcome: 'open', sort: 1 })],
      users: [], counts: {},
    }
    else if (path === '/api/crm/entries') {
      const items = url.searchParams.get('kind') === 'inquiry' ? entries.map(entry => record(entry)) : []
      body = { items, total: items.length }
    }
    else if (path === '/api/crm/kanban-summary') body = { total: entries.length, columns: [] }
    else if (path.endsWith('/history') || path.endsWith('/files')) body = { total: 0, items: [] }
    else if (path.startsWith('/api/crm/entries/')) body = record(entries.find(entry => entry.id === Number(path.split('/').at(-1))))
    else body = { total: 0, items: [], reminders: [], tools: [], available: false, exists: false }
    return route.fulfill({ json: body })
  })

  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', msg => { if (msg.type() === 'error') console.error(msg.text()) })
  await page.goto(base + '/crm?tab=inquiry')
  try {
    await page.getByText('Существующая заявка', { exact: true }).first().waitFor({ timeout: 4000 })
  } catch (error) {
    console.error({ url: page.url(), body: (await page.locator('body').innerText()).slice(0, 2400), pageErrors })
    throw error
  }
  await page.getByRole('button', { name: 'Включить звук заявок' }).click()
  await page.getByRole('button', { name: 'Выключить звук заявок' }).waitFor()
  assert.equal(await page.evaluate(() => window.testChimes), 0)
  assert.equal(await page.getByText('Новая заявка с сайта', { exact: true }).count(), 0)

  const waitSubscription = async () => {
    for (let tries = 0; !subscribed && tries < 40; tries += 1) await new Promise(resolve => setTimeout(resolve, 25))
    assert.equal(subscribed, true)
  }
  const add = (entry) => {
    entries.unshift(entry)
    cursor += 1
    subscribed = false
    wake()
    return Date.now()
  }
  await waitSubscription()
  const started = add({ id: 102, name: 'Новая заявка с Директа' })
  await page.getByText('Новая заявка с Директа', { exact: true }).first().waitFor({ timeout: 3500 })
  const refreshMs = Date.now() - started
  const open = page.getByRole('link', { name: 'Открыть заявку' })
  await open.waitFor()
  assert.equal(await open.getAttribute('href'), '/crm?tab=inquiry&entry=102')
  await page.waitForFunction(() => window.testChimes === 2)
  await open.click()
  await page.waitForURL('**/crm?tab=inquiry&entry=102')

  await page.goto(base + '/crm?tab=inquiry')
  await page.getByText('Новая заявка с Директа', { exact: true }).first().waitFor()
  await page.getByRole('button', { name: 'Включить звук заявок' }).click()
  await page.getByRole('button', { name: 'Выключить звук заявок' }).waitFor()
  assert.equal(await page.evaluate(() => window.testChimes), 0)
  await page.getByRole('button', { name: 'Выключить звук заявок' }).click()
  await page.getByRole('button', { name: 'Включить звук заявок' }).waitFor()
  await waitSubscription()
  add({ id: 103, name: 'Следующее входящее обращение' })
  await page.getByText('Следующее входящее обращение', { exact: true }).first().waitFor({ timeout: 3500 })
  await page.getByRole('link', { name: 'Открыть заявку' }).waitFor()
  assert.equal(await page.evaluate(() => window.testChimes), 0)
  assert.deepEqual(pageErrors, [])
  console.log(JSON.stringify({ checked: 'sales manager live inbox, direct link, sound, mute, silent baseline', refreshMs }))
} finally {
  await browser.close()
}
