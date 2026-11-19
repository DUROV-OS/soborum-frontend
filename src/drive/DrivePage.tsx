import { useCollaborationView } from '@/collaboration/navigation'
import { ModuleNavigation } from '@/app/SectionNavigation'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { ArchiveRestore, ChevronRight, Download, FileArchive, FileSpreadsheet, FileText, Folder as FolderIcon, FolderPlus, HardDrive, History as HistoryIcon, Image as ImageIcon, LockKeyhole, Pencil, RefreshCw, Search, ShieldCheck, Trash2, Upload, Users } from 'lucide-react'
import { useAuthStore } from '@/auth/store'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { createFolder, downloadFile, fileHistory, listFiles, listFolders, mutateFile, uploadFile, type DriveFile, type FileList, type Folder, type History, type Revision, type Scope } from './api'

const accept = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip'
const sizeText = (size: number) => size < 1024 * 1024 ? `${Math.max(1, Math.ceil(size / 1024))} КБ` : `${(size / 1024 / 1024).toFixed(1)} МБ`
const dateText = (date: string) => new Date(date).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
const errorText = (e: unknown) => e instanceof Error ? e.message : 'Не удалось выполнить действие'
const actions: Record<string, string> = { upload: 'Файл загружен', new_version: 'Добавлена версия', rename: 'Изменено название', move: 'Перемещён в папку', trash: 'Перемещён в корзину', restore: 'Восстановлен' }
function FileIcon({ name }: { name: string }) {
  const extension = name.split('.').pop()?.toLowerCase()
  const Icon = ['jpg', 'jpeg', 'png'].includes(extension || '') ? ImageIcon : ['xls', 'xlsx'].includes(extension || '') ? FileSpreadsheet : extension === 'zip' ? FileArchive : FileText
  return <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-dark"><Icon size={23}/></span>
}
type Dialog = { kind: 'folder' } | { kind: 'rename' | 'move' | 'trash' | 'history'; file: DriveFile }

function appendFiles(previous: FileList, next: FileList): FileList {
  const seen = new Set(previous.items.map(item => item.id))
  return { ...next, items: [...previous.items, ...next.items.filter(item => !seen.has(item.id))] }
}

