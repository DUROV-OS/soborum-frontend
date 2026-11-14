import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
async function load(path) {
  const code = ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
}
const { visibleCollaborationTools, isCollaborationRoute } = await load('../src/collaboration/catalog.ts')
const { salesNavigationLevel, salesRouteAllowed } = await load('../src/auth/salesNavigation.ts')
const manager = { role: 'worker', job_role: 'manager', module_access: { clients: 'edit', tasks: 'view' } }
const managerTools = visibleCollaborationTools(section => salesNavigationLevel(manager, section) !== 'none')
assert.deepEqual(managerTools.filter(tool => tool.to).map(tool => tool.id), ['messenger', 'tasks'])
assert.equal(salesRouteAllowed('/collaboration', ''), true)
assert.equal(salesRouteAllowed('/ai', ''), false, 'Hub access does not grant AI access')
assert.equal(salesRouteAllowed('/accounting', ''), false, 'Hub access does not grant finance access')
assert.equal(salesRouteAllowed('/tasks', '?scope=all'), false)
assert.equal(visibleCollaborationTools(() => false).some(tool => tool.to), false)
const all = visibleCollaborationTools(() => true)
assert.equal(all.filter(tool => tool.to).length, 4)
assert.equal(all.filter(tool => !tool.to).length, 7, 'Unimplemented tools have no deceptive destination')
assert.equal(isCollaborationRoute('/chats/12', managerTools), true)
assert.equal(isCollaborationRoute('/chats-backup', managerTools), false)
assert.equal(isCollaborationRoute('/ai', managerTools), false)
assert.equal(isCollaborationRoute('/collaboration', managerTools), true)
console.log('PASS: manager restrictions, nested routes, ready vs planned tools, no AI/finance/all-task access expansion')
