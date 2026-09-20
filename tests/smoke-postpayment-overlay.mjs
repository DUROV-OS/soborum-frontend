// Regression smoke for 0068: the payment -> postpayment transition triggers a
// synchronous AI plan generation on the backend (OCR + Claude over the client's
// КР) that can take noticeably longer than the other, instant stage transitions.
// This checks the waiting overlay appears ONLY for that specific transition, and
// disappears both on success and on error. Fully synthetic fixtures — no real
// backend, no real AI provider, no company data.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const baseURL = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5173'
const artifactDir = process.env.SMOKE_ARTIFACT_DIR ?? 'test-results'
await mkdir(artifactDir, { recursive: true })
const browser = await chromium.launch({ headless: true })
const errors = []
const checks = []

const admin = {
  id: 1, email: 'owner@example.test', full_name: 'Руководитель', role: 'admin',
  module_access: ['clients'], is_active: true, created_at: '2026-09-05T08:00:00Z',
}

function baseClient(overrides) {
  return {
    id: 1, cycle_id: 1, created_at: '2026-08-01T08:00:00Z',
    full_name: 'Тестовый Клиент', phone: '+7 900 000-00-00', email: 'client@example.test',
    contacts: [], chat_links: [], order_type: 'single', house_model_key: null, house_model: null,
    houses_count: 1, final_price: 3000000, installation_address: null,
    payment_plan: 'post_payment', advance_amount: null,
    contract_file: null, contract_appendix_file: null, house_project_file: null,
    ar_file: null, kr_file: { id: 1, filename: 'kr.pdf', content_type: 'application/pdf', purpose: 'kr', uploaded_by_id: 1, created_at: '2026-08-01T08:00:00Z' },
    documents_locked_at: '2026-08-01T08:00:00Z', is_paid: true, payment_locked_at: null,
    payment_edit_unlocked: false, balance_paid: null, balance_paid_at: null, notes: [],
    ...overrides,
  }
}

// Client A: stage 'lead' -> handleAdvance goes to 'discussion' (an ordinary, non-AI
// transition). Its /transition mock is deliberately delayed too, so the assertion
// that the overlay never appears is a real check of the `next === 'postpayment'`
// condition, not just an artifact of the response being fast.
const leadClient = baseClient({ id: 11, cycle_id: 11, stage: 'lead', full_name: 'Лид Клиентов' })

// Client B: stage 'payment' -> handleAdvance goes to 'postpayment' (the slow,
// AI-plan transition). Resolves successfully after a delay.
const paymentClient = baseClient({ id: 12, cycle_id: 12, stage: 'payment', full_name: 'Оплата Клиентова' })

// Client C: same transition, but the backend call fails (e.g. AI/OCR timeout) —
// the overlay must close and the existing error text must still render.
const errorClient = baseClient({ id: 13, cycle_id: 13, stage: 'payment', full_name: 'Ошибка Клиентова' })

const TRANSITION_DELAY_MS = 500

