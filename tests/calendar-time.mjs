import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/collaboration/calendarTime.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {instant,wallTime}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
for(const zone of ['Europe/Moscow','Asia/Yekaterinburg','Asia/Kolkata','America/New_York','UTC']) {
  for(const value of ['2026-01-15T00:15','2026-07-15T23:45']) assert.equal(wallTime(instant(value,zone),zone),value);
}
assert.equal(instant('2026-11-17T10:00','Asia/Yekaterinburg'),'2026-11-17T05:00:00.000Z');
assert.equal(wallTime('2026-11-17T07:00:00Z','Europe/Moscow'),'2026-11-17T10:00');
assert.throws(()=>instant('2026-03-29T02:30','Europe/Berlin'));
assert.throws(()=>instant('2026-10-25T02:30','Europe/Berlin'));
assert.throws(()=>instant('2026-02-30T10:00','Europe/Moscow'));
assert.throws(()=>instant('','UTC'));
console.log('Calendar timezone conversion, date boundaries and DST validation passed');
