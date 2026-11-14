import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source = await readFile(new URL('../src/warehouse/queueState.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { queueState, stockQuantities, formatQuantity } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
const missing = { control: { approved: false, norm: { lines: [] } }, remaining_positions: 0, available_positions: 0, provided_positions: 0 }
assert.equal(queueState(missing), 'missing_norm', 'Empty norm must not appear completed')
assert.equal(queueState({ ...missing, control: { ...missing.control, approved: true } }), 'missing_norm')
const norm = { ...missing, control: { approved: false, norm: { lines: [{ quantity: '4.5' }] } } }
assert.equal(queueState(norm), 'approval')
const approved = { ...norm, control: { ...norm.control, approved: true } }
assert.equal(queueState(approved), 'check', 'No demand is not evidence of a completed issue')
assert.equal(queueState({ ...approved, provided_positions: 1 }), 'completed')
assert.equal(queueState({ ...approved, remaining_positions: 1, provided_positions: 1 }), 'issuing', 'Partial issue/return reopens demand')
assert.equal(queueState({ ...norm, remaining_positions: 1, available_positions: 1 }), 'approval', 'Availability never bypasses approval')
assert.deepEqual(stockQuantities(-1, -1), { reserved: 0, issuable: 0 })
assert.deepEqual(stockQuantities(3, -2), { reserved: 5, issuable: 0 })
assert.deepEqual(stockQuantities(12.5, 10), { reserved: 2.5, issuable: 10 })
assert.equal(formatQuantity(0.0001), '0,0001')
console.log('PASS: missing norm, approval, evidence of completion, partial issue/return, negative stock, reserve shortage, fractional quantity')
