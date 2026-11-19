import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true, channel: process.env.SMOKE_BROWSER_CHANNEL || 'msedge' })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
await context.addInitScript(() => { localStorage.setItem('soborbum.auth.token', 'synthetic-drive-test'); localStorage.setItem('soborbum.onboarding.chats', '1') })
const page = await context.newPage(), errors = [], mutations = []
page.on('pageerror', e => errors.push(e.message))
const revision = { id: 'r1', number: 1, filename: 'Смета.pdf', size: 4096, sha256: 'a'.repeat(64), media_type: 'application/pdf', author: 'Анна', created_at: '2026-11-18T09:00:00Z' }
let row = { id: 'f1', name: 'Смета.pdf', scope: 'personal', folder_id: null, folder_name: null, owner: 'Анна', version: 1, deleted: false, can_edit: true, updated_at: '2026-11-18T09:00:00Z', revision }
let failRename = false, uploaded = false
await page.route('**/api/**', async route => {
  const url = new URL(route.request().url()), path = url.pathname, method = route.request().method()
  let body = [], status = 200
  if (path === '/api/auth/me') body = { id: 1, full_name: 'Анна', email: 'test@example.test', role: 'worker', job_role: 'sales_manager', is_active: true, module_access: { crm: 'edit' } }
  else if (path === '/api/notifications/unread-count') body = { count: 0 }
  else if (path === '/api/drive/folders') {
    if (method === 'POST') { body = { id: 'folder1', name: route.request().postDataJSON().name }; mutations.push('folder') }
    else body = [{ id: 'folder1', name: 'Договоры', scope: url.searchParams.get('scope'), version: 1, can_edit: true }]
  } else if (path === '/api/drive/files') {
    if (method === 'POST') { uploaded = true; body = row; mutations.push('upload') }
    else { const company = url.searchParams.get('scope') === 'company', trash = url.searchParams.get('trash') === 'true', q = url.searchParams.get('q'); const items = trash === row.deleted && !q ? [{ ...row, scope: company ? 'company' : 'personal', can_edit: !company }] : []; body = { items, total: items.length, offset: 0, limit: 50 } }
  } else if (path.endsWith('/history')) body = { file: row, versions: [revision], history_verified: true, changes: [{ id: 1, action: 'upload', actor: 'Анна', at: revision.created_at, details: {} }] }
  else if (path.endsWith('/name')) {
    if (failRename) { status = 409; body = { detail: 'Файл уже изменён другим пользователем. Обновите список.' } }
    else { row = { ...row, name: route.request().postDataJSON().name, version: row.version + 1 }; body = row; mutations.push('rename') }
  } else if (path.endsWith('/trash') || path.endsWith('/restore')) { row = { ...row, deleted: path.endsWith('/trash'), version: row.version + 1 }; body = row; mutations.push(row.deleted ? 'trash' : 'restore') }
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
})
await mkdir('test-results/drive', { recursive: true })
try {
  await page.goto((process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5184') + '/drive')
  await page.getByRole('heading', { name: 'Диск', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Смета.pdf', exact: true }).waitFor()
  assert.equal(await page.getByRole('navigation', { name: 'Разделы совместной работы' }).getByRole('link', { name: 'Диск', exact: true }).count(), 1)
  await page.getByRole('button', { name: 'Новая папка', exact: true }).click()
  await page.getByLabel('Название', { exact: true }).fill('Проекты')
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await page.getByText('Папка создана', { exact: true }).waitFor()
  await page.getByLabel('Файлы для загрузки').setInputFiles({ name: 'Смета.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') })
  await page.getByText('Загружено файлов: 1', { exact: true }).waitFor(); assert(uploaded)
  await page.getByRole('button', { name: 'История Смета.pdf', exact: true }).click()
  await page.getByText('Сохранённые версии', { exact: true }).waitFor()
  await page.screenshot({ path: 'test-results/drive/history.png' })
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
  await page.getByRole('button', { name: 'Переименовать Смета.pdf', exact: true }).click()
  await page.getByLabel('Название', { exact: true }).fill('Договор.pdf')
  failRename = true; await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await page.getByRole('dialog').getByRole('alert').waitFor()
  assert.equal(row.name, 'Смета.pdf')
  failRename = false; await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await page.getByRole('button', { name: 'Договор.pdf', exact: true }).waitFor()
  await page.getByRole('button', { name: 'В корзину Договор.pdf', exact: true }).click()
  assert.equal(mutations.includes('trash'), false)
  await page.getByRole('dialog').getByRole('button', { name: 'В корзину', exact: true }).click()
  await page.getByText('Здесь пока нет файлов', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Корзина', exact: true }).click()
  await page.getByRole('button', { name: 'Восстановить', exact: true }).click()
  await page.getByText('Файл восстановлен', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Общие файлы', exact: true }).click()
  await page.getByRole('button', { name: 'Скачать Договор.pdf', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'В корзину Договор.pdf', exact: true }).count(), 0)
  await page.getByRole('button', { name: 'Личные файлы', exact: true }).click()
  await page.getByRole('button', { name: 'В корзину Договор.pdf', exact: true }).waitFor()
  await page.screenshot({ path: 'test-results/drive/desktop.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'test-results/drive/mobile.png' })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Mobile overflow')
  await page.getByLabel('Поиск файлов').fill('нет такого файла')
  await page.getByText('Файлы не найдены', { exact: true }).waitFor()
  assert.deepEqual(errors, [])
  assert.deepEqual(mutations, ['folder', 'upload', 'rename', 'trash', 'restore'])
  console.log('Drive browser checks passed: manager access, upload, folder, history, conflict, trash/restore, shared read-only, search, mobile.')
} finally { await browser.close() }
