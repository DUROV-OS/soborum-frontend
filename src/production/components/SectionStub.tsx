export function SectionStub({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-md border border-dashed border-border px-6 py-16 text-center">
      <h2 className="text-[16px] font-medium text-ink">
        {title} — раздел в разработке 🚧
      </h2>
      <img src="/meme.jpg" alt="" className="max-w-xs rounded-md" />
    </div>
  )
}
