import { Chip } from '@/shared/ui/Chip'
import { DataTable } from '@/shared/ui/DataTable'
import { Drawer } from '@/shared/ui/Drawer'
import { useAccountingStore } from '../store'
import {
  COUNTERPARTY_KIND_LABEL,
  DIRECTION_LABEL,
  MoneyMovement,
  STATUS_LABEL,
  STATUS_TONE,
  SUBKIND_LABEL,
} from '../types'
import { rubles } from './MoneySummaryTiles'

/**
 * Карточка контрагента (0081-d): суммы по нему и вся история платежей — по
 * обеим организациям, а не только по открытому счёту: вопрос «сколько мы ему
 * заплатили» задают про компанию целиком.
 */
export function CounterpartyDrawer({ onOpenMovement }: { onOpenMovement: (id: number) => void }) {
  const counterparty = useAccountingStore((s) => s.openCounterparty)
  const openId = useAccountingStore((s) => s.openCounterpartyId)
  const payments = useAccountingStore((s) => s.counterpartyPayments)
  const loading = useAccountingStore((s) => s.counterpartyCardLoading)
  const showCounterparty = useAccountingStore((s) => s.showCounterparty)

  if (openId === null) return null

  return (
    <Drawer
      open
      onClose={() => void showCounterparty(null)}
      title={counterparty?.name ?? 'Контрагент'}
      subtitle={
        counterparty && (
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="neutral">{COUNTERPARTY_KIND_LABEL[counterparty.kind]}</Chip>
            {counterparty.inn && <span>ИНН {counterparty.inn}</span>}
            {!counterparty.is_active && <Chip tone="danger">В архиве</Chip>}
          </div>
        )
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-3 gap-3 text-[13px]">
          <div>
            <div className="text-muted">Приход</div>
            <div className="tabular mt-1 text-[18px] text-success">
              {rubles(counterparty?.total_income ?? 0)}
            </div>
          </div>
          <div>
            <div className="text-muted">Расход</div>
            <div className="tabular mt-1 text-[18px] text-danger">
              {rubles(counterparty?.total_expense ?? 0)}
            </div>
          </div>
          <div>
            <div className="text-muted">Платежей</div>
            <div className="tabular mt-1 text-[18px] text-ink">{counterparty?.payments_count ?? 0}</div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-[13px] text-muted">История платежей</div>
          <DataTable
            columns={[
              {
                header: 'Дата',
                accessor: (m: MoneyMovement) =>
                  new Date(m.doc_date ?? m.posted_at ?? m.created_at).toLocaleDateString('ru-RU'),
              },
              {
                header: 'Счёт',
                accessor: (m: MoneyMovement) =>
                  m.account_name ? `${m.organization_name ?? ''} ${m.account_name}`.trim() : '—',
              },
              {
                header: 'Статья',
                accessor: (m: MoneyMovement) => (
                  <div>
                    <div className="text-ink">{SUBKIND_LABEL[m.subkind]}</div>
                    <div className="text-[12px] text-muted">{DIRECTION_LABEL[m.direction]}</div>
                  </div>
                ),
              },
              {
                header: 'Сумма',
                align: 'right',
                className: 'tabular',
                accessor: (m: MoneyMovement) => (
                  <span className={m.direction === 'expense' ? 'text-danger' : 'text-ink'}>
                    {m.direction === 'expense' ? '−' : ''}
                    {rubles(m.amount)}
                  </span>
                ),
              },
              {
                header: 'Статус',
                accessor: (m: MoneyMovement) => <Chip tone={STATUS_TONE[m.status]}>{STATUS_LABEL[m.status]}</Chip>,
              },
            ]}
            rows={payments}
            keyOf={(m) => String(m.id)}
            onRowClick={(m) => onOpenMovement(m.id)}
            loading={loading}
            emptyLabel="Платежей по этому контрагенту ещё не было"
          />
        </div>

        {counterparty?.comment && (
          <div className="text-[13px]">
            <div className="text-muted">Комментарий</div>
            <div className="whitespace-pre-wrap text-ink">{counterparty.comment}</div>
          </div>
        )}
      </div>
    </Drawer>
  )
}