export function DrivePage() {
  const userId = useAuthStore(s => s.current?.id)
  const [scope, setScope] = useCollaborationView<Scope>('drive', 'scope', 'personal')
  const [trash, setTrash] = useCollaborationView('drive', 'trash', false)
  const [folder, setFolder] = useCollaborationView('drive', 'folder', '')
  const [query, setQuery] = useCollaborationView('drive', 'query', ''), [search, setSearch] = useCollaborationView('drive', 'search', ''), [folders, setFolders] = useState<Folder[]>([])
  const [files, setFiles] = useState<FileList | null>(null), [refresh, setRefresh] = useState(0), [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [dialog, setDialog] = useState<Dialog | null>(null), [name, setName] = useState(''), [destination, setDestination] = useState('')
  const [history, setHistory] = useState<History | null>(null), [historyLoading, setHistoryLoading] = useState(false)
  const [depth, setDepth] = useCollaborationView('drive', 'pages', { view: '', count: 1 })
  const depthRef = useRef(depth)
  depthRef.current = depth
  const view = JSON.stringify([scope, folder, search, trash])
  const input = useRef<HTMLInputElement>(null), replacement = useRef<DriveFile | undefined>(undefined), generation = useRef(0), historyGeneration = useRef(0)
  useEffect(() => { const timer = window.setTimeout(() => setSearch(query.trim()), 250); return () => window.clearTimeout(timer) }, [query])
  useEffect(() => { setDialog(null); setHistory(null); setFiles(null); setFolders([]); setNotice('') }, [userId])
  useEffect(() => {
    let active = true; const request = ++generation.current
    setLoading(true); setError(''); setFiles(null)
    const saved = depthRef.current
    async function load() {
      const [folders, first] = await Promise.all([listFolders(scope), listFiles(scope, folder, search, trash)])
      if (!active || request !== generation.current) return
      setFolders(folders)
      let result = first
      let cursor = first.items.length
      const pages = saved.view === view ? saved.count : 1
      for (let page = 1; active && page < pages && cursor < result.total; page++) {
        setFiles(result)
        const next = await listFiles(scope, folder, search, trash, cursor)
        if (!next.items.length) break
        cursor += next.items.length
        result = appendFiles(result, next)
      }
      if (active && request === generation.current) setFiles(result)
    }
    load().catch(e => { if (active) setError(errorText(e)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; generation.current++ }
  }, [scope, folder, search, trash, refresh, userId, view])
  useEffect(() => {
    const request = ++historyGeneration.current
    setHistory(null)
    if (dialog?.kind !== 'history') { setHistoryLoading(false); return }
    setHistoryLoading(true)
    fileHistory(dialog.file.id).then(value => { if (request === historyGeneration.current) setHistory(value) })
      .catch(e => { if (request === historyGeneration.current) setError(errorText(e)) })
      .finally(() => { if (request === historyGeneration.current) setHistoryLoading(false) })
    return () => { historyGeneration.current++ }
  }, [dialog])

  function area(next: Scope) { setScope(next); setFolder(''); setTrash(false); setQuery(''); setSearch(''); setNotice('') }
  function openDialog(value: Dialog) { setError(''); setDialog(value); setName('file' in value ? value.file.name : ''); setDestination('file' in value ? value.file.folder_id || '' : '') }
  async function perform(operation: () => Promise<unknown>, message: string) {
    setBusy(true); setError(''); setNotice('')
    try { await operation(); setNotice(message); setDialog(null); setRefresh(v => v + 1) }
    catch (e) { setError(errorText(e)) }
    finally { setBusy(false) }
  }
  async function saveDialog() {
    if (!dialog) return
    if (dialog.kind === 'folder') await perform(() => createFolder(scope, name.trim()), 'Папка создана')
    else if (dialog.kind === 'rename') await perform(() => mutateFile(dialog.file, 'name', { name: name.trim() }), 'Название сохранено')
    else if (dialog.kind === 'move') await perform(() => mutateFile(dialog.file, 'folder', { folder_id: destination || null }), 'Файл перемещён')
    else if (dialog.kind === 'trash') await perform(() => mutateFile(dialog.file, 'trash'), 'Файл в корзине. Его можно восстановить.')
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []), previous = replacement.current
    event.target.value = ''; replacement.current = undefined
    if (!selected.length) return
    if (selected.length > 10 || selected.some(f => !f.size || f.size > 50 * 1024 * 1024)) { setError('Выберите до 10 файлов размером от 1 байта до 50 МБ каждый.'); return }
    setBusy(true); setError(''); setNotice('')
    let completed = 0
    try {
      for (const file of selected) { setNotice(`Загрузка ${completed + 1} из ${selected.length}…`); await uploadFile(file, scope, folder, previous); completed++ }
      setNotice(previous ? 'Новая версия сохранена. Предыдущая доступна в истории.' : `Загружено файлов: ${completed}`)
    } catch (e) { setError(`${errorText(e)}${completed ? ` Уже загружено: ${completed}.` : ''}`); setNotice('') }
    finally { setBusy(false); setRefresh(v => v + 1) }
  }
  function chooseFiles(previous?: DriveFile) { replacement.current = previous; if (input.current) { input.current.multiple = !previous; input.current.click() } }
  async function download(file: DriveFile, revision?: Revision) { setBusy(true); setError(''); try { await downloadFile(file, revision) } catch (e) { setError(errorText(e)) } finally { setBusy(false) } }
  async function more() {
    if (!files) return
    const request = generation.current; setLoading(true)
    try {
      const result = await listFiles(scope, folder, search, trash, files.items.length)
      if (request !== generation.current) return
      setFiles(appendFiles(files, result))
      if (result.items.length) setDepth(previous => ({ view, count: previous.view === view ? previous.count + 1 : 2 }))
    }
    catch (e) { if (request === generation.current) setError(errorText(e)) }
    finally { if (request === generation.current) setLoading(false) }
  }
  const currentFolder = folders.find(f => f.id === folder)
  const title = dialog?.kind === 'folder' ? 'Новая папка' : dialog?.kind === 'rename' ? 'Переименовать файл' : dialog?.kind === 'move' ? 'Переместить файл' : dialog?.kind === 'trash' ? 'Переместить в корзину?' : 'Версии и история'
  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted"><HardDrive size={15}/>Совместная работа</div><h1 className="text-2xl font-semibold">Диск</h1><p className="mt-1 text-sm text-muted">Файлы команды, сохранённые версии и понятная история изменений.</p></div><div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={busy || loading} onClick={() => setRefresh(v => v + 1)} aria-label="Обновить диск"><RefreshCw size={16}/></Button>{!trash && <><Button variant="secondary" disabled={busy} onClick={() => openDialog({ kind: 'folder' })}><FolderPlus size={16}/>Новая папка</Button><Button disabled={busy} onClick={() => chooseFiles()}><Upload size={16}/>Загрузить</Button></>}</div></header>
    <input ref={input} type="file" multiple accept={accept} onChange={event => void upload(event)} className="hidden" aria-label="Файлы для загрузки"/>
    <ModuleNavigation label="Разделы диска"><nav aria-label="Области диска" className="flex gap-2 overflow-x-auto pb-1 [&>button]:shrink-0 [&>button]:whitespace-nowrap">{([['personal', 'Личные файлы', LockKeyhole], ['company', 'Общие файлы', Users]] as const).map(([id, label, Icon]) => <Button key={id} variant={scope === id ? 'primary' : 'secondary'} disabled={busy} aria-pressed={scope === id} onClick={() => area(id)}><Icon size={16}/>{label}</Button>)}<Button variant={trash ? 'primary' : 'secondary'} disabled={busy} aria-pressed={trash} onClick={() => { setTrash(v => !v); setFolder(''); setQuery(''); setSearch('') }}><Trash2 size={16}/>Корзина</Button></nav></ModuleNavigation>
    <div className="flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">{scope === 'personal' ? <LockKeyhole size={18} className="mt-0.5 shrink-0"/> : <Users size={18} className="mt-0.5 shrink-0"/>}<p>{scope === 'personal' ? 'Личные файлы доступны только вам.' : 'Общие файлы видят все сотрудники. Изменять файл может его автор или руководитель.'} {trash ? 'В корзине находятся файлы, которые вы можете восстановить.' : 'До 50 МБ на файл. PDF, Word, Excel, JPG, PNG и ZIP.'}</p></div>
    {error && <div role="alert" className="rounded-xl border border-danger/30 bg-danger-bg p-4 text-sm text-danger">{error} {!busy && <button className="ml-2 underline" onClick={() => setRefresh(v => v + 1)}>Обновить список</button>}</div>}
    {notice && <p role="status" className="rounded-lg bg-brand/10 px-4 py-3 text-sm text-brand-dark">{notice}</p>}
    <section className="min-w-0 rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2 text-sm"><button className="font-medium text-brand-dark" disabled={busy} onClick={() => setFolder('')}>{scope === 'personal' ? 'Мой диск' : 'Диск компании'}</button>{(currentFolder || trash) && <><ChevronRight size={15}/><span className="truncate">{trash ? 'Корзина' : currentFolder?.name}</span></>}{files && <span className="text-muted">· {files.total}</span>}</div><div className="relative w-full sm:w-72"><Search size={16} className="absolute left-3 top-3 text-muted"/><Input className="pl-9" aria-label="Поиск файлов" placeholder="Найти файл по названию" value={query} disabled={busy} onChange={e => setQuery(e.target.value)}/></div></div>
      {!trash && !folder && !search && !!folders.length && <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{folders.map(f => <button key={f.id} disabled={busy} onClick={() => setFolder(f.id)} className="flex min-w-0 items-center gap-3 rounded-xl border border-border px-4 py-3 text-left hover:bg-surface-muted"><FolderIcon size={23} className="shrink-0 text-brand"/><span className="truncate text-sm font-medium">{f.name}</span><ChevronRight size={15} className="ml-auto shrink-0 text-muted"/></button>)}</div>}
      {loading && !files && <p role="status" className="py-10 text-center text-muted">Загружаем файлы…</p>}
      {files && !files.items.length && <div className="py-12 text-center"><HardDrive size={36} className="mx-auto mb-3 text-muted"/><h2 className="font-medium">{search ? 'Файлы не найдены' : trash ? 'Корзина пуста' : 'Здесь пока нет файлов'}</h2><p className="mt-2 text-sm text-muted">{search ? 'Измените запрос или откройте другую папку.' : trash ? 'Удалённые файлы можно восстановить здесь.' : 'Загрузите первый документ или создайте папку.'}</p></div>}
      <div className="divide-y divide-border">{files?.items.map(file => <article key={file.id} className="flex flex-wrap items-center gap-3 py-4"><FileIcon name={file.name}/><div className="min-w-0 flex-1 basis-40"><button className="block max-w-full break-all text-left text-sm font-semibold hover:text-brand-dark" onClick={() => openDialog({ kind: 'history', file })}>{file.name}</button><p className="mt-1 text-xs text-muted">{sizeText(file.revision.size)} · Версия {file.revision.number} · {file.owner}</p><p className="mt-1 text-xs text-muted">{dateText(file.updated_at)}{file.folder_name ? ` · ${file.folder_name}` : ''}</p></div><div className="flex w-full max-w-full flex-wrap gap-1 sm:w-auto [&>button]:px-2">
        {!trash && <Button variant="ghost" disabled={busy} aria-label={`Скачать ${file.name}`} title="Скачать" onClick={() => void download(file)}><Download size={17}/></Button>}
        <Button variant="ghost" disabled={busy} aria-label={`История ${file.name}`} title="Версии и история" onClick={() => openDialog({ kind: 'history', file })}><HistoryIcon size={17}/></Button>
        {file.can_edit && (trash ? <Button variant="secondary" disabled={busy} onClick={() => void perform(() => mutateFile(file, 'restore'), 'Файл восстановлен')}><ArchiveRestore size={16}/>Восстановить</Button> : <><Button variant="ghost" disabled={busy} aria-label={`Новая версия ${file.name}`} title="Загрузить новую версию" onClick={() => chooseFiles(file)}><Upload size={17}/></Button><Button variant="ghost" disabled={busy} aria-label={`Переименовать ${file.name}`} title="Переименовать" onClick={() => openDialog({ kind: 'rename', file })}><Pencil size={16}/></Button><Button variant="ghost" disabled={busy} aria-label={`Переместить ${file.name}`} title="Переместить" onClick={() => openDialog({ kind: 'move', file })}><FolderIcon size={16}/></Button><Button variant="ghost" disabled={busy} aria-label={`В корзину ${file.name}`} title="В корзину" onClick={() => openDialog({ kind: 'trash', file })}><Trash2 size={16}/></Button></>)}
      </div></article>)}</div>
      {files && files.items.length < files.total && <Button variant="secondary" disabled={loading || busy} onClick={() => void more()}>{loading ? 'Загрузка…' : 'Показать ещё'}</Button>}
    </section>
    <Modal open={!!dialog} onClose={() => { if (!busy) setDialog(null) }} title={title} width={dialog?.kind === 'history' ? 'max-w-3xl' : 'max-w-lg'} mobileFull footer={dialog?.kind !== 'history' && <><Button variant="secondary" disabled={busy} onClick={() => setDialog(null)}>Отмена</Button><Button disabled={busy || ((dialog?.kind === 'folder' || dialog?.kind === 'rename') && !name.trim())} onClick={() => void saveDialog()}>{busy ? 'Сохранение…' : dialog?.kind === 'trash' ? 'В корзину' : 'Сохранить'}</Button></>}>
      {error && <p role="alert" className="mb-4 rounded-lg bg-danger-bg p-3 text-sm text-danger">{error}</p>}
      {(dialog?.kind === 'folder' || dialog?.kind === 'rename') && <label className="block text-sm">Название<Input className="mt-2" autoFocus maxLength={dialog.kind === 'folder' ? 200 : 255} value={name} onChange={e => setName(e.target.value)}/></label>}
      {dialog?.kind === 'folder' && <p className="mt-3 text-sm text-muted">{scope === 'company' ? 'Папка будет видна всем сотрудникам.' : 'Папка будет доступна только вам.'}</p>}
      {dialog?.kind === 'move' && <label className="block text-sm">Папка назначения<select className="mt-2 min-h-11 w-full rounded-lg border border-border bg-surface px-3" value={destination} onChange={e => setDestination(e.target.value)}><option value="">Корень диска</option>{folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>}
      {dialog?.kind === 'trash' && <p className="break-words text-sm">Файл «{dialog.file.name}» исчезнет из рабочего списка. Все версии сохранятся; файл можно будет восстановить из корзины.</p>}
      {dialog?.kind === 'history' && <div className="space-y-5">{historyLoading && <p role="status">Загрузка истории…</p>}{history && <><h3 className="break-all font-semibold">{history.file.name}</h3><div className={`flex items-start gap-2 rounded-lg p-3 text-sm ${history.history_verified ? 'bg-brand/10 text-brand-dark' : 'bg-danger-bg text-danger'}`}><ShieldCheck size={18} className="shrink-0"/>{history.history_verified ? 'Целостность журнала подтверждена. Контрольная сумма файла проверяется при скачивании.' : 'Обнаружено несоответствие в журнале изменений. Обратитесь к руководителю.'}</div><div><h4 className="mb-3 font-medium">Сохранённые версии</h4><div className="space-y-2">{history.versions.map(r => <div key={r.id} className="rounded-lg border border-border p-3"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="text-sm font-medium">Версия {r.number} · {sizeText(r.size)}</p><p className="mt-1 text-xs text-muted">{r.author} · {dateText(r.created_at)}</p></div><Button variant="secondary" disabled={busy || history.file.deleted} aria-label={`Скачать версию ${r.number}`} onClick={() => void download(history.file, r)}><Download size={16}/></Button></div><details className="mt-2 text-xs text-muted"><summary className="cursor-pointer">Контрольная сумма SHA-256</summary><p className="mt-2 break-all font-mono">{r.sha256}</p></details></div>)}</div></div><div><h4 className="mb-3 font-medium">Изменения</h4><ol className="space-y-3">{history.changes.map(c => <li key={c.id} className="border-l-2 border-brand/30 pl-3"><p className="text-sm">{actions[c.action] || c.action}</p><p className="mt-1 text-xs text-muted">{c.actor} · {dateText(c.at)}</p></li>)}</ol></div></>}</div>}
    </Modal>
  </div>
}
