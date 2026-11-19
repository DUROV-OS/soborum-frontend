import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5187'
const browser = await chromium.launch({ headless: true, channel: process.env.SMOKE_BROWSER_CHANNEL || 'msedge' })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
let actor = { id: 1, full_name: 'Бухгалтер проверки', role: 'admin', is_active: true, module_access: {} }
page.on('pageerror', error => errors.push(error.message))
await page.addInitScript(() => {
  localStorage.setItem('soborbum.auth.token', 'synthetic-purchases')
  localStorage.setItem('durov.purchasing.columns', JSON.stringify(['Дата', 'Поставщик', 'Сумма', 'Оплачено', 'Не оплачено', 'Приёмка']))
})
await page.route('**/api/**', async route => {
  const url = new URL(route.request().url())
  const offset = Number(url.searchParams.get('offset') || 0)
  const sample = { id: offset + 1, number: String(offset + 1), occurred_at: '2026-11-19T07:00:00Z',
    created_at: '2026-11-19T07:00:00Z', supplier_id: 1, supplier_name: 'Тестовый поставщик', total_cost: 100,
    paid: 0, unpaid: 100, status: 'received', currency: 'RUB', amount: 100, refunded: 0, receipt_number: 'Р-01', lines: [],
    invoice_totals: [{ currency: 'RUB', amount: '1234.50' }], received_amount: '76.15',
    organization_id: 1, organization_name: 'Технология', counterparty_id: 10 }
  const titles = { invoicein: 'Счёт поставщику', facturein: 'Полученный счёт-фактура' }
  let body = []
  switch (url.pathname) {
    case '/api/auth/me': body = actor; break
    case '/api/purchasing/catalog': body = {
      organizations: [{ id: 1, name: 'Технология' }, { id: 2, name: 'ИД Групп' }],
      suppliers: [{ id: 1, name: 'Тестовый поставщик' }], materials: [], accounts: [],
    }; break
    case '/api/counterparties':
      body = { total: 62, can_create: actor.role === 'admin', items: [{ id: offset + 1, card: { name: 'Тестовый поставщик ' + sample.id, inn: '7707083893', kpp: '773601001' }, status: 'supplier', phone: '+7 900 101-00-01', comment: 'Доставка по вторникам', active: true, can_edit: true }] }
      break
    case '/api/purchasing/orders':
    case '/api/purchasing/receipts':
    case '/api/purchasing/returns':
      body = { total: 102, items: [sample] }
      break
    case '/api/moysklad/catalog': body = { categories: [], warnings: [] }; break
    case '/api/moysklad/records':
      body = { total: 102, items: [{ id: sample.id, title: titles[url.searchParams.get('entity_type')] + ' ' + sample.id, type: url.searchParams.get('entity_type') }] }
      break
  }
  await route.fulfill({ json: body })
})

const labels = ['Контрагенты', 'Заказы поставщикам', 'Счета поставщиков', 'Приёмки', 'Возвраты поставщикам', 'Счета-фактуры полученные']
const nav = page.getByRole('navigation', { name: 'Разделы закупок' })
const link = index => nav.getByRole('link', { name: labels[index], exact: true })
const select = name => page.getByRole('combobox', { name, exact: true })
const search = name => page.getByRole('textbox', { name, exact: true })
const next = () => page.getByRole('button', { name: 'Далее', exact: true }).click()
const checkbox = key => page.getByRole('checkbox', { name: 'Выделить строку ' + key, exact: true })
const sidebar = page.getByRole('complementary', { name: 'Главное меню' })
const table = page.getByRole('table')
const visible = async index => {
  await link(index).and(nav.locator('[aria-current="page"]')).waitFor()
  assert.deepEqual(await nav.getByRole('link').allTextContents(), labels)
  assert.equal(await page.getByRole('navigation', { name: 'Разделы закупок' }).count(), 1)
  await table.waitFor()
}

