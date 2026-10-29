import { useEffect, useState } from 'react'
import { apiRequest } from '@/shared/lib/httpClient'

type Review = { decision: 'manual_review'; reasons: { code: string; message: string }[] }

export function AutomaticReview({ orderId }: { orderId: number }) {
  const [review, setReview] = useState<Review | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    setReview(null); setError(false)
    apiRequest<Review>({ section: 'purchasing', path: `/orders/${orderId}/automatic-review` })
      .then((value) => { if (active) setReview(value) })
      .catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [orderId])
  return <section className="rounded-xl border border-border bg-surface-muted p-4" aria-labelledby="automatic-review-title">
    <h3 id="automatic-review-title" className="font-semibold text-ink">Проверка автосогласования</h3>
    {error ? <p role="alert" className="mt-2 text-[13px] text-danger">Проверка недоступна. Обновите страницу; автоматическое решение не подтверждено.</p> : !review ? <p role="status" className="mt-2 text-[13px] text-muted">Проверяем основания…</p> : <><p className="mt-2 text-[13px] font-medium text-warning">Нужна ручная проверка</p><ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] text-muted">{review.reasons.map((reason) => <li key={reason.code}>{reason.message}</li>)}</ul><p className="mt-3 text-[12px] text-muted">Проверка не согласует заказ и не отправляет платёж.</p></>}
  </section>
}
