import { useState } from 'react'
import { Drawer } from '@/shared/ui/Drawer'
import { Chip } from '@/shared/ui/Chip'
import { Button } from '@/shared/ui/Button'
import { useAccountingStore } from '../store'
import { EmployeeSalaryOverview, STATUS_LABEL, STATUS_TONE } from '../types'
import { AccrueSalaryModal } from './AccrueSalaryModal'

function money(amount: number): string {
  return `${amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`
}

export function EmployeeCardDrawer({
  employee,
  onClose,
}: {
  employee: EmployeeSalaryOverview | null
  onClose: () => void
}) {
  const advanceSalaryStatus = useAccountingStore((s) => s.advanceSalaryStatus)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accruing, setAccruing] = useState(false)

  if (!employee) return null

  const movement = employee.open_movement

  async function advance(to: 'approved' | 'posted') {
    if (!movement) return
    setBusy(true)
    setError(null)
    const result = await advanceSalaryStatus(movement.id, to)
    setBusy(false)
    if (!result.ok) setError(result.reason ?? 'Не удалось выполнить действие')
  }

  return (
    <>
      <Drawer open={!!employee} onClose={onClose} title={employee.full_name}>
        <div className="flex flex-col gap-5">
          <div>
            <div className="mb-1 text-[13px] text-muted">Статус начисления</div>
            {movement ? (
              <Chip tone={STATUS_TONE[movement.status]}>{STATUS_LABEL[movement.status]}</Chip>
            ) : (
              <span className="text-[13px] text-muted">Нет открытой проводки</span>
            )}
          </div>

          {movement && (
            <div>
              <div className="mb-1 text-[13px] text-muted">Сумма</div>
              <div className="text-[15px] text-ink">{money(movement.amount)}</div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {!movement && (
              <Button size="sm" disabled={busy} onClick={() => setAccruing(true)}>
                Начислить
              </Button>
            )}
            {movement?.status === 'draft' && (
              <Button size="sm" disabled={busy} onClick={() => advance('approved')}>
                Утвердить
              </Button>
            )}
            {movement?.status === 'approved' && (
              <Button size="sm" disabled={busy} onClick={() => advance('posted')}>
                Выплатить
              </Button>
            )}
          </div>

          {error && <p className="text-[12px] text-danger">{error}</p>}
        </div>
      </Drawer>

      <AccrueSalaryModal
        employeeId={accruing ? employee.employee_id : null}
        employeeName={employee.full_name}
        onClose={() => setAccruing(false)}
      />
    </>
  )
}
