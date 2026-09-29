import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const baseURL = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5173'
const artifactDir = path.join('test-results')
await mkdir(artifactDir, { recursive: true })

const modules = ['clients', 'production', 'installation', 'cycle', 'warehouse', 'marketing', 'tasks', 'ai', 'board']
const worker = { id: 2, email: 'worker@example.test', full_name: 'Сотрудник производства', role: 'worker', module_access: ['production'], is_active: true, created_at: '2026-09-05T08:00:00Z' }
const admin = { ...worker, id: 1, email: 'owner@example.test', full_name: 'Руководитель', role: 'admin', module_access: modules }
const latestShift = {
  id: 1,
  verdict: 'escalate_human',
  summary: 'Команда сверилась с базой. Вам решить 1 вопрос. Пока без общей модели: роли отвечают по паспорту и базе.',
  claude_used: false,
  created_at: '2026-09-07T08:00:00Z',
  autorun: true,
  interval_seconds: 3600,
  next_tick_at: '2026-09-07T09:00:00Z',
  items: [
    { id: 1, agent_id: 'coordinator', agent_title: 'координатор', daily_question: 'Что сейчас самое важное для компании?', stance: 'Сводит картину: что сейчас главное. В базе есть: Конституция агента Durov-OS.', citations: ['Конституция агента Durov-OS'], legal_verdict: 'allow', reviews: [] },
    { id: 2, agent_id: 'sales', agent_title: 'продажник', daily_question: 'Какие сделки зависли?', stance: 'Смотрит, какие сделки зависли и что мешает оплате. Живого среза amoCRM нет.', citations: ['Общий контекст компании'], legal_verdict: 'allow', stance_source: 'live', has_live_data: true, reviews: [{ reviewer: 'finance', reviewer_title: 'финансист', text: 'Не проверено: у финансиста нет проверки по этому вопросу.', escalate: false, kind: 'ops', status: 'not_checked' }, { reviewer: 'lawyer', reviewer_title: 'юрист', text: 'В очередь: без вашего «да» не выпускаем. Скидка и окончательная цена — решение человека.', escalate: true, kind: 'legal', status: 'checked_escalate' }] },
    { id: 3, agent_id: 'finance', agent_title: 'финансист', daily_question: 'Где утекает маржа?', stance: 'Скидка больше 5% — не зона продажника.', citations: ['Операционные принципы'], legal_verdict: 'allow', reviews: [] },
    { id: 4, agent_id: 'lawyer', agent_title: 'юрист', daily_question: 'Какое действие создаёт юридический риск?', stance: 'Проверяет, можно ли выпускать без человека.', citations: ['Юрист как фильтр'], legal_verdict: 'allow', reviews: [] },
    { id: 5, agent_id: 'production', agent_title: 'производственник', daily_question: 'Что тормозит ближайший дом?', stance: 'Срок клиенту не обещать.', citations: ['Модуль'], legal_verdict: 'allow', reviews: [] },
    { id: 6, agent_id: 'warehouse', agent_title: 'кладовщик', daily_question: 'Чего не хватит ближайшему дому?', stance: 'Складская программа ещё не подключена.', citations: ['Остатки'], legal_verdict: 'allow', reviews: [{ reviewer: 'production', reviewer_title: 'производственник', text: 'Производственник видел черновик кладовщика и своего стоп-фактора не нашёл.', escalate: false, kind: 'ops' }] },
    { id: 7, agent_id: 'marketer', agent_title: 'маркетолог', daily_question: 'Какой следующий контакт с рынком?', stance: 'Только открытый факт бренда.', citations: ['Общий контекст компании'], legal_verdict: 'allow', has_live_data: false, stance_source: 'llm_without_facts', reviews: [] },
    { id: 8, agent_id: 'engineer', agent_title: 'инженер', daily_question: 'Какое отклонение от техкарты опасно?', stance: 'Нестандарт не выдавать как типовой узел.', citations: ['Модуль'], legal_verdict: 'allow', reviews: [] },
  ],
  approvals: [
    { id: 1, shift_id: 1, item_id: 2, kind: 'legal', title: 'Продажник: Скидка и окончательная цена — решение человека.', detail: 'В очередь: без вашего «да» не выпускаем. Скидка и окончательная цена — решение человека.', status: 'pending', subject_hash: 'a'.repeat(64), created_at: '2026-09-07T08:00:00Z' },
    { id: 2, shift_id: 1, item_id: 3, kind: 'pricing', title: 'Финансист: вопрос, который нельзя выпускать самим', detail: 'Финансист принёс вопрос, который нельзя выпускать самим.', status: 'approved', subject_hash: 'b'.repeat(64), created_at: '2026-09-07T08:00:00Z' },
  ],
  charts: [
    { id: 'sales_stuck', title: 'Зависшие сделки, дни без движения', unit: 'дн', agents: ['sales'], lead: 'Дольше всех без движения: Невзоровы, 12 дн.', tone: 'warning', bars: [{ label: 'Невзоровы', value: 12 }] },
    { id: 'finance_money', title: 'Где висят деньги', unit: '₽', agents: ['finance'], lead: 'Не оплачено по заказам: 1 400 000 ₽.', tone: 'timber', bars: [{ label: 'Не оплачено по заказам', value: 1400000 }] },
    { id: 'warehouse_gap', title: 'Минус на складе', unit: 'шт', agents: ['warehouse'], lead: 'В минусе: брус, -2 шт.', tone: 'danger', bars: [{ label: 'брус', value: -2 }] },
    { id: 'coordinator_pulse', title: 'Где горит', unit: 'шт', agents: ['coordinator'], lead: 'Главное: сделки без движения >30д — 8.', tone: 'warning', bars: [{ label: 'Сделки без движения >30д', value: 8 }] },
    { id: 'production_tasks', title: 'Задания в цехе, дни', unit: 'дн', agents: ['production'], lead: 'Дольше всех в цехе: 012/DH-64, 40 дн.', tone: 'warning', bars: [{ label: '012/DH-64', value: 40 }] },
  ],
}

