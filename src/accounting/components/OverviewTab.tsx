import { Landmark } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/ui/DataTable'
import { EmptyState } from '@/shared/ui/EmptyState'
import { useAccountingStore } from '../store'
import { AccountSummary, OrganizationSummary } from '../types'
import { MoneySummaryTiles, rubles } from './MoneySummaryTiles'

function amountCell(value: number, tone: 'income' | 'expense' | 'balance') {
  const danger = tone === 'expense' || (tone === 'balance' && value < 0)
  return <span className={danger ? 'text-danger' : 'text-ink'}>{rubles(value)}</span>
}

/**
 * Вкладка «Сводка» (0081-b): деньги обеих организаций на одном экране —
 * по каждому счёту, по организации и итогом. Клик по строке организации
 * переводит на её вкладку.
 */
export function OverviewTab() {
  const summary = useAccountingStore((s) => s.summary)
  const loading = useAccountingStore((s) => s.summaryLoading)
  const selectOrganization = useAccountingStore((s) => s.selectOrganization)
  const loadSummary = useAccountingStore((s) => s.loadSummary)
  const [, setParams] = useSearchParams()

  if (!loading && !summary) return <EmptyState title="Сводка временно недоступна" description="Данные не загружены; это не означает отсутствие операций." action={<Button onClick={() => void loadSummary()}>Повторить загрузку</Button>} />

  if (!loading && (!summary || summary.organizations.length === 0)) {
    return (
      <EmptyState
        icon={<Landmark size={24} />}
        title="Организации не заведены"
        description="Пока нет ни одного юрлица со счётом — сводить нечего."
      />
    )
  }

  // Строка на организацию и по строке на каждый её счёт, с отступом.
  type Row = { key: string; label: string; nested: boolean; totals: OrganizationSummary | AccountSummary; orgId: number }
  const rows: Row[] = []
  for (const org of summary?.organizations ?? []) {
    rows.push({ key: `org-${org.organization_id}`, label: org.name, nested: false, totals: org, orgId: org.organization_id })
    for (const account of org.accounts) {
      rows.push({
        key: `acc-${account.account_id}`,
        label: account.name,
        nested: true,
        totals: account,
        orgId: org.organization_id,
      })
    }
  }

  return (
    <>
      <MoneySummaryTiles
        totals={summary?.total ?? null}
        loading={loading}
        hint="Все организации, проведённые записи реестра"
      />
      <DataTable
        columns={[
          {
            header: 'Организация и счёт',
            accessor: (r: Row) => (
              <span className={r.nested ? 'pl-4 text-muted' : 'text-ink'}>{r.label}</span>
            ),
          },
          {
            header: 'Приход',
            align: 'right',
            className: 'tabular',
            accessor: (r: Row) => amountCell(r.totals.income, 'income'),
          },
          {
            header: 'Расход',
            align: 'right',
            className: 'tabular',
            accessor: (r: Row) => amountCell(r.totals.expense, 'expense'),
          },
          {
            header: 'Сальдо',
            align: 'right',
            className: 'tabular',
            accessor: (r: Row) => amountCell(r.totals.balance, 'balance'),
          },
          {
            header: 'Проводок',
            align: 'right',
            className: 'tabular',
            accessor: (r: Row) => r.totals.count,
          },
        ]}
        rows={rows}
        keyOf={(r) => r.key}
        onRowClick={(r) => { selectOrganization(r.orgId); setParams(previous => { const next = new URLSearchParams(previous); next.set('tab', 'register'); return next }) }}
        loading={loading}
        emptyLabel="Сводить нечего"
      />
    </>
  )
}