try {
  await page.goto(base + '/suppliers')
  await visible(0)
  await page.evaluate(() => { window.purchaseTestNavigation = true })
  await page.getByText('Фильтры', { exact: true }).click()
  await search('Контрагент').fill('Тестовый')
  await table.getByRole('button', { name: 'Контрагент', exact: true }).click()
  await next()
  await checkbox('Тестовый поставщик 21').check()

  await link(1).click()
  await visible(1)
  assert.deepEqual((await table.getByRole('columnheader').allTextContents()).map(label => label.trim()).filter(Boolean),
    ['№', 'Дата', 'Контрагент', 'Организация', 'Сумма', 'Выставлено счетов', 'Оплачено', 'Принято'])
  await table.getByRole('cell', { name: 'Технология', exact: true }).waitFor()
  await table.getByRole('cell', { name: /1\s*234,50/ }).waitFor()
  await table.getByRole('cell', { name: /76,15/ }).waitFor()
  const counterparty = table.getByRole('link', { name: 'Тестовый поставщик', exact: true })
  assert.equal(await counterparty.getAttribute('href'), '/suppliers?counterparty=10')
  assert(await counterparty.evaluate(node => {
    const style = getComputedStyle(node)
    const [red, green, blue] = style.color.match(/\d+/g).map(Number)
    return blue > red && blue > green && style.textDecorationLine.includes('underline')
  }))
  const receivedBar = table.getByRole('img', { name: /Принято.*76,15/ })
  await receivedBar.waitFor()
  assert.equal(await receivedBar.locator('div').evaluate(bar => bar.style.width), '76.15%')
  assert.equal(await table.getByRole('img', { name: /Оплачено/ }).locator('div').evaluate(bar => bar.style.width), '0%')
  assert.equal(await table.getByRole('img', { name: /Выставлено счетов/ }).locator('div').evaluate(bar => bar.style.width), '100%')
  await page.getByRole('button', {name: 'Заказ поставщику', exact: true}).click()
  const editor = page.getByRole('dialog', {name: 'Заказ поставщику', exact: true})
  const organization = editor.getByRole('combobox', {name: 'Организация', exact: true})
  assert.deepEqual(await organization.getByRole('option').allTextContents(), ['Выберите организацию', 'Технология', 'ИД Групп'])
  await editor.getByRole('combobox', {name: 'Поставщик', exact: true}).selectOption('1')
  assert(await editor.getByRole('button', {name: 'Сохранить заказ', exact: true}).isDisabled())
  await organization.selectOption({label: 'ИД Групп'})
  assert(await editor.getByRole('button', {name: 'Сохранить заказ', exact: true}).isEnabled())
  await editor.getByRole('button', {name: 'Отмена', exact: true}).click()
  await search('Поиск закупок').fill('заказ')
  await select('Порядок заказов').selectOption('number')
  await next()
  await checkbox('51').check()

  await link(2).click()
  await visible(2)
  await search('Поиск в данных МоегоСклада').fill('счёт')
  await select('Архив').selectOption('archived')
  await select('Порядок документов').selectOption('oldest')
  await next()
  await checkbox('51').check()

  await link(3).click()
  await visible(3)
  assert.equal(await search('Поиск закупок').inputValue(), '')
  await search('Поиск закупок').fill('приход')
  await select('Порядок приёмок').selectOption('oldest')
  await next()
  await checkbox('51').check()

  await link(4).click()
  await visible(4)
  await select('Архив возвратов').selectOption('all')
  await select('Порядок возвратов').selectOption('number')
  await next()
  await checkbox('51').check()

  await link(5).click()
  await visible(5)
  assert.equal(await search('Поиск в данных МоегоСклада').inputValue(), '')
  await search('Поиск в данных МоегоСклада').fill('фактура')
  await select('Порядок документов').selectOption('newest')
  await next()
  await checkbox('51').check()
  assert.equal(await page.evaluate(() => window.purchaseTestNavigation), true)

  for (let index = 0; index < labels.length; index++) {
    await link(index).click()
    await visible(index)
    const row = checkbox(index === 0 ? 'Тестовый поставщик 21' : '51')
    await row.waitFor()
    assert(await row.isChecked(), 'Selection was lost on ' + labels[index])
    if (index === 0) {
      assert.equal(await search('Контрагент').inputValue(), 'Тестовый')
      assert.equal(await table.getByRole('columnheader', { name: 'Контрагент' }).getAttribute('aria-sort'), 'descending')
    }
    if (index === 1) {
      assert.equal(await search('Поиск закупок').inputValue(), 'заказ')
      assert.equal(await select('Порядок заказов').inputValue(), 'number')
    }
    if (index === 2) {
      assert.equal(await search('Поиск в данных МоегоСклада').inputValue(), 'счёт')
      assert.equal(await select('Архив').inputValue(), 'archived')
      assert.equal(await select('Порядок документов').inputValue(), 'oldest')
    }
    if (index === 3) {
      assert.equal(await search('Поиск закупок').inputValue(), 'приход')
      assert.equal(await select('Порядок приёмок').inputValue(), 'oldest')
    }
    if (index === 4) {
      assert.equal(await select('Архив возвратов').inputValue(), 'all')
      assert.equal(await select('Порядок возвратов').inputValue(), 'number')
    }
    if (index === 5) {
      assert.equal(await search('Поиск в данных МоегоСклада').inputValue(), 'фактура')
      assert.equal(await select('Порядок документов').inputValue(), 'newest')
    }
  }

  const topLevel = sidebar.locator('nav > ul > li > a')
  const sideLabels = await topLevel.allTextContents()
  const purchasesIndex = sideLabels.indexOf('Закупки')
  assert.notEqual(purchasesIndex, -1)
  assert.deepEqual(sideLabels.slice(purchasesIndex, purchasesIndex + 2),
    ['Закупки', 'Контрагенты'])
  const counterparties = sidebar.getByRole('link', { name: 'Контрагенты', exact: true })
  await counterparties.click()
  await visible(0)
  assert.equal(await counterparties.getAttribute('aria-current'), 'page')
  assert.equal(await sidebar.getByRole('link', { name: 'Счета-фактуры полученные', exact: true }).count(), 0)
  await link(5).click()
  await visible(5)
  assert.equal(await sidebar.getByRole('link', { name: 'Счета-фактуры оплаченные', exact: true }).count(), 0)
  await page.getByRole('button', { name: 'Свернуть боковое меню' }).click()
  await sidebar.waitFor({ state: 'hidden' })
  await page.getByRole('button', { name: 'Развернуть боковое меню' }).click()
  await sidebar.waitFor()
  await sidebar.getByRole('link', { name: 'Разделы', exact: true }).click()
  await sidebar.getByRole('link', { name: 'Закупки', exact: true }).click()
  await visible(5)
  assert(await checkbox('51').isChecked())
  await mkdir('test-results/purchasing-tabs', { recursive: true })
  await page.screenshot({ path: 'test-results/purchasing-tabs/desktop.png' })

  await page.setViewportSize({ width: 390, height: 844 })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.getByRole('button', { name: 'Открыть меню' }).click()
  const drawer = page.getByRole('dialog', { name: 'Главное меню' })
  await drawer.getByRole('link', { name: 'Закупки', exact: true }).click()
  await drawer.waitFor({ state: 'hidden' })
  await visible(5)
  await page.screenshot({ path: 'test-results/purchasing-tabs/mobile.png' })

  await page.reload()
  await visible(5)
  await page.goto(base + '/purchasing')
  await visible(5)
  await page.setViewportSize({ width: 1440, height: 1000 })
  actor = { ...actor, role: 'worker', module_access: { warehouse: 'view' } }
  await page.goto(base + '/suppliers')
  await page.getByRole('heading', { name: 'Контрагенты', exact: true }).waitFor()
  assert.deepEqual(await nav.getByRole('link').allTextContents(), ['Контрагенты'])
  assert.equal(await sidebar.getByRole('link', { name: 'Счета-фактуры полученные', exact: true }).count(), 0)
  assert.deepEqual(errors, [])
  console.log('Purchasing tabs passed: six identical top tabs, standalone sidebar counterparty link, SPA switching, independent sort/filter/page/selection, last tab, mobile and role gates.')
} finally {
  await browser.close()
}
