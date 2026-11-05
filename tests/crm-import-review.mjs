import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
const base = 'http://127.0.0.1:4197'
const browser = await chromium.launch({ headless: true })
const report = { ok: false, synthetic_api: true, production_requests: 0, checks: [] }

async function setup(role = 'admin', mobile = false) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, serviceWorkers: 'block' })
  await context.addInitScript(() => {
    localStorage.setItem('soborbum.auth.token', 'synthetic-import-review-only')
    localStorage.setItem('soborbum.onboarding.crm', '1')
    window.WebSocket = class { static OPEN = 1; readyState = 0; close() {} send() {} }
  })
  const page = await context.newPage(), reads = [], writes = [], errors = []
  page.setDefaultTimeout(15000)
  page.on('pageerror', error => errors.push(error.message))
  const state = { failNext: false }
  const reviews = new Map([501, 601].map(id => [id, { source_digest: 'a'.repeat(64), content_digest: 'b'.repeat(64), review_id: null, disposition: 'unknown', current: false, public_data: {} }]))
  const card = { id: 101, name: 'Синтетическая карточка', kind: 'contact', data: { phone: '+79000000111' }, version: 1, archived: false }
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    if (url.origin !== base) return route.abort()
    if (!path.startsWith('/api/')) return route.continue()
    let body = [], status = 200
    if (request.method() === 'GET') reads.push(path)
    if (path === '/api/auth/me') body = { id: 6, full_name: 'Проверяющий', role, is_active: true, module_access: { clients: 'full', tasks: 'view' } }
    else if (path === '/api/crm/catalog') body = { pipelines: [], stages: [], users: [], counts: {} }
    else if (path === '/api/crm/entries/101') body = card
    else if (path === '/api/crm/entries') body = { total: url.searchParams.get('kind') === 'contact' ? 1 : 0, items: url.searchParams.get('kind') === 'contact' ? [card] : [] }
    else if (path.endsWith('/history')) body = { total: role === 'admin' ? 1 : 0, items: role === 'admin' ? [{ id: 'amo-stable-original-id', source_record_id: 501, source: 'amocrm', created_at: '2026-11-05T10:00:00Z', text: 'SYNTHETIC_PRIVATE_ORIGINAL', details: { note_type: 'common', params: { text: 'SYNTHETIC_PRIVATE_ORIGINAL' } } }] : [] }
    else if (path === '/api/crm/entries/101/files') body = { total: role === 'admin' ? 1 : 0, items: role === 'admin' ? [{ id: 601, name: 'Старый оригинал.txt', size: 40 }] : [] }
    else if (path === '/api/crm/files/601/download') return route.fulfill({ status: 200, contentType: 'text/plain', body: 'Synthetic business document' })
    else if (path.startsWith('/api/crm/import-reviews/')) {
      const id = Number(path.split('/').at(-1)), review = reviews.get(id)
      if (role !== 'admin') { status = 403; body = { detail: 'Нет доступа' } }
      else if (request.method() === 'POST') {
        const input = request.postDataJSON(); writes.push(input)
        if (state.failNext) { state.failNext = false; review.source_digest = 'c'.repeat(64); status = 409; body = { detail: 'Изменена версия' } }
        else {
          assert.equal(input.source_digest, review.source_digest)
          assert.equal(input.expected_review_id, review.review_id)
          Object.assign(review, { review_id: (review.review_id || 0) + 1, disposition: input.disposition, current: true,
            public_data: input.disposition === 'business' ? id === 501 ? { text: input.text } : { filename: input.filename } : {} })
          body = { review_id: review.review_id, disposition: review.disposition }
        }
      } else body = review
    } else if (path === '/api/notifications/unread-count') body = { unread_count: 0 }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(base + '/crm?tab=contact&entry=101')
  await page.getByRole('dialog', { name: card.name }).waitFor()
  await page.getByRole('button', { name: 'Редактировать', exact: true }).waitFor()
  return { context, page, reads, writes, errors, state }
}
try {
  await mkdir('test-results', { recursive: true })
  let t = await setup('worker')
  assert.equal(await t.page.getByRole('button', { name: /Проверить доступ к/ }).count(), 0)
  assert.equal(t.reads.filter(path => path.includes('/import-reviews/')).length, 0)
  assert.equal(t.writes.length, 0)
  assert.equal(t.errors.length, 0)
  report.checks.push('Manager sees no review controls and performs no review lookup or mutation')
  await t.context.close()

  t = await setup()
  assert.equal(t.reads.filter(path => path.includes('/import-reviews/')).length, 0)
  await t.page.getByRole('button', { name: 'Проверить доступ к заметке', exact: true }).click()
  let dialog = t.page.getByRole('dialog', { name: 'Доступ к старой заметке' })
  await dialog.getByText('Не проверено · содержимое закрыто', { exact: true }).waitFor()
  const allow = dialog.getByRole('button', { name: 'Разрешить для продаж', exact: true })
  assert.equal(await allow.isEnabled(), false)
  assert.equal(await dialog.getByLabel('Текст для продаж', { exact: false }).inputValue(), '')
  await dialog.getByLabel('Текст для продаж', { exact: false }).fill('Согласовали рабочую планировку')
  assert.equal(await allow.isEnabled(), false)
  await dialog.getByLabel(/^Я проверил содержимое:/).check()
  await allow.click()
  await dialog.getByText('Проверено · разрешение сохранено', { exact: true }).waitFor()
  assert.equal(t.writes.length, 1)
  assert.equal(t.writes[0].text, 'Согласовали рабочую планировку')
  assert.ok(!JSON.stringify(t.writes).includes('SYNTHETIC_PRIVATE_ORIGINAL'))
  await dialog.getByRole('button', { name: 'Закрыть доступ', exact: true }).click()
  await dialog.getByText('Закрыто для продаж', { exact: true }).waitFor()
  assert.equal(t.writes[1].disposition, 'restricted')
  await dialog.getByRole('button', { name: 'Готово', exact: true }).click()
  await t.page.getByText('SYNTHETIC_PRIVATE_ORIGINAL', { exact: true }).waitFor()
  assert.equal(t.errors.length, 0)
  report.checks.push('Admin explicitly approves a separate safe note projection, can revoke it, and the original stays intact')
  await t.context.close()

  t = await setup('admin', true)
  await t.page.getByRole('button', { name: 'Проверить доступ к файлу Старый оригинал.txt', exact: true }).click()
  dialog = t.page.getByRole('dialog', { name: 'Доступ к старому файлу' })
  await dialog.getByText('Не проверено · содержимое закрыто', { exact: true }).waitFor()
  assert.ok(!t.reads.some(path => path.includes('/download')))
  await dialog.getByLabel('Название файла для продаж', { exact: false }).fill('Рабочая планировка.txt')
  await dialog.getByLabel(/^Я проверил содержимое:/).check()
  t.state.failNext = true
  await dialog.getByRole('button', { name: 'Разрешить для продаж', exact: true }).click()
  await dialog.getByRole('alert').filter({ hasText: 'Запись или файл изменились.' }).waitFor()
  assert.equal(await dialog.getByRole('button', { name: 'Разрешить для продаж', exact: true }).isEnabled(), false)
  assert.equal(await dialog.getByLabel(/^Я проверил содержимое:/).isChecked(), false)
  await dialog.getByRole('button', { name: 'Обновить версию для проверки', exact: true }).click()
  await dialog.getByRole('button', { name: 'Закрыть доступ', exact: true }).waitFor()
  await dialog.getByLabel(/^Я проверил содержимое:/).check()
  await dialog.getByRole('button', { name: 'Разрешить для продаж', exact: true }).click()
  await dialog.getByText('Проверено · разрешение сохранено', { exact: true }).waitFor()
  assert.equal(t.writes.at(-1).source_digest, 'c'.repeat(64))
  assert.equal(t.writes.at(-1).content_digest, 'b'.repeat(64))
  assert.equal(t.writes.at(-1).filename, 'Рабочая планировка.txt')
  assert.ok(await t.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await t.page.screenshot({ path: 'test-results/crm-import-review-mobile.png' })
  assert.equal(t.errors.length, 0)
  report.checks.push('File approval requires explicit check; stale version blocks retry until refresh and renewed confirmation; mobile fits')
  await t.context.close()
  report.ok = true
} catch (error) { report.error = String(error.stack || error); process.exitCode = 1 }
finally { await browser.close(); await writeFile('test-results/crm-import-review.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)) }
