import { ConsultChatCore } from './ConsultChatCore'

export function ConsultPanel({ initialMessage = '' }: { initialMessage?: string }) {
  return (
    <div className="flex h-[calc(100vh-16rem)] min-h-[28rem] min-w-0 flex-col rounded-2xl border border-border bg-surface">
      <ConsultChatCore initialMessage={initialMessage} />
    </div>
  )
}
