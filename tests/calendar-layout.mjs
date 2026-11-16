import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Exercise the production layout calculation without a browser or duplicated algorithm.
const source = readFileSync(new URL('../src/collaboration/calendarLayout.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText
const { layoutDay } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))
const date = new Date(2026, 10, 16)
const event = (id, start, end) => ({ id, occurrence_start: new Date(2026, 10, 16, ...start).toISOString(), occurrence_end: new Date(2026, 10, 16, ...end).toISOString() })
let result = layoutDay([event(1,[9,15],[10,45])],date)
assert.deepEqual(result.map(({start,end,lane,lanes})=>({start,end,lane,lanes})),[{start:555,end:645,lane:0,lanes:1}])
result = layoutDay([event(1,[9,0],[11,0]),event(2,[9,30],[10,0]),event(3,[9,45],[10,30]),event(4,[11,0],[12,0])],date)
assert.deepEqual(result.map(r=>r.lanes),[3,3,3,1])
for(const a of result) for(const b of result) if(a!==b && a.start<b.end && b.start<a.end) assert.notEqual(a.lane,b.lane)
result=layoutDay([event(1,[-1,30],[0,20]),event(2,[23,30],[25,0]),event(3,[24,0],[25,0])],date)
assert.deepEqual(result.map(r=>[r.start,r.end]),[[0,20],[1410,1440]])
assert.equal(layoutDay([event(1,[10,0],[9,0])],date).length,0)
console.log('Calendar layout: minute precision, overlap lanes, touching events and midnight clipping passed')
