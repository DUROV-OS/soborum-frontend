// All identities and API responses are synthetic. No SMS, AI, or production writes.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const baseURL = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:4175'
const browser = await chromium.launch({ headless: true })
const errors = []
await mkdir('test-results', { recursive: true })

async function context(options = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...options })
  await ctx.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '' }))
  const page = await ctx.newPage()
  page.on('pageerror', error => errors.push(error.message))
  return { ctx, page }
}

try {
  const { ctx, page } = await context({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' })
  await page.goto(baseURL + '/login')
  await page.getByRole('button', { name: 'Установить приложение', exact: true }).click()
  await page.getByRole('region', { name: 'Установка Durov OS' }).waitFor()
  assert.match(await page.getByRole('region').innerText(), /Safari/)
  assert.match(await page.getByRole('region').innerText(), /На экран Домой/)
  assert.equal(await page.locator('input[type=email]').evaluate(el => getComputedStyle(el).fontSize), '16px')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: 'test-results/mobile-install-iphone.png', fullPage: true })

  const manifest = await (await ctx.request.get(baseURL + '/manifest.webmanifest')).json()
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.start_url, '/')
  for (const icon of manifest.icons) {
    const response = await ctx.request.get(baseURL + icon.src)
    assert.equal(response.status(), 200)
    const bytes = await response.body()
    assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`, icon.sizes)
  }
  await page.evaluate(() => navigator.serviceWorker.ready)
  assert.equal(await page.evaluate(async () => (await caches.keys()).length), 0)
  await ctx.close()

  const android = await context()
  await android.page.goto(baseURL + '/login')
  // Exercise the browser event contract; an emulator does not install a real OS app.
  await android.page.evaluate(() => {
    window.installCalls = 0
    const event = new Event('beforeinstallprompt', { cancelable: true })
    event.prompt = async () => { window.installCalls++ }
    event.userChoice = Promise.resolve({ outcome: 'dismissed' })
    window.dispatchEvent(event)
  })
  await android.page.getByRole('button', { name: 'Установить приложение', exact: true }).click()
  await android.page.waitForFunction(() => window.installCalls === 1)
  await android.page.getByRole('button', { name: 'Установить приложение', exact: true }).click()
  await android.page.getByRole('region', { name: 'Установка Durov OS' }).waitFor()
  assert.equal(await android.page.evaluate(() => window.installCalls), 1)
  await android.page.evaluate(() => window.dispatchEvent(new Event('appinstalled')))
  await android.page.getByRole('button', { name: 'Установить приложение', exact: true }).waitFor({ state: 'hidden' })
  await android.ctx.close()

  const standalone = await context()
  await standalone.ctx.addInitScript(() => {
    const original = window.matchMedia.bind(window)
    window.matchMedia = query => {
      const result = original(query)
      return query === '(display-mode: standalone)' ? new Proxy(result, {
        get(target, key) {
          if (key === 'matches') return true
          const value = Reflect.get(target, key, target)
          return typeof value === 'function' ? value.bind(target) : value
        },
      }) : result
    }
  })
  await standalone.page.goto(baseURL + '/login')
  await standalone.page.getByRole('button', { name: 'Войти', exact: true }).waitFor()
  assert.equal(await standalone.page.getByRole('button', { name: 'Установить приложение', exact: true }).count(), 0)
  await standalone.ctx.close()

  const signedIn = await context()
  await signedIn.ctx.addInitScript(() => {
    localStorage.setItem('soborbum.auth.token', 'synthetic-token')
    window.permissionCalls = 0
    Notification.requestPermission = async () => { window.permissionCalls++; return 'denied' }
  })
  await signedIn.ctx.route('**/api/**', route => {
    const pathname = new URL(route.request().url()).pathname
    const body = pathname === '/api/auth/me'
      ? { id: 2, full_name: 'Тестовый сотрудник', email: 'worker@example.test', role: 'worker', is_active: true, module_access: {} }
      : pathname === '/api/dashboard/today' ? { widgets: [], actions: [], summary: '' }
        : pathname === '/api/dashboard/aktualnoe' ? { items: [], degraded: false }
          : pathname === '/api/auth/me/workspace' ? null : []
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
  await signedIn.page.goto(baseURL + '/today')
  await signedIn.page.getByRole('button', { name: 'Открыть меню' }).click()
  await signedIn.page.getByRole('button', { name: 'Установить приложение', exact: true }).waitFor({ state: 'visible' })
  assert.equal(await signedIn.page.evaluate(() => window.permissionCalls), 0)
  await signedIn.ctx.close()
  assert.deepEqual(errors, [])
  console.log('Passed: manifest/icons, iPhone guide/viewport, one-shot install prompt, standalone mode, worker without caches, install after login, no unsolicited push permission.')
} finally {
  await browser.close()
}
