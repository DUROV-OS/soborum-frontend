import { useEffect, useState, type ReactNode } from 'react'
import { apiRequest } from '@/shared/lib/httpClient'
import { useQueryChoice } from '@/shared/lib/useQueryChoice'
import { Button } from '@/shared/ui/Button'
import { Tabs } from '@/shared/ui/Tabs'
import { RelatedDocumentCards, type RelatedDocument } from './OrderDocumentMap'
import { PurchaseDocumentFiles } from './OrderFiles'

const sections = ['positions', 'documents', 'files'] as const
const tabs = [
  { key: sections[0], label: 'Позиции' },
  { key: sections[1], label: 'Связанные документы' },
  { key: sections[2], label: 'Файлы' },
]

export function PurchaseDocumentSections({ resource, id, positions, canUpload }: {
  resource: 'receipts' | 'supplier-invoices'
  id: number
  positions: ReactNode
  canUpload: boolean
}) {
  const [section, setSection] = useQueryChoice('section', sections, 'positions')
  return <div className="min-w-0 space-y-4">
    <Tabs tabs={tabs} activeKey={section} onChange={setSection} />
    {section === 'positions' && positions}
    {section === 'documents' && <DocumentLinks path={`/${resource}/${id}/documents`} />}
    {section === 'files' && <PurchaseDocumentFiles key={id} resource={resource} id={id} canUpload={canUpload} />}
  </div>
}

function DocumentLinks({ path }: { path: string }) {
  const [documents, setDocuments] = useState<RelatedDocument[] | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setDocuments(null)
    setError('')
    apiRequest<RelatedDocument[]>({ section: 'purchasing', path })
      .then(result => { if (active) setDocuments(result) })
      .catch(error => { if (active) setError(error.message) })
    return () => { active = false }
  }, [path, attempt])
  if (error) return <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-danger">
    {error}<Button size="sm" variant="secondary" onClick={() => setAttempt(value => value + 1)}>Повторить</Button>
  </div>
  return <section aria-label="Связанные документы">
    {documents ? <RelatedDocumentCards documents={documents} />
      : <p role="status" className="text-muted">Загружаем связанные документы…</p>}
  </section>
}
