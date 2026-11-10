import { useState } from 'react'
import { apiRequest } from '@/shared/lib/httpClient'
import { EvidenceValue } from './AnalysisEvidence'
import { AnswerEvidenceData, AnswerSource } from '../types'

const date = (value: string) => new Date(value).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }) + ' МСК'

function Source({ source, chatId, messageId, cited }: { source: AnswerSource; chatId: number; messageId: number; cited: boolean }) {
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  async function load() {
    setLoading(true); setSnapshot(null); setError(null)
    try {
      const result = await apiRequest<{ snapshot: Record<string, unknown>; snapshot_matches: boolean }>({ section: 'ai', path: `/chats/${chatId}/messages/${messageId}/sources/${encodeURIComponent(source.id)}` })
      if (!result.snapshot_matches) throw new Error('Сохранённый снимок не прошёл проверку')
      setSnapshot(result.snapshot)
    } catch (e) { setError(e instanceof Error ? e.message : 'Источник недоступен') }
    finally { setLoading(false) }
  }
  return <div className="rounded-lg border border-border bg-surface p-3">
    <p className="font-medium">[{source.id}] {source.label}</p>
    <p className="mt-1 text-muted">Прочитано {date(source.read_at)} · {cited ? 'Указан в ответе' : 'Был доступен при подготовке'}</p>
    <button type="button" onClick={load} disabled={loading} className="mt-2 min-h-10 rounded-lg border border-brand/30 px-3 text-brand disabled:opacity-60">{loading ? 'Загрузка снимка…' : 'Показать сохранённые данные'}</button>
    {error && <p role="alert" className="mt-2 text-danger">{error}</p>}
    {snapshot && <div className="mt-3 space-y-3"><p className="text-muted">Снимок на момент чтения. Текущие данные могли измениться. Совпадение снимка не подтверждает подлинность документов или правильность вывода ИИ.</p><EvidenceValue value={snapshot} /></div>}
  </div>
}

export function AnswerEvidence({ evidence, chatId, messageId }: { evidence?: AnswerEvidenceData; chatId?: number | null; messageId: number }) {
  if (!evidence || evidence.version !== 'answer-evidence-v1') return <p className="max-w-[90%] text-[11px] text-muted">Источники этого ответа не зафиксированы.</p>
  const sources = evidence.sources ?? []
  return <details className="w-full max-w-[90%] rounded-lg border border-border bg-surface px-3 py-2 text-xs sm:max-w-md">
    <summary className="min-h-6 cursor-pointer font-medium text-brand">{sources.length ? `Источники ответа · ${sources.length}` : 'Ответ без прочитанных источников системы'}</summary>
    <div className="mt-3 space-y-3 break-words">
      <p className="text-muted">Это ответ ИИ. Правильность вывода не оценена, согласование человеком не зафиксировано.</p>
      <p className="text-muted">Подготовлен {date(evidence.generated_at)}. {evidence.prior_history_present ? 'Использована также история диалога.' : ''}</p>
      {evidence.unknown_citations.length > 0 && <p role="alert" className="text-danger">В ответе есть ссылки без сохранённого источника: {evidence.unknown_citations.join(', ')}. Эти ссылки не подтверждены.</p>}
      {evidence.failed_reads > 0 && <p className="text-warning">Не все запросы данных завершились успешно: {evidence.failed_reads}. Нельзя считать недоступные значения нулевыми.</p>}
      {evidence.stop_reason === 'max_tokens' && <p className="text-warning">Ответ не завершён: достигнут предел длины.</p>}
      {evidence.external_results && <p className="text-muted">Есть результаты внешнего поиска или базы знаний. Они не проверены как записи учётной системы.</p>}
      {sources.length === 0 && <p>Свежие данные компании для этого ответа не прочитаны. Сообщения и загруженные файлы сами по себе не подтверждают цифры.</p>}
      {chatId && sources.map(s => <Source key={s.id} source={s} chatId={chatId} messageId={messageId} cited={evidence.citations.includes(s.id)} />)}
      <details><summary className="cursor-pointer text-muted">Контрольная запись</summary><p className="mt-2">{evidence.provider} · {evidence.model}</p><code className="mt-1 block break-all">{evidence.answer_hash}</code></details>
    </div>
  </details>
}
