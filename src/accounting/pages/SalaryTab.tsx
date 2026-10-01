import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { Chip } from '@/shared/ui/Chip'
import { DataTable } from '@/shared/ui/DataTable'
import { EmptyState } from '@/shared/ui/EmptyState'
import { EmployeeCardDrawer } from '../components/EmployeeCardDrawer'
import { useAccountingStore } from '../store'
import { STATUS_LABEL, STATUS_TONE } from '../types'

function money(amount: number): string {
  return `${amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`
}

export function SalaryTab() {
  const overview = useAccountingStore((s) => s.salaryOverview)
  const loading = useAccountingStore((s) => s.salaryLoading)
  const load = useAccountingStore((s) => s.loadSalaryOverview)

  const [openEmployeeId, setOpenEmployeeId] = useState<number | null>(null)

  useEffect(() => {
    load()
  }, [load])

  // Карточка держит employee_id, а не сам объект — после действия в карточке
  // (начислить/утвердить/выплатить) overview перезагружается и строка должна
  // отражать новое состояние, не замороженный снимок на момент клика.
  const openEmployee = overview.find((row) => row.employee_id === openEmployeeId) ?? null

  if (!loading && overview.length === 0) {
    return (
      <EmptyState
        icon={<Users size={24} />}
        title="Сотрудников пока нет"
        description="Активные пользователи появятся здесь автоматически."
      />
    )
  }

  return (
    <div>
      <DataTable
        columns={[
          { header: 'Сотрудник', accessor: (row) => row.full_name },
          {
            header: 'Статус начисления',
            accessor: (row) =>
              row.open_movement ? (
                <Chip tone={STATUS_TONE[row.open_movement.status]}>
                  {STATUS_LABEL[row.open_movement.status]}
                </Chip>
              ) : (
                <span className="text-muted">Нет открытой проводки</span>
              ),
          },
          {
            header: 'Сумма',
            align: 'right',
            className: 'tabular',
            accessor: (row) => (row.open_movement ? money(row.open_movement.amount) : '—'),
          },
        ]}
        rows={overview}
        keyOf={(row) => String(row.employee_id)}
        onRowClick={(row) => setOpenEmployeeId(row.employee_id)}
        loading={loading}
        emptyLabel="Сотрудников пока нет"
      />

      <EmployeeCardDrawer employee={openEmployee} onClose={() => setOpenEmployeeId(null)} />
    </div>
  )
}
