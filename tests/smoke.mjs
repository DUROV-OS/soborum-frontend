// Browser regression checks use synthetic responses, never a production account or AI provider.
import assert from 'node:assert/strict'
import { mkdir, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const baseURL = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5173'
const artifactDir = process.env.SMOKE_ARTIFACT_DIR ?? 'test-results'
await mkdir(artifactDir, { recursive: true })
const browser = await chromium.launch({ headless: true })
const errors = []
const checks = []
const modules = ['clients', 'production', 'installation', 'cycle', 'warehouse', 'marketing', 'tasks', 'ai', 'board']
const worker = { id: 2, email: 'worker@example.test', full_name: 'Сотрудник производства', role: 'worker', module_access: ['production'], is_active: true, created_at: '2026-09-05T08:00:00Z' }
const admin = { ...worker, id: 1, email: 'owner@example.test', full_name: 'Руководитель', role: 'admin', module_access: modules }
const widget = (section, title, value, tone = 'neutral') => ({ section, title, value, tone })
const overview = {
  generated_at: '2026-09-05T09:30:00Z', source: 'database', ai_configured: false,
  summary: 'Направлений, требующих внимания: 4. Начните с очереди ниже.',
  actions: [
    { id: 'tasks', section: 'tasks', title: 'Проверить просроченные задачи', description: 'Уточните причину задержки и следующий срок.', count: 3, href: '/tasks', tone: 'danger' },
    { id: 'production', section: 'production', title: 'Проверить заявки на материалы', description: 'Заявки ожидают решения склада.', count: 2, href: '/production', tone: 'warning' },
    { id: 'warehouse', section: 'warehouse', title: 'Проверить пополнение склада', description: 'Остатки и текущая потребность требуют внимания.', count: 3, href: '/warehouse', tone: 'warning' },
    { id: 'clients', section: 'clients', title: 'Проверить поступление оплаты', description: 'Клиенты на этапе оплаты без подтверждённого поступления.', count: 1, href: '/clients', tone: 'warning' },
  ],
  widgets: [widget('production', 'Производственных заказов', '4'), widget('production', 'Блоки ждут материалы', '2', 'warning'), widget('tasks', 'Открытых задач', '8'), widget('tasks', 'Просроченных задач', '3', 'warning'), widget('warehouse', 'Позиций на складе', '24'), widget('warehouse', 'Позиций требуют пополнения', '3', 'warning')],
}
const clientFixture = {
  // created_at must fall within the current calendar month — the clients board
  // defaults its date filter to "this month" (real Date.now(), not a fixture clock)
  id: 21, cycle_id: 21, stage: 'lead', created_at: new Date().toISOString(),
  full_name: 'Кузнецова Кузнецова', phone: '+7 900 000-00-00', email: 'client21@example.test',
  contacts: [], max_chat_id: null, order_type: null, wishes_description: null, estimated_price: null,
  house_area: null, layout_notes: null, project_locked_at: null, houses_count: 1, final_price: null,
  installation_address: null, payment_plan: null, advance_amount: null, contract_file: null,
  house_project_file: null, documents_locked_at: null, is_paid: null, payment_locked_at: null,
  balance_paid: null, balance_paid_at: null, notes: [],
}
const documentsClient = {
  id: 22, cycle_id: 22, stage: 'approval', created_at: '2026-08-01T08:00:00Z',
  full_name: 'Смирнова Смирнова', phone: '+7 900 111-11-11', email: 'client22@example.test',
  contacts: [], max_chat_id: null, order_type: null, wishes_description: null, estimated_price: null,
  house_area: null, layout_notes: null, project_locked_at: '2026-08-05T08:00:00Z', houses_count: 1,
  final_price: null, installation_address: null, payment_plan: null, advance_amount: null,
  contract_file: null, house_project_file: null, documents_locked_at: null, is_paid: null,
  payment_locked_at: null, balance_paid: null, balance_paid_at: null, notes: [],
}
let lastDocumentsPatchBody = null
const aiClient = {
  id: 23, cycle_id: 23, stage: 'lead', created_at: '2026-08-01T08:00:00Z',
  full_name: 'Волкова Волкова', phone: '+7 900 222-22-22', email: 'client23@example.test',
  contacts: [], max_chat_id: null, order_type: null, wishes_description: null, estimated_price: null,
  house_area: null, layout_notes: null, project_locked_at: null, houses_count: 1, final_price: null,
  installation_address: null, payment_plan: null, advance_amount: null, contract_file: null,
  house_project_file: null, documents_locked_at: null, is_paid: null, payment_locked_at: null,
  balance_paid: null, balance_paid_at: null, notes: [],
}
const supplierFixture = {
  id: 41, name: 'ЛесТорг', categories: ['брусы/доска'], status: 'active',
  contacts: [{ kind: 'phone', value: '+79261110001', person: 'Андрей' }],
  max_chat_id: null, created_at: '2026-08-01T08:00:00Z',
  price_items: [{
    id: 1, supplier_id: 41, material: 'Брус профилированный 150x150', category: 'брусы/доска',
    tiers: [{ min_qty: 0, max_qty: null, price: 18200 }], lead_time: '7-10 дней', round: null,
    created_at: '2026-08-01T08:00:00Z', updated_at: '2026-08-01T08:00:00Z',
  }],
  price_items_count: 1,
  notes: [{ id: 1, supplier_id: 41, author_id: 1, author_name: 'Administrator', text: 'Даёт скидку от 10 кубов', created_at: '2026-08-01T08:00:00Z' }],
  total_ordered: 50000, total_paid: 20000, balance: 30000,
}
const supplierOrderFixture = {
  id: 9, supplier_id: 41, supplier_name: 'ЛесТорг',
  items: [{ material: 'Брус профилированный 150x150', category: 'брусы/доска', quantity: 10, unit_price: 5000 }],
  total_cost: 50000, currency: 'RUB', expected_at: null, status: 'ordered', received_at: null, comment: null,
  created_at: '2026-08-02T08:00:00Z', updated_at: '2026-08-02T08:00:00Z',
}
let lastAskStreamBody = null
const agentStats = {
  week: [], routing: [], traces: [],
  legal: { allow: 0, allow_with_conditions: 0, escalate_human: 0, block: 0 },
  totals: { runs: 0, blocked: 0, escalated: 0, released: 0 },
  shifts: 0, pending_approvals: 0,
}

async function openAs(user, route = '/today', viewport = { width: 1440, height: 1100 }) {
  const context = await browser.newContext({ viewport })
  await context.addInitScript(() => {
    if (!sessionStorage.getItem('fixture-seeded')) {
      localStorage.setItem('soborbum.auth.token', 'browser-test-token')
      sessionStorage.setItem('fixture-seeded', '1')
    }
    for (const id of ['today', 'admin', 'production', 'ai', 'agents', 'tasks', 'clients']) localStorage.setItem(`soborbum.onboarding.${id}`, '1')
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  const requests = []
  await page.route('https://fonts.googleapis.com/**', route => route.abort())
  await page.route('https://fonts.gstatic.com/**', route => route.abort())
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    requests.push(`${route.request().method()} ${url.pathname}`)
    let body
    let status = 200
    if (url.pathname === '/api/auth/me') body = user
    else if (url.pathname === '/api/auth/users' && route.request().method() === 'GET') body = [admin, worker]
    else if (url.pathname === '/api/auth/users/2/access') { status = 403; body = { detail: 'Изменение доступа отклонено сервером' } }
    else if (url.pathname === '/api/dashboard/today') body = user.role === 'admin' ? overview : { ...overview, actions: [], widgets: overview.widgets.filter(w => w.section === 'production'), summary: 'По доступным данным отклонений для очереди внимания нет.' }
    else if (url.pathname === '/api/production/') body = [{ id: 7, cycle_id: 11, cycle_status: 'production', created_at: '2026-09-05T08:00:00Z', block_count: 4 }]
    else if (url.pathname === '/api/dashboard/aktualnoe') body = user.role === 'admin'
      ? { generated_at: '2026-09-05T09:30:00Z', ai_configured: false, degraded: true, items: [
          { cycle_id: 11, client_name: 'Иванов И.', stage: 'Согласование', percent: 55, phrase: 'правят планировку' },
          { cycle_id: 12, client_name: 'Петров П.', stage: 'Производство', percent: 40, phrase: 'собирают модули' },
          { cycle_id: 13, client_name: 'Сидоров С.', stage: 'Монтаж', percent: 85, phrase: 'финишная отделка' },
        ] }
      : { generated_at: '2026-09-05T09:30:00Z', ai_configured: false, degraded: false, items: [] }
    else if (url.pathname === '/api/agents/stats') body = agentStats
    else if (url.pathname === '/api/tasks/') body = [
      // задача-ссылка смены стадии клиента: без дедлайна, создана давно —
      // должна быть видна в борде задач при фильтрах по умолчанию (регрессия 0013)
      { id: 501, title: 'Клиент «Иванов И.»: перевести со стадии на следующую', description: null, deadline: null, status: 'ready', created_at: '2026-06-01T08:00:00Z', block_id: null, link_type: 'client_stage', link_id: 11, link_meta: { stage: 'contract' }, assignees: [], reviewers: [], images: [], depends_on_ids: [] },
      // задача без проверяющих в работе: кнопка сдачи не должна звать это «проверкой» (регрессия 0020)
      { id: 502, title: 'Собрать блок №3', description: null, deadline: null, status: 'in_progress', created_at: '2026-06-02T08:00:00Z', block_id: null, link_type: null, link_id: null, link_meta: null, assignees: [], reviewers: [], images: [], depends_on_ids: [] },
    ]
    else if (url.pathname === '/api/ai/chats') body = []
    else if (url.pathname === '/api/clients/22/documents' && route.request().method() === 'PATCH') {
      lastDocumentsPatchBody = route.request().postDataJSON()
      documentsClient.payment_plan = lastDocumentsPatchBody.payment_plan
      body = documentsClient
    }
    else if (url.pathname === '/api/ai/clients/analytics') body = { section: 'clients', generated_at: '2026-09-05T09:30:00Z', summary: 'Отклонений нет.', status: 'green' }
    else if (url.pathname === '/api/clients/' && route.request().method() === 'GET') body = [aiClient, clientFixture, documentsClient]
    else if (url.pathname === '/api/clients/21' && route.request().method() === 'GET') body = clientFixture
    else if (url.pathname === '/api/clients/21/transition' && route.request().method() === 'POST') {
      clientFixture.stage = 'discussion'
      body = clientFixture
    }
    else if (url.pathname === '/api/ai/clients/ask/stream' && route.request().method() === 'POST') {
      lastAskStreamBody = route.request().postDataJSON()
      const sse = ': open\n\nevent: done\ndata: {"type":"done","chat_id":1}\n\nevent: end\ndata: {}\n\n'
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse })
      return
    }
    else if (url.pathname === '/api/ai/chats/1') body = {
      id: 1, domain: 'clients', mode: 'require_approval', title: null, created_at: '2026-09-05T09:30:00Z',
      messages: [
        {
          id: 1, role: 'user', created_at: '2026-09-05T09:30:00Z', tool_resolutions: null,
          content: [
            { type: 'context_note', note: '[client_id=23, Волкова Волкова] ' },
            { type: 'text', text: 'Какая стадия у клиента?' },
          ],
        },
        {
          id: 2, role: 'assistant', created_at: '2026-09-05T09:30:05Z', tool_resolutions: null,
          content: [{ type: 'text', text: 'Клиент на стадии «Лид».' }],
        },
      ],
    }
    else if (url.pathname === '/api/ai/pending-actions') body = []
    else if (url.pathname === '/api/warehouse/suppliers' && route.request().method() === 'GET') body = [supplierFixture]
    else if (url.pathname === '/api/accounting/supplier-orders' && route.request().method() === 'GET') body = [supplierOrderFixture]
    else if (url.pathname === '/api/accounting/money-movements' && route.request().method() === 'GET') body = []
    else { status = 404; body = { detail: `Unmocked request: ${url.pathname}` } }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(baseURL + route)
  return { page, context, requests }
}

try {
  const employee = await openAs(worker)
  await employee.page.getByRole('heading', { name: 'Главное на сегодня.' }).waitFor()
  assert.equal(await employee.page.getByRole('heading', { name: 'Марина', exact: true }).count(), 0)
  await employee.page.getByRole('navigation').getByRole('link', { name: 'Работа', exact: true }).click()
  await employee.page.getByRole('heading', { name: 'Работа', exact: true }).waitFor()
  await employee.page.getByRole('link', { name: /Производство/ }).click()
  await employee.page.getByRole('button', { name: 'Заказ №11' }).waitFor()
  assert(employee.requests.includes('GET /api/production/'))
  assert(!employee.requests.some(request => request.includes('/api/cycles')))
  checks.push('Production-only employee loads productions without cycle access or AI')
  await employee.page.goto(baseURL + '/admin')
  await employee.page.getByText('Доступ ограничен', { exact: true }).waitFor()
  assert(!employee.requests.includes('GET /api/auth/users'))
  checks.push('Worker cannot mount the administrator screen')
  await employee.context.close()

  const owner = await openAs(admin)
  await owner.page.getByText('Проверить просроченные задачи', { exact: true }).waitFor()
  await owner.page.screenshot({ path: path.join(artifactDir, 'durov-os-today-desktop.png'), fullPage: true })
  assert(await owner.page.getByText('Подключение Марины ещё не настроено. Сводка компании доступна.').isVisible())
  await owner.page.getByLabel('Вопрос Марине', { exact: true }).fill('Какие материалы задерживают производство?')
  await owner.page.getByRole('button', { name: 'Открыть вопрос Марине' }).click()
  const composer = owner.page.getByLabel('Сообщение Марине', { exact: true })
  await composer.waitFor()
  assert.match(owner.page.url(), /\/ai$/)
  assert.equal(await composer.inputValue(), 'Какие материалы задерживают производство?')
  assert(!owner.requests.some(request => request.includes('/ask')))
  assert.equal(await owner.page.getByRole('button', { name: 'Автоматически', exact: true }).count(), 0)
  checks.push('Today works without AI and opens an unsent draft with A0/A2 controls')
  await owner.page.goto(baseURL + '/agents')
  await owner.page.getByRole('heading', { name: 'Агенты.' }).waitFor()
  await owner.page.getByRole('tab', { name: 'Панель' }).click()
  await owner.page.getByRole('heading', { name: 'Разметка до «обучен»' }).waitFor()
  checks.push('Admin opens Agents map and the telemetry panel')

  await owner.page.goto(baseURL + '/tasks')
  await owner.page.getByText('Клиент «Иванов И.»: перевести со стадии на следующую', { exact: true }).waitFor()
  checks.push('Client-stage link task (no deadline) is visible on the tasks board by default')

  await owner.page.getByRole('button', { name: /Собрать блок №3/ }).click()
  await owner.page.getByRole('button', { name: 'Сдать задачу', exact: true }).waitFor()
  assert.equal(await owner.page.getByText('Отправить на проверку', { exact: true }).count(), 0)
  checks.push('Task without reviewers shows "Сдать задачу" instead of "Отправить на проверку"')
  await owner.page.getByRole('button', { name: 'Закрыть', exact: true }).click()

  await owner.page.goto(baseURL + '/admin')
  await owner.page.getByRole('button', { name: 'Новый сотрудник' }).click()
  let dialog = owner.page.getByRole('dialog', { name: 'Новый сотрудник' })
  await dialog.getByLabel('ФИО').fill('Черновик сотрудника')
  await dialog.getByLabel('Почта').fill('draft@example.test')
  await dialog.getByLabel('Пароль').fill('private-test-password')
  assert.equal(await dialog.getByLabel('Пароль').getAttribute('autocomplete'), 'new-password')
  await dialog.getByRole('button', { name: 'Отмена' }).click()
  await owner.page.getByRole('button', { name: 'Новый сотрудник' }).click()
  dialog = owner.page.getByRole('dialog', { name: 'Новый сотрудник' })
  assert.equal(await dialog.getByLabel('ФИО').inputValue(), '')
  assert.equal(await dialog.getByLabel('Почта').inputValue(), '')
  assert.equal(await dialog.getByLabel('Пароль').inputValue(), '')
  await dialog.getByRole('button', { name: 'Отмена' }).click()
  checks.push('Cancelled employee form clears identity and password and discourages login autofill')
  await owner.page.getByRole('checkbox', { name: 'Сотрудник производства: Клиенты', exact: true }).click()
  await owner.page.getByText('Изменение доступа отклонено сервером', { exact: true }).waitFor()
  assert.equal(await owner.page.getByRole('checkbox', { name: 'Сотрудник производства: Клиенты', exact: true }).isChecked(), false)
  checks.push('Failed permission update remains unchecked and explains the server error')
  await owner.page.getByRole('button', { name: 'Меню учётной записи' }).click()
  await owner.page.getByRole('button', { name: 'Выйти', exact: true }).click()
  await owner.page.getByRole('button', { name: 'Войти', exact: true }).waitFor()
  assert.equal(await owner.page.evaluate(() => localStorage.getItem('soborbum.auth.token')), null)
  assert.equal(await owner.page.getByText('Быстрый вход (демо)', { exact: true }).count(), 0)
  checks.push('Logout clears token and screen state; no demo account switch is exposed')
  await owner.context.close()

  const documents = await openAs(admin, '/clients/22')
  await documents.page.getByRole('heading', { name: 'Смирнова Смирнова' }).waitFor()
  await documents.page.getByLabel('Формат расчёта').selectOption({ label: 'Полная предоплата' })
  await documents.page.getByRole('button', { name: 'Сохранить' }).click()
  await documents.page.getByRole('button', { name: 'Сохранить' }).waitFor()
  assert.equal(lastDocumentsPatchBody?.payment_plan, 'full_prepayment')
  checks.push('Client documents panel sends the backend payment_plan value, not the old frontend-only key (regression 0018)')
  await documents.context.close()

  const clientAi = await openAs(admin, '/clients/23')
  await clientAi.page.getByRole('heading', { name: 'Волкова Волкова' }).waitFor()
  await clientAi.page.getByRole('button', { name: 'Спросить ИИ' }).click()
  await clientAi.page.getByLabel('Сообщение Марине', { exact: true }).fill('Какая стадия у клиента?')
  await clientAi.page.getByRole('button', { name: 'Отправить сообщение' }).click()
  await clientAi.page.getByText('Клиент на стадии «Лид».', { exact: true }).waitFor()
  assert.equal(lastAskStreamBody?.message, 'Какая стадия у клиента?')
  assert(lastAskStreamBody?.context_note?.includes('client_id=23'))
  assert.equal(await clientAi.page.getByText(/client_id=/).count(), 0)
  checks.push('Client context reaches Marina as a separate field, never as visible chat text (regression 0017)')
  await clientAi.context.close()

  const suppliers = await openAs(admin, '/suppliers')
  await suppliers.page.getByText('ЛесТорг', { exact: true }).first().waitFor()
  await suppliers.page.getByText('ЛесТорг', { exact: true }).first().click()
  await suppliers.page.getByRole('tab', { name: 'Обзор' }).waitFor()
  await suppliers.page.getByLabel('Название').waitFor()
  await suppliers.page.getByRole('tab', { name: 'Прайс-лист' }).click()
  await suppliers.page.getByText('Брус профилированный 150x150', { exact: true }).waitFor()
  await suppliers.page.getByRole('tab', { name: 'Заказы и оплата' }).click()
  await suppliers.page.getByText('Заказано', { exact: true }).waitFor()
  await suppliers.page.getByRole('button', { name: 'Оплатить поставку' }).waitFor()
  await suppliers.page.getByRole('tab', { name: 'Заметки' }).click()
  await suppliers.page.getByText('Даёт скидку от 10 кубов', { exact: true }).waitFor()
  // Регрессия 0011-l: до фикса эффект инициализации формы был завязан на весь
  // объект supplier (новая ссылка при каждом обновлении стора) и на любое
  // обновление сбрасывал активную вкладку на «Обзор» — здесь просто повторный
  // проход по вкладкам без промежуточных действий проверяет, что переключение
  // само по себе стабильно.
  await suppliers.page.getByRole('tab', { name: 'Обзор' }).click()
  await suppliers.page.locator('input[value="Андрей"]').waitFor()
  checks.push('Supplier card tabs (Обзор/Прайс-лист/Заказы и оплата/Заметки) render their content in the new layout (0011-l)')
  await suppliers.context.close()

  const mobile = await openAs(admin, '/today', { width: 390, height: 844 })
  await mobile.page.getByText('Проверить просроченные задачи', { exact: true }).waitFor()
  assert(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  await mobile.page.screenshot({ path: path.join(artifactDir, 'durov-os-today-mobile.png'), fullPage: true })
  await mobile.page.getByRole('button', { name: 'Открыть меню' }).click()
  await mobile.page.getByRole('button', { name: 'Закрыть меню' }).click()
  await mobile.page.waitForFunction(() => document.querySelector('aside').getBoundingClientRect().right <= 0)
  assert((await mobile.page.getByRole('complementary', { name: 'Главное меню' }).boundingBox()).x < 0)
  checks.push('390px layout has no horizontal overflow and mobile navigation opens/closes')

  await mobile.page.goto(baseURL + '/clients')
  // Both desktop columns and the mobile accordion are always in the DOM (CSS hides one by
  // breakpoint) — the mobile accordion markup renders last, so `.last()` targets it reliably.
  await mobile.page.getByText('Кузнецова Кузнецова', { exact: true }).last().waitFor()
  checks.push('Mobile clients board opens with the lead-stage accordion column expanded by default')
  await mobile.page.getByText('Кузнецова Кузнецова', { exact: true }).last().click()
  await mobile.page.getByRole('button', { name: 'Перевести на «Обсуждение»' }).click()
  await mobile.page.getByRole('button', { name: 'Перевести на «Согласование»' }).waitFor()
  await mobile.page.getByRole('link', { name: 'Все клиенты' }).click()
  await mobile.page.getByText('Кузнецова Кузнецова', { exact: true }).last().waitFor()
  checks.push('After a mobile stage transition the client card is visible in the new stage column without manually expanding it (regression 0019)')
  await mobile.context.close()

  const assets = await readdir('dist/assets')
  const source = (await Promise.all(assets.filter(file => file.endsWith('.js')).map(file => readFile(path.join('dist/assets', file), 'utf8')))).join('\n')
  assert(!source.includes('admin123') && !source.includes('soborbum2026') && !source.includes('admin@soborbum.local'))
  checks.push('Production JavaScript contains no former demo credentials')
  assert.deepEqual(errors, [])
  console.log(checks.map((text, index) => `${index + 1}. PASS ${text}`).join('\n'))
  console.log(`PASS ${checks.length} browser checks; no uncaught page errors. Fixtures are synthetic.`)
} finally {
  await browser.close()
}
