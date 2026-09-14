export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <h3 className="mb-4 text-[14px] font-medium text-ink">{title}</h3>
      {children}
    </div>
  )
}

export function ReadRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border py-2 text-[13px] last:border-0">
      <span className="text-muted">{label}</span>
      <span className="text-ink">{value || '—'}</span>
    </div>
  )
}
