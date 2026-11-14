import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source = await readFile(new URL('../src/crm/savedFilters.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { filterStorageKey, parseFilterSnapshot, readSavedFilters, storeSavedFilter, removeSavedFilter } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
const data = new Map()
const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
const key = filterStorageKey(1, 'deal'), other = filterStorageKey(2, 'deal'), contacts = filterStorageKey(1, 'contact')
const filters = { view: 'list', pipeline: '9', stage: '11', archive: 'active', query: 'Дом', owner: '0', priority: '', dates: { from: '2026-11-01', to: '2026-11-30', unknown: false }, spam: 'normal', temperature: 'hot' }
storeSavedFilter(storage, key, { id: 'one', name: 'Без ответственного', filters })
assert.equal(readSavedFilters(storage, key)[0].filters.owner, '0')
assert.deepEqual(readSavedFilters(storage, other), [])
assert.deepEqual(readSavedFilters(storage, contacts), [])
// Another tab's addition survives a subsequent update to the first saved view.
storeSavedFilter(storage, key, { id: 'two', name: 'Горячие', filters })
storeSavedFilter(storage, key, { id: 'one', name: 'Обновлённый', filters: { ...filters, query: 'Новый поиск' } }, true)
assert.deepEqual(readSavedFilters(storage, key).map(item => item.id), ['one', 'two'])
assert.throws(() => storeSavedFilter(storage, key, { id: 'three', name: 'ГОРЯЧИЕ', filters }), /название/)
const before = storage.getItem(key)
assert.throws(() => storeSavedFilter(storage, key, { id: 'missing', name: 'Несуществующий', filters }, true), /удалён/)
assert.equal(storage.getItem(key), before)
const removed = readSavedFilters(storage, key)[0]
removeSavedFilter(storage, key, removed.id)
storeSavedFilter(storage, key, removed)
assert.equal(readSavedFilters(storage, key).length, 2)
const invalid = [
  { ...filters, dates: { ...filters.dates, from: '2026-02-30' } },
  { ...filters, dates: { ...filters.dates, from: '2026-12-01' } },
  { ...filters, owner: '-1' }, { ...filters, view: 'unknown' }, { ...filters, query: {} },
]
for (const value of invalid) assert.throws(() => parseFilterSnapshot(value))
for (const raw of ['{broken', '{"version":2,"items":[]}', '{"version":1,"items":[{}]}']) {
  storage.setItem(other, raw)
  assert.throws(() => storeSavedFilter(storage, other, { id: 'new', name: 'Новый', filters }))
  assert.equal(storage.getItem(other), raw, 'Corrupt/unsupported data must not be overwritten')
}
const blocked = { getItem: () => null, setItem: () => { throw new DOMException('Blocked', 'QuotaExceededError') } }
assert.throws(() => storeSavedFilter(blocked, key, { id: 'blocked', name: 'Тест', filters }), /Blocked/)
assert.throws(() => filterStorageKey(0, 'deal'))
assert.throws(() => filterStorageKey(1, 'admin'))
console.log('PASS: account/section isolation, persistence, concurrent additions, explicit updates, undo, date/enum validation, corrupt-data preservation, blocked storage')
