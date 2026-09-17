import { useEffect, useState } from 'react'
import { Handshake, Plus } from 'lucide-react'
import { AskAiButton } from '@/ai/components/AskAiButton'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { Chip } from '@/shared/ui/Chip'
import { DataTable } from '@/shared/ui/DataTable'
import { Input } from '@/shared/ui/Field'
import { EmptyState } from '@/shared/ui/EmptyState'
import { useSuppliersStore } from '../store'
import { SUPPLIER_STATUS_LABEL } from '../types'
import { SupplierCreateModal } from '../components/SupplierCreateModal'
import { SupplierDetailDrawer } from '../components/SupplierDetailDrawer'

export function SuppliersPage() {
  const suppliers = useSuppliersStore((s) => s.suppliers)
  const loading = useSuppliersStore((s) => s.loading)
  const loadError = useSuppliersStore((s) => s.loadError)
  const load = useSuppliersStore((s) => s.load)
  const [creating, setCreating] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const canEdit = accessLevelAtLeast(useAccessLevel('warehouse'), 'edit')

  useEffect(() => {
    load()
  }, [load])

  const q = query.trim().toLowerCase()
  const visible = suppliers.filter(
    (s) =>
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.categories.some((c) => c.toLowerCase().includes(q)),
  )

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[20px] font-medium text-ink">Поставщики</h1>
          <p className="mt-1 text-[13px] text-muted">
            Контакты, чат в MAX и прайс-лист по материалам с ценой по размеру партии
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AskAiButton domain="warehouse" />
          {canEdit && (
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} />
              Добавить
            </Button>
          )}
        </div>
      </div>

      {loadError ? (
        <EmptyState
          icon={<Handshake size={24} />}
          title="Раздел недоступен"
          description={loadError}
        />
      ) : (
        <>
          <div className="mb-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по названию или категории…"
              className="sm:max-w-xs"
            />
          </div>
          <DataTable
            columns={[
              { header: 'Поставщик', accessor: (s) => <span className="font-medium text-ink">{s.name}</span> },
              {
                header: 'Категории',
                accessor: (s) =>
                  s.categories.length ? (
                    <div className="flex flex-wrap gap-1">
                      {s.categories.map((c) => (
                        <Chip key={c} tone="neutral">
                          {c}
                        </Chip>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[12px] text-muted">—</span>
                  ),
              },
              {
                header: 'Статус',
                accessor: (s) => (
                  <Chip tone={s.status === 'active' ? 'success' : 'neutral'}>
                    {SUPPLIER_STATUS_LABEL[s.status]}
                  </Chip>
                ),
              },
              {
                header: 'Прайс',
                align: 'right',
                accessor: (s) => `${s.price_items_count} поз.`,
                className: 'tabular',
              },
              {
                header: 'Чат MAX',
                accessor: (s) =>
                  s.max_chat_id != null ? (
                    <Chip tone="info">привязан</Chip>
                  ) : (
                    <span className="text-[12px] text-muted">—</span>
                  ),
              },
            ]}
            rows={visible}
            keyOf={(s) => String(s.id)}
            onRowClick={(s) => setSelectedId(s.id)}
            loading={loading}
            emptyLabel="Поставщиков пока нет — нажмите «Добавить»"
          />
        </>
      )}

      <SupplierCreateModal open={creating} onClose={() => setCreating(false)} />
      <SupplierDetailDrawer supplierId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  )
}
