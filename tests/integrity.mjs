import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const baseURL = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5178'
const output = process.env.TEST_SCREENSHOT_DIR ?? '../../output/integrity-20261109'
const browser = await chromium.launch({ headless: true })
const checkpoint = { format: 'durov-integrity-v1', sequence: 17, event_hash: 'a'.repeat(64), genesis_hash: 'b'.repeat(64) }
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
await context.addInitScript(() => localStorage.setItem('soborbum.auth.token', 'test-token'))
const page = await context.newPage()
let state = 'consistent', role = 'admin', writes = 0
const errors = []
page.on('pageerror', e => errors.push(e.message))
await page.route('**/api/**', async route => {
  const req = route.request(), path = new URL(req.url()).pathname
  let body = [], status = 200
  if (path === '/api/auth/me') body = { id: 1, full_name: 'Руководитель', email: 'director@synthetic.invalid', role, job_role: role === 'admin' ? 'director' : 'accountant', is_active: true, module_access: {} }
  else if (path === '/api/integrity/verify') {
    assert.equal(req.method(), 'POST')
    body = { state, checked_events: 17, checkpoint: state === 'consistent' ? checkpoint : undefined,
      independent_checkpoint: req.postData() ? 'matches_supplied_checkpoint' : 'not_provided',
      protection: { state: 'active', covered_tables: Array.from({ length: 46 }, (_, i) => String(i)), missing_controls: [] } }
  } else if (path === '/api/integrity/events') body = { items: [
    { sequence: 17, entity: 'money_movements', entity_key: '{"id": 42}', action: 'UPDATE', actor: { id: 4, name: 'Бухгалтер' }, occurred_at: '2026-11-09T12:30:00Z', references: [{ table: 'file_assets', value: 9 }] },
    { sequence: 16, entity: 'file_assets', entity_key: '{"id": 9}', action: 'INSERT', actor: { id: 4, name: 'Бухгалтер' }, occurred_at: '2026-11-09T12:29:00Z', references: [] },
    { sequence: 1, entity: 'ledger', entity_key: 'genesis', action: 'START', actor: { kind: 'schema_migration' }, references: [] },
  ], next_before: null }
  else if (req.method() !== 'GET') writes++
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
})
try {
  await page.goto(baseURL + '/integrity')
  await page.getByText('Нарушений цепочки не найдено', { exact: true }).waitFor()
  await page.getByText('Без неё нельзя исключить полную замену истории на сервере.', { exact: false }).waitFor()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Сохранить контрольную отметку' }).click()
  assert.equal((await downloadPromise).suggestedFilename(), 'durov-history-17.json')
  await page.getByLabel('Загрузить контрольную отметку').setInputFiles({ name: 'prior.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(checkpoint)) })
  await page.getByText('Совпадает с загруженной отметкой №17.').waitFor()
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: output + '/desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(400) // Let the desktop sidebar finish its responsive exit transition.
  await page.screenshot({ path: output + '/mobile.png', fullPage: true })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile must not scroll horizontally')
  state = 'checkpoint_mismatch'
  await page.getByRole('button', { name: 'Проверить историю', exact: true }).click()
  await page.getByText('Сохранённая ранее отметка не совпадает с текущей историей.').waitFor()
  assert.equal(await page.getByRole('button', { name: 'Сохранить контрольную отметку' }).count(), 0)
  await page.getByLabel('Загрузить контрольную отметку').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"fake"}') })
  await page.getByRole('alert').filter({ hasText: 'Формат контрольной отметки не распознан.' }).waitFor()
  role = 'worker'
  await page.reload()
  await page.getByText('Доступ ограничен', { exact: true }).waitFor()
  assert.equal(await page.getByRole('heading', { name: 'История и подтверждения' }).count(), 0)
  assert.equal(writes, 0)
  assert.deepEqual(errors, [])
  console.log('Integrity UI: checkpoint export/comparison, tamper/error states, mobile overflow and role gate passed.')
} finally { await browser.close() }
