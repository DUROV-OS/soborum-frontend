import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowRight, CheckCheck, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/auth/store'
import { useAiStore } from '@/ai/store'
import { SECTIONS } from '@/shared/sections'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { StatWidget } from '@/shared/ui/StatWidget'
import { AktualnoeCard } from '../components/AktualnoeCard'
import { useTodayStore } from '../store'

export function TodayPage() {
  const { data, loading, error, load, aktualnoe, aktualnoeLoading } = useTodayStore()
  const hasAccess = useAuthStore((s) => s.hasAccess)
  const startDraft = useAiStore((s) => s.startDraft)
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState('')

  useEffect(() => { load() }, [load])

  function askMarina(message = prompt) {
    if (!message.trim()) return
    startDraft('general')
    navigate('/ai', { state: { draftMessage: message.trim() } })
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    askMarina()
  }

  const today = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
  const actions = data?.actions ?? []
  const widgets = data?.widgets ?? []
  const aktualnoeItems = aktualnoe?.items ?? []
  const showAktualnoe = aktualnoeLoading || aktualnoeItems.length > 0
  const rowTwoCols = showAktualnoe && hasAccess('ai')

  return (
    <div className="mx-auto max-w-[1440px] space-y-7 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Рабочий обзор</p>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[34px]">Главное на сегодня<span className="text-brand">.</span></h1>
          <p className="mt-2 text-[13px] capitalize text-muted">{today}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => load(true)} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Обновить данные
        </Button>
      </div>

      {error && <EmptyState icon={<AlertCircle size={28} />} title="Сводка временно недоступна" description={error}
        action={<Button size="sm" onClick={() => load()}>Повторить</Button>} />}
      {loading && !data && <div role="status" className="rounded-2xl border border-border bg-surface px-6 py-12 text-[14px] text-muted">Собираем текущие показатели…</div>}

      {data && !error && <>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-5 py-3.5">
          <p className="flex items-start gap-2.5 text-[13px] text-ink"><CheckCheck size={17} className="mt-0.5 shrink-0 text-brand" />{data.summary}</p>
          <span className="shrink-0 text-[11px] text-muted">Данные на {new Date(data.generated_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>

        {actions.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-border bg-surface" aria-labelledby="attention-title">
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-5 sm:px-6">
              <div><h2 id="attention-title" className="text-[18px] font-semibold tracking-tight text-ink">Требует внимания</h2>
                <p className="mt-1 text-[12px] text-muted">Откройте направление и выберите следующий шаг</p></div>
              <span className="rounded-lg bg-surface-muted px-3 py-1.5 text-[20px] font-semibold tabular text-ink">{actions.length}</span>
            </div>
            <ul className="divide-y divide-border">
              {actions.map((action) => <li key={action.id}>
                <button type="button" onClick={() => navigate(action.href)} className="group flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-muted/60 sm:gap-4 sm:px-6">
                  <span className={`flex h-10 min-w-10 items-center justify-center rounded-xl px-2 text-[16px] font-semibold tabular ${action.tone === 'danger' ? 'bg-danger-bg text-danger' : 'bg-warning-bg text-warning'}`}>{action.count}</span>
                  <span className="min-w-0 flex-1"><span className="block text-[14px] font-medium text-ink">{action.title}</span>
                    <span className="mt-1 block text-[12px] leading-relaxed text-muted">{action.description}</span></span>
                  <ArrowRight size={17} className="shrink-0 text-muted transition-transform group-hover:translate-x-1 group-hover:text-brand" />
                </button>
              </li>)}
            </ul>
          </section>
        )}

        <div className={`grid gap-5 ${rowTwoCols ? 'lg:grid-cols-2' : ''}`}>
          {showAktualnoe && (
            <section className="flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6" aria-labelledby="aktualnoe-title">
              <div className="mb-4">
                <h2 id="aktualnoe-title" className="text-[18px] font-semibold tracking-tight text-ink">Актуальное</h2>
                <p className="mt-1 text-[12px] text-muted">Циклы, над которыми активнее всего работали</p>
              </div>
              {aktualnoeLoading && aktualnoeItems.length === 0 ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-xl bg-surface-muted" />)}
                </div>
              ) : (
                <div className="space-y-3">
                  {aktualnoeItems.map((item) => (
                    <AktualnoeCard key={item.cycle_id} item={item} onClick={() => navigate(`/cycles/${item.cycle_id}`)} />
                  ))}
                </div>
              )}
              {aktualnoe?.degraded && aktualnoeItems.length > 0 && (
                <p className="mt-3 text-[11px] text-muted">Подобрано по свежести работы — Марина ещё не подключена.</p>
              )}
            </section>
          )}

          {hasAccess('ai') && <section className="flex flex-col rounded-2xl border border-ai/30 bg-ai-bg p-5 text-ink sm:p-6" aria-labelledby="marina-title">
            <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ai/15"><Sparkles size={22} className="text-ai-accent" /></div>
              <div><h2 id="marina-title" className="text-[21px] font-medium tracking-tight">Марина</h2><p className="text-[12px] text-muted">Ваш AI-помощник</p></div></div>
            <p className="mb-5 mt-6 text-[19px] font-medium leading-snug tracking-tight">С чего начнём?<br /><span className="text-muted">Задайте вопрос о работе компании.</span></p>
            <form onSubmit={submit} className="rounded-xl border border-ai/25 bg-surface p-3">
              <label htmlFor="marina-prompt" className="sr-only">Вопрос Марине</label>
              <textarea id="marina-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder="Например: что задерживает производство?"
                className="w-full resize-none bg-transparent text-[14px] leading-relaxed text-ink outline-none placeholder:text-muted" />
              <div className="flex items-center justify-between gap-2"><span className="text-[11px] text-muted">Откроется черновик в чате</span>
                <button type="submit" disabled={!prompt.trim()} aria-label="Открыть вопрос Марине" className="flex h-9 w-9 items-center justify-center rounded-lg bg-ai text-ink transition-colors hover:bg-ai-accent hover:text-white disabled:opacity-35"><ArrowRight size={18} /></button></div>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">{['С чего начать сегодня?', 'Где нужна моя помощь?'].map((text) =>
              <button key={text} type="button" onClick={() => askMarina(text)} className="rounded-lg border border-ai/25 bg-surface px-3 py-2 text-left text-[12px] text-ink hover:bg-ai/10">{text}</button>)}</div>
            <div className="mt-auto pt-6"><p className="flex items-start gap-2 border-t border-ai/20 pt-4 text-[12px] leading-relaxed text-muted"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-ai-accent" />Изменения данных — после вашего подтверждения.</p>
              {data.ai_configured === false && <p className="mt-3 text-[12px] text-warning">Подключение Марины ещё не настроено. Сводка компании доступна.</p>}</div>
          </section>}
        </div>

        <section aria-labelledby="metrics-title">
          <h2 id="metrics-title" className="mb-4 text-[18px] font-semibold tracking-tight text-ink">Показатели по разделам</h2>
          {widgets.length === 0 ? <EmptyState title="Рабочие разделы пока не назначены" description="Администратор может назначить доступ в разделе «Доступ»." /> :
            <div className="grid grid-cols-3 gap-3">
              {widgets.map((widget, index) => {
                const section = SECTIONS.find((s) => s.id === (widget.section === 'users' ? 'admin' : widget.section))
                return <StatWidget
                  key={`${widget.section}-${index}`}
                  label={widget.title}
                  value={widget.value}
                  hint={widget.hint ?? undefined}
                  tone={widget.tone}
                  onClick={widget.href ? () => navigate(widget.href!) : section ? () => navigate(section.path) : undefined}
                />
              })}
            </div>}
        </section>
      </>}
    </div>
  )
}
