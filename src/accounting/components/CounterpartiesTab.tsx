import { useEffect } from 'react'
import { Users } from 'lucide-react'
import { Chip } from '@/shared/ui/Chip'
import { DataTable } from '@/shared/ui/DataTable'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Input, Select } from '@/shared/ui/Field'
import { useAccountingStore } from '../store'
import { COUNTERPARTY_KIND_LABEL, Counterparty, CounterpartyKind } from '../types'
import { rubles } from './MoneySummaryTiles'

/**
 * Вкладка «Контрагенты» (0081-d): единый справочник с поиском и суммами по
 * каждому. Строка открывает карточку с историей платежей.
 */
export function CounterpartiesTab() {
  const counterparties = useAccountingStore((s) => s.counterparties)
  const loading = useAccountingStore((s) => s.counterpartiesLoading)
  const query = useAccountingStore((s) => s.counterpartyQuery)
  const kind = useAccountingStore((s) => s.counterpartyKind)
  const setFilters = useAccountingStore((s) => s.setCounterpartyFilters)
  const load = useAccountingStore((s) => s.loadCounterparties)
  const showCounterparty = useAccountingStore((s) => s.showCounterparty)

  useEffect(() => {
    void load()
  }, [load])

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <Input
          className="w-full sm:w-72"
          placeholder="Поиск по наименованию или ИНН"
          value={query}
          onChange={(e) => setFilters({ query: e.target.value })}
        />
        <Select
          className="w-full sm:w-48"
          value={kind}
          onChange={(e) => setFilters({ kind: e.target.value as CounterpartyKind | 'all' })}
        >
          <option value="all">Любой тип</option>
          {(Object.keys(COUNTERPARTY_KIND_LABEL) as CounterpartyKind[]).map((k) => (
            <option key={k} value={k}>
              {COUNTERPARTY_KIND_LABEL[k]}
            </option>
          ))}
        </Select>
      </div>

      {!loading && counterparties.length === 0 ? (
        <EmptyState
          icon={<Users size={24} />}
          title={query || kind !== 'all' ? 'Под условия ничего не подходит' : 'Справочник пуст'}
          description={
            query || kind !== 'all'
              ? 'Измените поиск или тип.'
              : 'Контрагенты появляются из клиентов, поставщиков и импорта выписки.'
          }
        />
      ) : (
        <DataTable
          columns={[
            {
              header: 'Контрагент',
              accessor: (c: Counterparty) => (
                <div>
                  <div className="text-ink">{c.name}</div>
                  {c.inn && <div className="text-[12px] text-muted">ИНН {c.inn}</div>}
                </div>
              ),
              sortValue: (c: Counterparty) => c.name,
            },
            {
              header: 'Тип',
              accessor: (c: Counterparty) => <Chip tone="neutral">{COUNTERPARTY_KIND_LABEL[c.kind]}</Chip>,
              sortValue: (c: Counterparty) => COUNTERPARTY_KIND_LABEL[c.kind],
            },
            {
              header: 'Приход',
              align: 'right',
              className: 'tabular',
              accessor: (c: Counterparty) => rubles(c.total_income),
              sortValue: (c: Counterparty) => c.total_income,
            },
            {
              header: 'Расход',
              align: 'right',
              className: 'tabular',
              accessor: (c: Counterparty) => (
                <span className={c.total_expense ? 'text-danger' : undefined}>{rubles(c.total_expense)}</span>
              ),
              sortValue: (c: Counterparty) => c.total_expense,
            },
            {
              header: 'Платежей',
              align: 'right',
              className: 'tabular',
              accessor: (c: Counterparty) => c.payments_count,
              sortValue: (c: Counterparty) => c.payments_count,
            },
            {
              header: 'Последний платёж',
              accessor: (c: Counterparty) =>
                c.last_payment_at ? new Date(c.last_payment_at).toLocaleDateString('ru-RU') : '—',
              sortValue: (c: Counterparty) => (c.last_payment_at ? new Date(c.last_payment_at) : new Date(0)),
            },
          ]}
          rows={counterparties}
          keyOf={(c) => String(c.id)}
          onRowClick={(c) => void showCounterparty(c.id)}
          loading={loading}
          emptyLabel="Справочник пуст"
        />
      )}
    </>
  )
}