async function openAs(user, viewport = { width: 1440, height: 1100 }) {
  const context = await chromium.launch({ headless: true }).then((browser) => browser.newContext({ viewport }).then((ctx) => ({ browser, ctx })))
  await context.ctx.addInitScript(() => {
    localStorage.setItem('soborbum.auth.token', 'browser-test-token')
    for (const id of ['today', 'admin', 'production', 'ai', 'agents']) localStorage.setItem(`soborbum.onboarding.${id}`, '1')
  })
  const page = await context.ctx.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/me') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) })
      return
    }
    if (url.pathname === '/api/agents/stats') {
      await route.fulfill({
        status: user.role === 'admin' ? 200 : 403,
        contentType: 'application/json',
        body: JSON.stringify({
          week: [
            { date: '31.08', runs: 0, blocked: 0, escalated: 0, released: 0 },
            { date: '01.09', runs: 0, blocked: 0, escalated: 0, released: 0 },
            { date: '02.09', runs: 0, blocked: 0, escalated: 0, released: 0 },
            { date: '03.09', runs: 0, blocked: 0, escalated: 0, released: 0 },
            { date: '04.09', runs: 0, blocked: 0, escalated: 0, released: 0 },
            { date: '05.09', runs: 0, blocked: 0, escalated: 0, released: 0 },
            { date: '06.09', runs: 0, blocked: 0, escalated: 0, released: 0 },
          ],
          legal: { allow: 0, allow_with_conditions: 0, escalate_human: 0, block: 0 },
          routing: [],
          traces: [],
          totals: { runs: 0, blocked: 0, escalated: 0, released: 0 },
          shifts: 0,
          pending_approvals: 0,
        }),
      })
      return
    }
    if (url.pathname === '/api/agents/shifts/latest') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(latestShift) })
      return
    }
    if (url.pathname === '/api/agents/shifts') {
      await route.fulfill({
        status: user.role === 'admin' ? 200 : 403,
        contentType: 'application/json',
        body: JSON.stringify(latestShift),
      })
      return
    }
    if (url.pathname === '/api/agents/approvals/1/decision') {
      // Сервер видит другой снимок пункта — фронт должен сказать «изменился» и перечитать смену.
      await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ detail: 'Пункт изменился, обновите страницу' }) })
      return
    }
    if (url.pathname === '/api/agents/runs') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          trace_id: 'browsercheck',
          text: 'Каких материалов не хватает на складе?',
          reply: 'Координатор.\nLegal gate: allow.',
          legal_verdict: 'allow',
          legal_rules: [],
          legal_passport: '',
          released: true,
          specialists: ['warehouse'],
          specialist_titles: ['кладовщик'],
          created_at: '2026-09-06T08:00:00Z',
        }),
      })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  return { ...context, page, errors }
}

