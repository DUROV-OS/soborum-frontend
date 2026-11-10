import { TaskSelectionEvidence } from '../types'
import { AnalysisEvidence } from './AnalysisEvidence'

export function TaskPlanEvidence({ report, items }: { report: TaskSelectionEvidence; items: { source_snapshot?: Record<string, unknown> }[] }) {
  if (!report.source_hash) return <p className="mt-2 text-xs text-muted">Основания этого плана не зафиксированы. Обновите план.</p>
  return <div className="mb-3 space-y-2 text-xs text-muted">
    <p>{report.source === 'ai' ? 'Выбор задач предложен ИИ' : 'Порядок задач рассчитан по правилам'} · объяснения взяты из карточек. План не согласован руководителем.</p>
    {report.checked_at && <p>Данные проверены {new Date(report.checked_at).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК.{report.cached ? ' Исходные данные не изменились, использован сохранённый выбор.' : ''}</p>}
    {(report.candidate_count ?? 0) > (report.considered_count ?? 0) && <p>Для выбора рассмотрено {report.considered_count} из {report.candidate_count} открытых задач.</p>}
    {report.fallback_reason && <p role="status">{report.fallback_reason}</p>}
    <AnalysisEvidence snapshot={{ tasks: items.map(i => i.source_snapshot ?? {}) }} sourceHash={report.source_hash} version={report.analysis_version} />
  </div>
}