async function openAs(user, route) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await context.addInitScript(() => {
    localStorage.setItem('soborbum.auth.token', 'browser-test-token')
    for (const id of ['clients']) localStorage.setItem(`soborbum.onboarding.${id}`, '1')
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort())
  await page.route('https://fonts.gstatic.com/**', (r) => r.abort())
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    let body
    let status = 200
    if (url.pathname === '/api/auth/me') body = user
    else if (url.pathname === '/api/clients/' && method === 'GET') {
      body = [leadClient, paymentClient, errorClient]
    } else if (url.pathname === `/api/clients/${leadClient.id}` && method === 'GET') body = leadClient
    else if (url.pathname === `/api/clients/${paymentClient.id}` && method === 'GET') body = paymentClient
    else if (url.pathname === `/api/clients/${errorClient.id}` && method === 'GET') body = errorClient
    else if (url.pathname === `/api/clients/${leadClient.id}/transition` && method === 'POST') {
      await new Promise((resolve) => setTimeout(resolve, TRANSITION_DELAY_MS))
      leadClient.stage = 'discussion'
      body = leadClient
    } else if (url.pathname === `/api/clients/${paymentClient.id}/transition` && method === 'POST') {
      await new Promise((resolve) => setTimeout(resolve, TRANSITION_DELAY_MS))
      paymentClient.stage = 'postpayment'
      body = paymentClient
    } else if (url.pathname === `/api/clients/${errorClient.id}/transition` && method === 'POST') {
      await new Promise((resolve) => setTimeout(resolve, TRANSITION_DELAY_MS))
      status = 400
      body = { detail: 'ИИ не смог разобрать КР: превышено время ожидания' }
    } else {
      status = 404
      body = { detail: `Unmocked request: ${url.pathname}` }
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(baseURL + route)
  return { page, context }
}

const overlayText = 'ИИ формирует план работ по КР'

try {
  // 1. Ordinary transition (lead -> discussion): overlay must never appear, even
  // though the mocked request takes just as long as the AI one.
  const lead = await openAs(admin, `/clients/${leadClient.id}`)
  await lead.page.getByRole('heading', { name: 'Лид Клиентов' }).waitFor()
  const leadButton = lead.page.getByRole('button', { name: 'Перевести на «Обсуждение»' })
  await leadButton.click()
  await lead.page.getByRole('button', { name: 'Переход…' }).waitFor()
  assert.equal(await lead.page.getByText(overlayText).count(), 0)
  await lead.page.waitForTimeout(TRANSITION_DELAY_MS / 2)
  assert.equal(await lead.page.getByText(overlayText).count(), 0, 'overlay must not appear mid-flight for a non-AI transition')
  await lead.page.getByRole('button', { name: 'Перевести на «Согласование»' }).waitFor()
  checks.push('lead -> discussion transition never shows the AI plan overlay')
  await lead.context.close()

  // 2. payment -> postpayment, success: overlay appears while in flight, and is
  // gone once the transition completes and the stepper reflects the new stage.
  const payment = await openAs(admin, `/clients/${paymentClient.id}`)
  await payment.page.getByRole('heading', { name: 'Оплата Клиентова' }).waitFor()
  await payment.page.getByRole('button', { name: 'Перевести на «Постоплата»' }).click()
  await payment.page.getByText(overlayText, { exact: false }).waitFor()
  assert.equal(await payment.page.getByRole('button', { name: 'Переход…' }).isDisabled(), true)
  checks.push('payment -> postpayment shows the AI plan overlay while the request is in flight')
  await payment.page.getByText(overlayText, { exact: false }).waitFor({ state: 'detached' })
  assert.equal(await payment.page.getByRole('button', { name: /Перевести на/ }).count(), 0)
  checks.push('AI plan overlay disappears once the transition completes (no further stage to advance to)')
  await payment.context.close()

  // 3. payment -> postpayment, backend error: overlay must close and the existing
  // error text must still render under the button.
  const errored = await openAs(admin, `/clients/${errorClient.id}`)
  await errored.page.getByRole('heading', { name: 'Ошибка Клиентова' }).waitFor()
  const errorButton = errored.page.getByRole('button', { name: 'Перевести на «Постоплата»' })
  await errorButton.click()
  await errored.page.getByText(overlayText, { exact: false }).waitFor()
  await errored.page.getByText('ИИ не смог разобрать КР: превышено время ожидания', { exact: false }).waitFor()
  assert.equal(await errored.page.getByText(overlayText).count(), 0, 'overlay must close on request error')
  assert.equal(await errorButton.isDisabled(), false)
  checks.push('AI plan overlay closes on request error and the existing error text still renders')
  await errored.context.close()

  assert.deepEqual(errors, [])
  console.log(checks.map((text, index) => `${index + 1}. PASS ${text}`).join('\n'))
  console.log(`PASS ${checks.length} browser checks; no uncaught page errors. Fixtures are synthetic.`)
} finally {
  await browser.close()
}
