import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
async function load(path) {
  const source=readFileSync(new URL(path,import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
  return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
}
const {salesRouteAllowed,isSalesManager}=await load('../src/auth/salesNavigation.ts');
const {visibleCollaborationTools}=await load('../src/collaboration/catalog.ts');
for(const account of [
  {role:'admin',job_role:'director'},
  ...['manager','accountant','storekeeper','production_manager',null].map(job_role=>({role:'worker',job_role})),
  {role:'worker',access_profile:'sales_manager'},
]) {
  const tools=visibleCollaborationTools(()=>false);
  assert.equal(tools.filter(t=>t.to==='/calendar').length,1);
  for(const section of ['mine','team','planner','settings']) {
    assert.ok(!isSalesManager(account)||salesRouteAllowed('/calendar','?section='+section));
  }
}
// Common calendar access must not lift the sales workspace's finance/admin restrictions.
for(const path of ['/accounting','/admin','/warehouse','/calendar-admin']) assert.equal(salesRouteAllowed(path,''),false);
assert.equal(salesRouteAllowed('/tasks','?scope=all'),false);
console.log('Calendar is visible without module grants and reachable for every role, including sales profiles; unrelated routes remain restricted.');
