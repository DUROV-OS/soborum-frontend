import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const baseURL = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:4176'
const browser = await chromium.launch({ headless: true })
const header = { uid: 9, subject: 'Расчёт дома', sender: 'Клиент <client@example.test>', to: 'sales@example.test', cc: '', date: 'Mon, 2 Nov 2026 12:00:00 +0300', unread: true, size: 500 }

async function setup({ configured = true, fail = false, mobile = false } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } })
  await context.addInitScript(() => localStorage.setItem('soborbum.auth.token', 'test-token'))
  const page = await context.newPage()
  const requests = []
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    requests.push({ path: url.pathname, query: url.search, method: route.request().method(), auth: route.request().headers().authorization })
    let body = [], status = 200
    if (url.pathname === '/api/auth/me') body = { id: 2, full_name: 'Сотрудник', email: 'worker@example.test', role: 'worker', is_active: true, module_access: {} }
    else if (url.pathname === '/api/mail/status') body = { address: 'sales@example.test', configured, mode: 'read_only' }
    else if (url.pathname === '/api/mail/messages') {
      if (fail) { status = 502; body = { detail: 'Не удалось подключиться к почте NIC.RU.' } }
      else body = { items: [{ ...header, uid: url.searchParams.has('before') ? 2 : 9 }], uidvalidity: '81', next_before: url.searchParams.has('before') ? null : 9 }
    } else if (url.pathname === '/api/mail/messages/9') body = { ...header, text: 'Нужен расчёт. <img src="https://tracker.example/x">', attachments: [{ part: 2, filename: 'План.pdf', size: 16 }] }
    else if (url.pathname.endsWith('/attachments/2')) { await route.fulfill({ contentType: 'application/octet-stream', body: 'example-document' }); return }
    else if (url.pathname === '/api/auth/me/workspace') body = null
    else { status = 404; body = { detail: 'Не найдено' } }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(baseURL + '/mail')
  return { page, context, requests }
}

try {
  for (const mobile of [false, true]) {
    const { page, context, requests } = await setup({ mobile })
    await page.getByRole('button', { name: /Клиент.*Расчёт дома/ }).click()
    await page.getByRole('heading', { name: 'Расчёт дома' }).waitFor()
    assert.equal(await page.locator('img[src*="tracker"]').count(), 0)
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: /План.pdf/ }).click()
    assert.equal((await download).suggestedFilename(), 'План.pdf')
    assert.ok(requests.find(r => r.path.endsWith('/attachments/2') && r.query.includes('uidvalidity=81') && r.auth === 'Bearer test-token'))
    await page.getByRole('button', { name: 'Более ранние письма' }).click()
    await page.getByRole('button', { name: /Клиент.*Расчёт дома/ }).nth(1).waitFor()
    assert.equal(requests.some(r => r.path.startsWith('/api/mail') && r.method !== 'GET'), false)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await context.close()
  }
  const disconnected = await setup({ configured: false })
  await disconnected.page.getByRole('heading', { name: 'Почтовый ящик ещё не подключён' }).waitFor()
  assert.equal(disconnected.requests.some(r => r.path === '/api/mail/messages'), false)
  await disconnected.context.close()
  const failed = await setup({ fail: true })
  await failed.page.getByRole('alert').waitFor()
  assert.ok((await failed.page.getByRole('alert').innerText()).includes('NIC.RU'))
  await failed.context.close()
  console.log('Shared mail: desktop, mobile, attachment authentication, read-only access, unconfigured and provider failure passed')
} finally { await browser.close() }