const owner = await openAs(admin)
await owner.page.goto(baseURL + '/agents')
await owner.page.getByRole('heading', { name: 'Агенты.' }).waitFor()
assert(await owner.page.getByRole('navigation').getByRole('link', { name: 'Агенты', exact: true }).isVisible())
assert.equal(await owner.page.getByRole('navigation').getByRole('link', { name: 'Марина', exact: true }).count(), 0)
assert.equal(await owner.page.getByRole('link', { name: 'Совет директоров', exact: true }).count(), 1)
await owner.page.getByRole('tab', { name: 'Консультация' }).click()
await owner.page.getByLabel('Сообщение Марине', { exact: true }).waitFor()
assert.equal(await owner.page.getByRole('button', { name: 'Новый чат' }).count(), 0)
await owner.page.getByRole('button', { name: 'Очистить чат' }).waitFor()
await owner.page.getByRole('tab', { name: 'Смена' }).click()
await owner.page.getByRole('heading', { name: 'Команда работает сама' }).waitFor()
await owner.page.getByRole('button', { name: 'Начать смену' }).waitFor()
await owner.page.getByText('Продажник: Скидка и окончательная цена — решение человека.').waitFor()
await owner.page.getByRole('heading', { name: 'Продажник' }).waitFor()
await owner.page.getByText('Согласовано · не исполнено').waitFor()
assert.equal(await owner.page.getByText('вы сказали да').count(), 0)
assert.equal(await owner.page.getByText('стоп-фактора не нашёл').count(), 0)
assert((await owner.page.locator('article').filter({ hasText: 'Продажник' }).getByText('Не проверено: у финансиста нет проверки по этому вопросу.').count()) === 1)
assert((await owner.page.locator('article').filter({ hasText: 'Кладовщик' }).getByText('Не проверено.').count()) === 1)
assert((await owner.page.locator('article').filter({ hasText: 'Маркетолог' }).getByText('без данных из системы').count()) === 1)
assert((await owner.page.locator('article').filter({ hasText: 'Продажник' }).getByText('без данных из системы').count()) === 0)
assert.equal(await owner.page.getByText('amoCRM').count(), 0)
await owner.page.getByRole('button', { name: 'Да', exact: true }).click()
await owner.page.getByText('Пункт изменился — смену перечитали, посмотрите ещё раз.').waitFor()
assert((await owner.page.locator('article').filter({ hasText: 'Продажник' }).getByText('Дольше всех без движения: Невзоровы, 12 дн.').count()) === 1)
assert((await owner.page.locator('article').filter({ hasText: 'Финансист' }).getByText('Где висят деньги').count()) === 1)
assert((await owner.page.locator('article').filter({ hasText: 'Кладовщик' }).getByText('Минус на складе').count()) === 1)
assert((await owner.page.locator('article').filter({ hasText: 'Маркетолог' }).getByText('Зависшие сделки').count()) === 0)
assert((await owner.page.locator('article').filter({ hasText: 'Юрист' }).getByText('Где висят деньги').count()) === 0)
await owner.page.screenshot({ path: path.join(artifactDir, 'agents-admin-shift.png'), fullPage: true })
await owner.page.getByRole('tab', { name: 'Команда' }).click()
await owner.page.getByRole('button', { name: 'Юрист', exact: true }).click()
await owner.page.getByText('Вердикт legal gate', { exact: false }).waitFor()
await owner.page.getByRole('tab', { name: 'Панель' }).click()
await owner.page.getByRole('heading', { name: 'Разметка до «обучен»' }).waitFor()
await owner.page.screenshot({ path: path.join(artifactDir, 'agents-admin-panel.png'), fullPage: true })
await owner.page.getByRole('tab', { name: 'Команда' }).click()
await owner.page.screenshot({ path: path.join(artifactDir, 'agents-admin-team.png'), fullPage: true })
assert.deepEqual(owner.errors, [])
await owner.ctx.close()
await owner.browser.close()

const employee = await openAs(worker)
await employee.page.goto(baseURL + '/agents')
await employee.page.getByRole('heading', { name: 'Агенты.' }).waitFor()
assert.equal(await employee.page.getByRole('tab', { name: 'Консультация' }).count(), 1)
assert.equal(await employee.page.getByRole('tab', { name: 'Панель' }).count(), 0)
await employee.page.getByRole('heading', { name: 'Команда работает сама' }).waitFor()
assert.equal(await employee.page.getByRole('button', { name: 'Начать смену' }).count(), 0)
await employee.page.getByText('Продажник: Скидка и окончательная цена — решение человека.').waitFor()
assert.equal(await employee.page.getByRole('button', { name: 'Да' }).count(), 0)
await employee.page.getByRole('tab', { name: 'Команда' }).click()
await employee.page.getByRole('heading', { name: 'Прогнать запрос' }).waitFor()
await employee.page.getByText('Уже сделано').waitFor()
await employee.page.screenshot({ path: path.join(artifactDir, 'agents-worker-team.png'), fullPage: true })
assert.deepEqual(employee.errors, [])
await employee.ctx.close()
await employee.browser.close()

const mobile = await openAs(admin, { width: 390, height: 844 })
await mobile.page.goto(baseURL + '/agents')
await mobile.page.getByRole('heading', { name: 'Агенты.' }).waitFor()
assert(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
await mobile.page.screenshot({ path: path.join(artifactDir, 'agents-admin-mobile.png'), fullPage: true })
await mobile.ctx.close()
await mobile.browser.close()

console.log('PASS agents admin team+panel, worker without panel, 390px no overflow')
