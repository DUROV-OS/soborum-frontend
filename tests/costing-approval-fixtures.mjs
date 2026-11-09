// Explicit named approvals in the disposable costing browser server only.
import assert from 'node:assert/strict'
let pdf = '%PDF-1.4\n', offsets = [0]
for (const [i, value] of ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] >>'].entries()) { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${value}\nendobj\n` }
const xref = pdf.length
pdf += 'xref\n0 4\n0000000000 65535 f \n' + offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
const scan = Buffer.from(pdf)
const review = version => ({ version, request_id: crypto.randomUUID(), reason: 'Синтетическая проверка браузерного сценария', work_scope: 'Сборка и проверка тестового изделия' })
async function call(request, base, path, method = 'get', data, role = 'owner') {
  const response = await request[method](base + '/api/costing/governance' + path, { data, headers: { 'x-costing-test-role': role } })
  assert.ok(response.ok(), await response.text()); return response.json()
}
export async function approveItem(request, base, title) {
  let item
  for (let attempt=0;attempt<20&&!item;attempt++) {
    item=(await call(request,base,'/queue')).items.find(r=>r.title===title)
    if(!item) await new Promise(resolve=>setTimeout(resolve,100))
  }
  assert.ok(item)
  await call(request, base, '/items/' + item.id + '/production', 'post', review(item.version), 'production')
}
async function account(request, base, target, id, path) {
  const upload = await request.post(base + `/api/costing/governance/documents/${target}/${id}`, { headers: { 'x-costing-test-role': 'accounting' }, multipart: { file: { name: 'synthetic-evidence.pdf', mimeType: 'application/pdf', buffer: scan } } })
  assert.ok(upload.ok(), await upload.text())
  const doc = await upload.json(), row = await call(request, base, path)
  await call(request, base, path + '/accounting', 'post', { ...review(row.version), evidence: row.facts.map(f => ({ key: f.key, value: f.value, document_id: doc.id, locator: 'Страница 1, строка тестовых данных' })) }, 'accounting')
  await call(request, base, path + '/director', 'post', review(row.version))
}
export async function approveQuote(request, base, title) {
  let plans = await call(request, base, '/month-plans')
  if (!plans.length) {
    const plan = await call(request, base, '/month-plans', 'post', { month: '2026-11-01', planned_units: 1000000, factory: '0.01', warehouse: '0', staff: '0.01', other: '0', note: 'Синтетическая модель округления' })
    await account(request, base, 'month', plan.id, '/month-plans/' + plan.id)
    plans = await call(request, base, '/month-plans')
  }
  let quote
  for(let attempt=0;attempt<20&&!quote;attempt++) {
    quote=(await call(request,base,'/queue')).estimates.find(r=>r.title===title)
    if(!quote) await new Promise(resolve=>setTimeout(resolve,100))
  }
  assert.ok(quote)
  const path = '/estimates/' + quote.id
  const selected = await call(request, base, path + '/overhead-plan', 'put', { version: quote.version, plan_id: plans[0].id })
  await call(request, base, path + '/production', 'post', review(selected.version), 'production')
  await account(request, base, 'estimate', quote.id, path)
  return call(request, base, path)
}
