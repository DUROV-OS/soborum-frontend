import { useEffect, useState } from 'react'
import { Chip } from '@/shared/ui/Chip'
import { EmptyState } from '@/shared/ui/EmptyState'
import { LoadingState } from '@/shared/ui/LoadingState'
import { StatWidget } from '@/shared/ui/StatWidget'
import { useAutonomyStore } from '../autonomyStore'
import { AutoRun } from '../autonomyTypes'

const SECTION_NAMES: Record<string, string> = {
  clients: 'Клиенты',
  production: 'Производство',
  installation: 'Монтаж',
  cycle: 'Цикл клиента',
  warehouse: 'Склад',
  marketing: 'Маркетинг',
  tasks: 'Задачи',
  accounting: 'Бухгалтерия',
  users: 'Сотрудники'
}

export function AutonomyPanel() {
  const state = useAutonomyStore((s) => s.state)
  const loading = useAutonomyStore((s) => s.loading)
  const running = useAutonomyStore((s) => s.running)
  const error = useAutonomyStore((s) => s.error)
  const load = useAutonomyStore((s) => s.load)
  const run = useAutonomyStore((s) => s.run)
  const resolveWatch = useAutonomyStore((s) => s.resolveWatch)
  const closeProposals = useAutonomyStore((s) => s.closeProposals)
  const [confirmClose, setConfirmClose] = useState(false)

  useEffect(() => {
    load()
  }, [load])

  if (loading && !state) {
    return <LoadingState label="Загрузка автономного агента…" />
  }

  if (error && !state) {
    return (
      <EmptyState
        title="Автономный агент не открылся"
        description={error}
        action={
          <button
            type="button"
            onClick={load}
            className="text-[13px] text-brand"
          >
            Повторить
          </button>
        }
      />
    )
  }

  if (!state) {
    return <EmptyState title="Данные не загружены" />
  }

  const runs = state.runs.slice(0, 10)
  const watchlist = state.watchlist
  const priorities = state.priorities
  const counters = state.counters

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-surface px-5 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight text-ink">
              Автономный агент
            </h2>
            <p className="text-[12px] text-muted">{state.next_run_hint}</p>
            {error && <p className="text-[12px] text-danger">{error}</p>}
          </div>
          <button
            type="button"
            disabled={running}
            onClick={run}
            className="rounded-md bg-brand px-3 py-2 text-[13px] font-medium text-white disabled:opacity-50"
          >
            {running ? 'Идёт прогон…' : 'Запустить прогон'}
          </button>
        </div>
      </section>

      {state.pending_proposals > 0 && (
        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-4 sm:px-6">
          <p className="flex-1 text-[13px] text-ink">
            Карточек агента «на согласование»: {state.pending_proposals}. Закрытие переводит их в «выполнено» с пометкой,
            ничего не удаляется.
          </p>
          {confirmClose ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setConfirmClose(false)
                  void closeProposals()
                }}
                className="rounded-md bg-danger px-3 py-2 text-[13px] font-medium text-white"
              >
                Да, закрыть все {state.pending_proposals}
              </button>
              <button type="button" onClick={() => setConfirmClose(false)} className="text-[13px] text-muted">
                Отмена
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClose(true)}
              className="rounded-md border border-border px-3 py-2 text-[13px] font-medium text-ink"
            >
              Закрыть все предложения агента
            </button>
          )}
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatWidget
          label="Прогонов в журнале"
          value={state.runs.length}
        />
        <StatWidget
          label="Наблюдений открыто"
          value={watchlist.length}
        />
        <StatWidget
          label="На согласовании"
          value={state.pending_proposals}
          tone={state.pending_proposals > 0 ? 'warning' : 'neutral'}
        />
      </div>

      <section className="rounded-2xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <h2 className="text-[16px] font-semibold text-ink">
            Журнал запусков
          </h2>
        </div>
        <div className="px-5 py-4 sm:px-6">
          {runs.length === 0 ? (
            <EmptyState title="Прогонов ещё не было" />
          ) : (
            <ul className="space-y-4">
              {runs.map((r: AutoRun) => (
                <li key={r.id} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] text-muted">
                      {new Date(r.started_at).toLocaleString('ru-RU')}
                    </span>
                    <Chip
                      tone={r.trigger === 'manual' ? 'neutral' : 'info'}
                    >
                      {r.trigger === 'manual' ? 'вручную' : 'по расписанию'}
                    </Chip>
                    <span className="text-[13px] text-ink">{r.summary}</span>
                  </div>
                  {r.actions.length > 0 && (
                    <ul className="space-y-1">
                      {r.actions.map((a) => (
                        <li
                          key={`${r.id}-${a.scenario}-${a.key}`}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <Chip
                            tone={
                              a.level === 'A' ? 'success' : 'warning'
                            }
                          >
                            {a.level === 'A'
                              ? 'А · сам'
                              : 'Б · на согласование'}
                          </Chip>
                          <span className="text-[13px] text-ink">
                            {a.text}
                          </span>
                          <span className="text-[13px] text-muted">
                            {a.result}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {r.error && (
                    <Chip tone="danger">{r.error}</Chip>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <h2 className="text-[16px] font-semibold text-ink">
            Приоритеты
          </h2>
        </div>
        <div className="px-5 py-4 sm:px-6">
          <ul className="space-y-3">
            {priorities.map((p) => (
              <li key={p.section} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] text-ink">
                    {SECTION_NAMES[p.section] ?? p.section}
                  </span>
                  <span className="text-[13px] text-muted">
                    {p.weight}
                  </span>
                </div>
                <div className="h-2 w-full bg-surface-muted">
                  <div
                    className="h-2 bg-brand"
                    style={{ width: `${p.weight * 10}%` }}
                  />
                </div>
                <p className="text-[12px] text-muted">
                  сигналов подряд: {p.signal_streak} · тишина:{' '}
                  {p.quiet_streak}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <h2 className="text-[16px] font-semibold text-ink">
            Наблюдения
          </h2>
        </div>
        <div className="px-5 py-4 sm:px-6">
          {watchlist.length === 0 ? (
            <EmptyState title="Открытых наблюдений нет" />
          ) : (
            <ul className="space-y-3">
              {watchlist.map((w) => (
                <li
                  key={w.id}
                  className="flex flex-wrap items-center gap-2"
                >
                  <Chip
                    tone={
                      w.status === 'open'
                        ? 'neutral'
                        : w.status === 'escalated'
                        ? 'warning'
                        : 'success'
                    }
                  >
                    {w.status === 'open'
                      ? 'открыто'
                      : w.status === 'escalated'
                      ? 'эскалировано'
                      : 'решено'}
                  </Chip>
                  <span className="text-[13px] text-ink">{w.text}</span>
                  <span className="text-[13px] text-muted">
                    видели раз: {w.seen_count}
                  </span>
                  {w.escalate_after && (
                    <span className="text-[13px] text-muted">
                      эскалация:{' '}
                      {new Date(w.escalate_after).toLocaleString('ru-RU')}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => resolveWatch(w.id)}
                    className="text-[13px] text-brand"
                  >
                    Закрыть
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <h2 className="text-[16px] font-semibold text-ink">
            Счётчики повторов
          </h2>
        </div>
        <div className="px-5 py-4 sm:px-6">
          {counters.length === 0 ? (
            <p className="text-[13px] text-muted">
              Автономных действий ещё не было
            </p>
          ) : (
            <ul className="space-y-2">
              {counters.map((c) => (
                <li
                  key={c.scenario}
                  className="flex flex-wrap items-center gap-2"
                >
                  <span className="text-[13px] text-ink">
                    {c.scenario} — {c.repeats} из 3
                  </span>
                  {c.repeats >= 3 && (
                    <Chip tone="warning">
                      переведён на подтверждение
                    </Chip>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
