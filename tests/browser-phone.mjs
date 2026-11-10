import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5183'
const artifacts = 'test-results/browser-phone'
await mkdir(artifacts, { recursive: true })
const report = { synthetic_api: true, synthetic_media_signalling: true, real_calls: 0, checks: [] }
const entry = (id, kind, name, data = {}) => ({ id, kind, name, data, archived: false, version: 1 })
const contact = entry(12, 'contact', 'Тестовый клиент', { phone: '+79000000001' })
const deal = entry(11, 'deal', 'Заявка на дом', { pipeline_id: 1, stage_id: 2, contact_ids: [12] })
async function setup({ mobile = false, level = 'edit', denied = false } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1366, height: 1000 }, serviceWorkers: 'block' })
  await context.addInitScript(({ denied }) => {
    localStorage.setItem('soborbum.auth.token', 'synthetic-browser-phone')
    localStorage.setItem('soborbum.onboarding.crm', '1')
    window.voiceTest = { media: 0, offers: 0, stopped: 0, sockets: [] }
    const track = { enabled: true, stop() { window.voiceTest.stopped++ } }
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
      window.voiceTest.media++
      if (denied) throw new DOMException('Permission denied', 'NotAllowedError')
      return { getTracks: () => [track], getAudioTracks: () => [track] }
    } })
    window.RTCPeerConnection = class extends EventTarget {
      iceGatheringState = 'complete'; remoteDescription = null; connectionState = 'connected'
      addTrack() {} async createOffer() { return { type: 'offer', sdp: 'v=0\r\nm=audio 9 RTP/AVP 0\r\n' } }
      async setLocalDescription(value) { this.localDescription = value }
      async setRemoteDescription(value) { this.remoteDescription = value }
      async addIceCandidate() {} close() {}
    }
    window.WebSocket = class {
      static OPEN = 1; readyState = 0
      constructor(url) { this.voice = String(url).includes('/browser-phone/ws/'); window.voiceTest.sockets.push(this); queueMicrotask(() => { this.readyState = 1; this.onopen?.() }) }
      send(raw) {
        const data = JSON.parse(raw)
        if (!this.voice) return
        if (data.type === 'auth') queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ type: 'registered' }) }))
        if (data.type === 'offer') { window.voiceTest.offers++; queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ type: 'accepted', jsep: { type: 'answer', sdp: 'v=0\r\n' } }) })) }
      }
      close() { this.readyState = 3; queueMicrotask(() => this.onclose?.()) }
    }
  }, { denied })
  const page = await context.newPage(), errors = [], writes = []
  page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname
    if (req.method() !== 'GET') writes.push({ path, body: req.postDataJSON() })
    let body = []
    if (path === '/api/auth/me') body = { id: 6, full_name: 'Тестовый менеджер', email: 'manager@example.invalid', role: 'worker', job_role: 'manager', is_active: true, module_access: { clients: level } }
    else if (path === '/api/crm/catalog') body = { pipelines: [entry(1, 'pipeline', 'Продажи')], stages: [entry(2, 'stage', 'Новая заявка', { pipeline_id: 1 })], users: [{ id: 6, name: 'Менеджер' }], counts: {} }
    else if (path === '/api/crm/entries') { const items = url.searchParams.get('kind') === 'deal' ? [deal] : []; body = { total: items.length, items } }
    else if (path === '/api/crm/entries/11') body = deal
    else if (path === '/api/crm/entries/12') body = contact
    else if (/\/(files|history)$/.test(path)) body = { total: 0, items: [] }
    else if (path === '/api/crm/entries/11/chat-phones') body = { items: [{ phone: '+79000000001', name: contact.name }] }
    else if (path === '/api/crm/entries/11/chats') body = { items: [] }
    else if (path === '/api/crm/browser-phone/status') body = { can_call: true, gateway_configured: true, account_configured: true, login: 'test-sales' }
    else if (path === '/api/crm/entries/11/browser-calls') body = { id: req.postDataJSON().request_id, call_id: 1, state: 'prepared' }
    else if (path.endsWith('/cancel')) body = { state: 'ended' }
    else if (path === '/api/crm/calls') body = { total: 1, items: [{ id: 1, phone: '79000000001', direction: 'out', started_at: '2026-11-09T10:00:00Z', duration: 60, employee: 'Менеджер', status: 'answered', client_id: null, crm_entity_id: 11, deal_id: 11, deal_match_status: 'manual', match_status: 'manual', audio_ready: true, processing: 'ready', error: '', transcript: 'Клиент интересуется домом. Пришлите расчёт завтра.', segments: [], analysis: { summary: 'Клиент выбрал дом. Договорились отправить расчёт завтра.', key_points: [], tasks: [] }, reviewed_at: null }] }
    else if (path.endsWith('/audio')) {
      const wav = Buffer.alloc(44 + 16000 * 2); wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(32000, 40)
      await route.fulfill({ contentType: 'audio/wav', body: wav }); return
    } else if (path === '/api/costing/context') body = { estimates: [], templates: [], links: [], order_lines: null, can_import_recipe: false }
    else if (path === '/api/notifications/unread-count') body = { unread_count: 0 }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto(base + '/crm?tab=deal&entry=11&channel=calls')
  const card = page.getByRole('dialog', { name: deal.name, exact: true }); await card.waitFor()
  const panel = card.getByRole('region', { name: 'Связь с клиентом', exact: true })
  await panel.getByRole('button', { name: 'Позвонить из CRM', exact: true }).waitFor()
  return { context, page, card, panel, errors, writes }
}
try {
  for (const mobile of [false, true]) {
    const t = await setup({ mobile })
    const button = t.panel.getByRole('button', { name: 'Позвонить из CRM', exact: true })
    await button.evaluate(button => { button.click(); button.click() })
    const dock = t.page.getByRole('region', { name: 'Телефон CRM', exact: true })
    await dock.getByText('Разговор', { exact: true }).waitFor()
    assert.equal(t.writes.filter(item => item.path.endsWith('/browser-calls')).length, 1)
    assert.equal(await t.page.evaluate(() => window.voiceTest.offers), 1)
    await dock.getByRole('button', { name: 'Выключить микрофон', exact: true }).click()
    await dock.getByRole('button', { name: 'Включить микрофон', exact: true }).waitFor()
    await t.card.getByRole('button', { name: 'Закрыть', exact: true }).click()
    await dock.getByText('Разговор', { exact: true }).waitFor()
    // A lazy screen transition must not remount the global phone provider.
    if (mobile) await t.page.getByRole('button', { name: 'Открыть меню', exact: true }).click()
    await t.page.getByRole(mobile ? 'dialog' : 'complementary', { name: 'Главное меню' }).getByRole('link', { name: 'Мои заявки', exact: true }).click()
    await t.page.getByRole('heading', { name: 'Мои заявки', exact: true }).waitFor()
    await dock.getByText('Разговор', { exact: true }).waitFor()
    assert.equal(t.writes.filter(item => item.path.endsWith('/cancel')).length, 0)
    assert.equal(await t.page.evaluate(() => window.voiceTest.offers), 1)
    await dock.getByRole('link', { name: 'Карточка и запись', exact: true }).click()
    await t.card.waitFor()
    await dock.getByRole('button', { name: 'Завершить', exact: true }).click()
    await dock.getByText('Звонок завершён', { exact: true }).waitFor()
    await t.panel.getByText('Исходящий · 79000000001', { exact: true }).click()
    await t.panel.getByRole('button', { name: 'Открыть запись', exact: true }).click()
    await t.panel.locator('audio').waitFor()
    await t.panel.getByRole('heading', { name: 'Краткий анализ ИИ', exact: true }).waitFor()
    await t.page.screenshot({ path: artifacts + (mobile ? '/mobile.png' : '/desktop.png') })
    assert.deepEqual(t.errors, [])
    report.checks.push((mobile ? 'mobile' : 'desktop') + ': card dial, duplicate click suppressed, mute, navigation preserves call, hangup, audio player and analysis')
    await t.context.close()
  }
  const denied = await setup({ denied: true })
  await denied.panel.getByRole('button', { name: 'Позвонить из CRM', exact: true }).click()
  await denied.page.getByText('Разрешите CRM использовать микрофон', { exact: false }).waitFor()
  assert.equal(denied.writes.length, 0); await denied.context.close()
  const viewer = await setup({ level: 'view' })
  assert.equal(await viewer.panel.getByRole('button', { name: 'Позвонить из CRM', exact: true }).isDisabled(), true)
  assert.equal(viewer.writes.length, 0); await viewer.context.close()
  report.checks.push('microphone denial and read-only CRM access never initiate a call')
  report.ok = true
  await writeFile(artifacts + '/report.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report))
} finally { await browser.close() }
