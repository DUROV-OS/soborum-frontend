import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5181'
const output = process.env.MAX_TEST_OUTPUT ?? '../max-ui-proof'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const user = { id: 1, full_name: 'Владелец', email: 'owner@example.test', role: 'admin', job_role: 'director', is_active: true, module_access: {} }
try {
  for (const width of [1366, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    await context.addInitScript(() => {
      localStorage.setItem('soborbum.auth.token', 'synthetic-token')
      localStorage.setItem('soborbum.onboarding.admin', '1')
    })
    const page = await context.newPage()
    let connection = { state: 'reauth_required', persistent_session: true, automatic_reconnect: true }
    let attempt = null, starts = 0, confirms = 0
    const sends = []
    const qr = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN9sAAAAASUVORK5CYII='
    await page.route('**/api/**', async route => {
      const { pathname } = new URL(route.request().url())
      const method = route.request().method()
      let body = [], status = 200
      if (pathname === '/api/auth/me') body = user
      else if (pathname === '/api/auth/users') body = [user]
      else if (pathname === '/api/max/connection') body = connection
      else if (pathname === '/api/max/connection/check') body = connection
      else if (pathname === '/api/max/connection/qr' && method === 'POST') {
        starts++
        attempt = { id: route.request().postDataJSON().request_id, phase: 'waiting', expires_at: Date.now() / 1000 + 300, qr_image: qr }
        body = attempt
      } else if (pathname === `/api/max/connection/qr/${attempt?.id}/password`) {
        assert.equal(route.request().postDataJSON().password, 'synthetic-password')
        attempt = { ...attempt, phase: 'confirm_account', qr_image: null, account_id: '101', account_name: 'Компания' }
        body = attempt
      } else if (pathname === `/api/max/connection/qr/${attempt?.id}/confirm`) {
        confirms++
        connection = { ...connection, state: 'connected', account_name: 'Компания', account_id: '101' }
        attempt = { ...attempt, phase: 'complete', qr_image: null }
        body = attempt
      } else if (pathname === `/api/max/connection/qr/${attempt?.id}`) {
        if (method === 'DELETE') attempt = { ...attempt, phase: 'cancelled', qr_image: null }
        body = attempt
      } else if (/max.*messages|telephony.*call/.test(pathname) && method === 'POST') { sends.push(pathname); status = 500 }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    })
    await page.goto(base + '/admin')
    const panel = page.getByRole('region', { name: 'Подключение MAX' })
    await panel.getByText('Нужно подтвердить вход', { exact: true }).waitFor()
    assert.equal(starts, 0)
    await panel.getByRole('button', { name: 'Подключить по QR', exact: true }).click()
    await panel.getByRole('img', { name: 'QR-код входа в рабочий аккаунт MAX' }).waitFor()
    assert.equal(starts, 1)
    await panel.screenshot({ path: `${output}/max-qr-${width}.png` })
    assert.ok(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1))
    attempt = { ...attempt, phase: 'password_required', qr_image: null }
    const password = panel.getByLabel('Пароль входа MAX')
    await password.waitFor()
    await password.fill('synthetic-password')
    await panel.getByRole('button', { name: 'Подтвердить пароль' }).click()
    await panel.getByRole('button', { name: 'Подключить этот рабочий аккаунт' }).waitFor()
    assert.equal(confirms, 0)
    assert.equal(await page.evaluate(() => JSON.stringify(localStorage).includes('synthetic-password')), false)
    await panel.getByRole('button', { name: 'Подключить этот рабочий аккаунт' }).dblclick()
    await panel.getByText('Рабочий аккаунт подключён', { exact: true }).waitFor()
    assert.equal(confirms, 1)
    await panel.screenshot({ path: `${output}/max-connected-${width}.png` })
    await page.reload()
    await panel.getByRole('status').getByText('Подключён', { exact: true }).waitFor()
    assert.equal(starts, 1)
    await panel.getByRole('button', { name: 'Повторный вход по QR' }).click()
    await panel.getByRole('img', { name: 'QR-код входа в рабочий аккаунт MAX' }).waitFor()
    attempt = { ...attempt, phase: 'expired', qr_image: null }
    await panel.getByText('Обновляем QR-код автоматически…', { exact: true }).waitFor()
    await panel.getByRole('img', { name: 'QR-код входа в рабочий аккаунт MAX' }).waitFor()
    assert.equal(starts, 3)
    attempt = { ...attempt, phase: 'verifying', qr_image: null }
    await panel.getByText('Вход подтверждён на телефоне. Проверяем аккаунт…', { exact: true }).waitFor()
    attempt = { ...attempt, phase: 'expired', qr_image: null }
    await panel.getByText('Срок QR-кода истёк. Получите новый код.', { exact: true }).waitFor()
    await page.waitForTimeout(2200)
    assert.equal(starts, 3) // Phone approval stops renewal even if the later step expires.
    await panel.getByRole('button', { name: 'Повторный вход по QR' }).click()
    await panel.getByRole('img', { name: 'QR-код входа в рабочий аккаунт MAX' }).waitFor()
    await panel.getByRole('button', { name: 'Отменить подключение', exact: true }).click()
    await panel.getByText('Подключение отменено', { exact: true }).waitFor()
    await page.waitForTimeout(2200)
    assert.equal(starts, 4)
    assert.deepEqual(sends, [])
    await context.close()
    console.log(`MAX connection: ${width}px, owner confirmation, password cleared, no automatic sends: PASS`)
  }
  const context = await browser.newContext()
  await context.addInitScript(() => { localStorage.setItem('soborbum.auth.token', 'synthetic-token'); localStorage.setItem('soborbum.onboarding.admin', '1') })
  const page = await context.newPage()
  let maxRequests = 0
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.startsWith('/api/max/connection')) maxRequests++
    const administrator = { ...user, job_role: 'manager' }
    const body = path === '/api/auth/me' ? administrator : path === '/api/auth/users' ? [administrator] : []
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(base + '/admin')
  await page.getByRole('heading', { name: 'Доступ', exact: true }).waitFor()
  assert.equal(await page.getByRole('region', { name: 'Подключение MAX' }).count(), 0)
  assert.equal(maxRequests, 0)
  await context.close()
  console.log('MAX connection: non-director administrator cannot see or load QR settings: PASS')
} finally { await browser.close() }
