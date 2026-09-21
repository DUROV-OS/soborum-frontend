import { useEffect, useState } from 'react'
import { CircleHelp } from 'lucide-react'
import { Drawer } from '@/shared/ui/Drawer'
import { Chip } from '@/shared/ui/Chip'
import { Button } from '@/shared/ui/Button'
import { Field, Input } from '@/shared/ui/Field'
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
  const update = useAccountingStore((s) => s.update)
  const loadSalaryOverview = useAccountingStore((s) => s.loadSalaryOverview)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accruing, setAccruing] = useState(false)

  const movement = employee?.open_movement ?? null
  // Правка суммы доступна только для draft/approved — тот же принцип, что и в
  // MovementDetailDrawer (0072-d): бэк отказывает для posted/cancelled (409),
  // но поле не должно даже выглядеть редактируемым в этом случае.
  const amountEditable = movement?.status === 'draft' || movement?.status === 'approved'
  const [amountInput, setAmountInput] = useState('')
  const [savingAmount, setSavingAmount] = useState(false)
  const [amountError, setAmountError] = useState<string | null>(null)

  useEffect(() => {
    setAmountInput(movement ? String(movement.amount) : '')
    setAmountError(null)
    setError(null)
  }, [movement?.id, movement?.amount])

  if (!employee) return null

  async function advance(to: 'approved' | 'posted') {
    if (!movement) return
    setBusy(true)
    setError(null)
    const result = await advanceSalaryStatus(movement.id, to)
    setBusy(false)
    if (!result.ok) setError(result.reason ?? 'Не удалось выполнить действие')
  }

  async function saveAmount() {
    if (!movement) return
    const value = Number(amountInput)
    if (!amountInput || Number.isNaN(value) || value <= 0) {
      setAmountError('Укажите положительную сумму')
      return
    }
    setSavingAmount(true)
    setAmountError(null)
    const result = await update(movement.id, { amount: value })
    if (result.ok) await loadSalaryOverview()
    setSavingAmount(false)
    if (!result.ok) setAmountError(result.reason ?? 'Не удалось сохранить сумму')
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

          {movement && amountEditable && (
            <Field label="Сумма, ₽">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={savingAmount || Number(amountInput) === movement.amount}
                  onClick={saveAmount}
                >
                  {savingAmount ? '…' : 'Сохранить'}
                </Button>
              </div>
              {amountError && <span className="mt-1 block text-[12px] text-danger">{amountError}</span>}
            </Field>
          )}

          {movement && !amountEditable && (
            <div>
              <div className="mb-1 text-[13px] text-muted">Сумма</div>
              <div className="text-[15px] text-ink">{money(movement.amount)}</div>
            </div>
          )}

          <div className="text-[13px] text-muted">
            Прошлое начисление:{' '}
            {employee.last_posted_at && employee.last_posted_amount !== null ? (
              <span className="text-ink">
                {new Date(employee.last_posted_at).toLocaleDateString('ru-RU')}, {money(employee.last_posted_amount)}
              </span>
            ) : (
              <span className="text-ink">ещё не было</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[13px] text-muted">
            <span>
              KPI: <span className="text-ink">{employee.kpi}</span>
            </span>
            <span
              title="Черновой показатель: временная случайная заглушка, не настоящий расчёт. Будет заменена в 0042."
            >
              <CircleHelp size={14} />
            </span>
          </div>

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
