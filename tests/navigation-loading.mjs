// Exercise the production build: dev-server imports cannot prove route splitting.
import assert from 'node:assert/strict'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5195'
const output = process.env.SMOKE_ARTIFACT_DIR || 'test-results/navigation-loading'
await mkdir(output, { recursive: true })
const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'))
const entry = manifest['index.html']
assert.ok(entry?.isEntry)
const entryBytes = (await stat(path.join('dist', entry.file))).size
assert.ok(entryBytes < 250_000, 'Entry must not eagerly bundle every screen')
const browser = await chromium.launch({ headless: true })
const report = { entryBytes, checks: [] }
const owner = { id: 1, full_name: 'Проверка навигации', email: 'owner@example.test', role: 'admin', module_access: {}, is_active: true }

async function session({ mobile = false, actor = owner, authenticated = true } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
  if (authenticated) await context.addInitScript(() => localStorage.setItem('soborbum.auth.token', 'synthetic-navigation'))
  const page = await context.newPage(), scripts = new Set(), writes = [], apiPaths = []
  page.on('request', request => { if (new URL(request.url()).pathname.endsWith('.js')) scripts.add(new URL(request.url()).pathname) })
  await context.route('**/api/**', async route => {
    const request = route.request(), pathname = new URL(request.url()).pathname
    apiPaths.push(pathname)
    if (request.method() !== 'GET') { writes.push(pathname); await route.abort(); return }
    let body = []
    if (pathname === '/api/auth/me') body = actor
    else if (pathname === '/api/auth/me/workspace') body = null
    else if (pathname === '/api/notifications/unread-count') body = { count: 0 }
    else if (pathname.startsWith('/api/dashboard/today/section/')) body = { action: null, checked: false, clear_text: null, agent_note: null }
    else if (pathname === '/api/dashboard/today') body = { generated_at: new Date().toISOString(), widgets: [], actions: [], summary: '', source: 'database' }
    else if (pathname === '/api/dashboard/aktualnoe') body = { items: [], degraded: false }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
  return { context, page, scripts, writes, apiPaths }
}
async function menuLink(page, mobile, name) {
  if (mobile) await page.getByRole('button', { name: 'Открыть меню', exact: true }).click()
  return page.getByRole(mobile ? 'dialog' : 'complementary', { name: 'Главное меню' }).getByRole('link', { name, exact: true })
}

try {
  for (const mobile of [false, true]) {
    const { context, page, scripts, writes } = await session({ mobile })
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto(base + '/work', { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'Работа', exact: true }).waitFor()
    assert.ok(![...scripts].some(url => /(?:AccountingPage|WarehousePage|CrmPage|CostingPage)-/.test(url)), 'Unopened screens must not download')
    const initialJsBytes = (await Promise.all([...scripts].filter(url => url.startsWith('/assets/')).map(async url => (await stat(path.join('dist', url.slice(1)))).size))).reduce((a, b) => a + b, 0)
    const initialJsRequests = scripts.size
    assert.ok(initialJsBytes < 800_000, 'First workspace must load substantially less than the previous 1.69 MB bundle')
    await page.locator('#main-content').evaluate(el => { window.navigationShell = el; window.navigationPhone = document.querySelector('audio') })
    if (mobile) {
      const open = page.getByRole('button', { name: 'Открыть меню', exact: true })
      const menu = page.getByRole('dialog', { name: 'Главное меню' })
      assert.equal(await page.locator('#main-navigation').evaluate(el => el.inert), true)
      await open.click()
      await menu.waitFor()
      assert.equal(await open.getAttribute('aria-expanded'), 'true')
      assert.equal(await page.locator('#main-content').evaluate(el => el.parentElement.inert), true)
      await page.keyboard.press('Shift+Tab')
      assert.ok(await menu.evaluate(el => el.contains(document.activeElement)))
      await page.keyboard.press('Tab')
      assert.ok(await menu.evaluate(el => el.contains(document.activeElement)))
      await page.screenshot({ path: path.join(output, 'mobile-menu.png') })
      await page.keyboard.press('Escape')
      await menu.waitFor({ state: 'hidden' })
      assert.ok(await open.evaluate(el => el === document.activeElement), 'Escape returns focus to the menu button')
      assert.equal(await page.locator('#main-content').evaluate(el => el.parentElement.inert), false)
      await open.click()
      await page.mouse.click(370, 400)
      await menu.waitFor({ state: 'hidden' })
      await open.click()
      await page.setViewportSize({ width: 1440, height: 1000 })
      await page.getByRole('complementary', { name: 'Главное меню' }).waitFor()
      assert.equal(await page.locator('#main-content').evaluate(el => el.parentElement.inert), false)
      assert.equal(await page.evaluate(() => document.body.style.overflow), '')
      await page.setViewportSize({ width: 390, height: 844 })
      await menu.waitFor({ state: 'hidden' })
    }
    let release
    const delayed = new Promise(resolve => { release = resolve })
    await context.route('**/assets/MyFeedbackPage-*.js', async route => { await delayed; await route.continue() })
    await (await menuLink(page, mobile, 'Мои заявки')).click()
    await page.getByRole('status').filter({ hasText: 'Открываем раздел…' }).waitFor()
    assert.ok(await page.locator('#main-content').evaluate(el => el === window.navigationShell), 'Shell survives loading')
    await page.screenshot({ path: path.join(output, `loading-${mobile ? 'mobile' : 'desktop'}.png`) })
    release()
    await page.getByRole('heading', { name: 'Мои заявки', exact: true }).waitFor()
    await page.getByRole('status').filter({ hasText: 'Открываем раздел…' }).waitFor({ state: 'hidden' })
    assert.ok(await page.evaluate(() => document.querySelector('audio') === window.navigationPhone), 'Phone must stay mounted across routes')
    await page.goBack()
    await page.getByRole('heading', { name: 'Работа', exact: true }).waitFor()
    await page.goForward()
    await page.getByRole('heading', { name: 'Мои заявки', exact: true }).waitFor()
    await page.reload()
    await page.getByRole('heading', { name: 'Мои заявки', exact: true }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    assert.deepEqual(writes, []); assert.deepEqual(errors, [])
    report.checks.push({ mobile, initialJsBytes, initialJsRequests, result: 'passed' })
    await context.close()
  }
  // Failed chunks must leave navigation usable and recover after an explicit reload.
  {
    const { context, page } = await session()
    let fail = true
    await context.route('**/assets/MyFeedbackPage-*.js', route => fail ? route.abort() : route.continue())
    await page.goto(base + '/work')
    await (await menuLink(page, false, 'Мои заявки')).click()
    await page.getByRole('alert').getByRole('heading', { name: 'Не удалось открыть раздел' }).waitFor()
    await page.screenshot({ path: path.join(output, 'load-error.png') })
    await (await menuLink(page, false, 'Работа')).click()
    await page.getByRole('heading', { name: 'Работа', exact: true }).waitFor()
    await (await menuLink(page, false, 'Мои заявки')).click()
    await page.getByRole('alert').waitFor()
    fail = false
    await page.getByRole('button', { name: 'Обновить страницу', exact: true }).click()
    await page.getByRole('heading', { name: 'Мои заявки', exact: true }).waitFor()
    assert.equal(new URL(page.url()).pathname, '/feedback/my')
    report.checks.push({ failedChunk: 'navigation and explicit reload passed' })
    await context.close()
  }
  {
    const { context, page, scripts, apiPaths } = await session({ actor: { ...owner, role: 'worker', job_role: 'storekeeper', module_access: { warehouse: 'view' } } })
    await page.goto(base + '/accounting', { waitUntil: 'networkidle' })
    await page.getByText('Доступ ограничен', { exact: true }).waitFor()
    assert.ok(![...scripts].some(url => /AccountingPage-/.test(url)))
    assert.ok(!apiPaths.some(url => url.startsWith('/api/accounting/')))
    report.checks.push({ deniedRoute: 'page code and data not requested' })
    await context.close()
  }
  {
    const { context, page, scripts } = await session({ authenticated: false })
    await page.goto(base + '/warehouse', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Войти', exact: true }).waitFor()
    assert.equal(new URL(page.url()).pathname, '/login')
    assert.ok(![...scripts].some(url => /(?:AppShell|WarehousePage)-/.test(url)))
    report.checks.push({ anonymous: 'login only' })
    await context.close()
  }
  await writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
} finally { await browser.close() }
