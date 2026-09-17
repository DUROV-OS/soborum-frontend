import { Volume2, Wrench } from 'lucide-react'
import { downloadFileById } from '@/shared/lib/httpClient'
import { splitVoiceReply } from '@/shared/lib/speechReply'
import { Markdown } from '@/shared/ui/Markdown'
import { MessageContentBlock, MessageOut, PendingActionOut } from '../types'
import { AttachmentChip } from './AttachmentChip'
import { PendingActionCard } from './PendingActionCard'

export function MessageBubble({
  message,
  pendingActions,
  onResolve,
  preferVoiceLead = false,
  canAct = true,
  describeToolUse,
}: {
  message: MessageOut
  pendingActions: PendingActionOut[]
  onResolve: (id: number, decision: 'approve' | 'reject') => Promise<unknown>
  /** Show explicit «Голосом» résumé above the full answer. */
  preferVoiceLead?: boolean
  canAct?: boolean
  /** Человеко-понятная подпись для уже выполненного tool_use вместо сырого
   * имени инструмента (0051-e) — например `describeToolCall`. Без пропа
   * поведение не меняется (показывается `block.name`, как раньше). */
  describeToolUse?: (block: MessageContentBlock, resolution: unknown) => string
}) {
  if (message.role !== 'user' && message.role !== 'assistant') return null

  const isUser = message.role === 'user'
  const textBlocks = message.content.filter((block) => block.type === 'text' || (!block.type && typeof block.text === 'string'))
  const toolBlocks = message.content.filter((block) => block.type === 'tool_use')
  const fileBlocks = message.content.filter((block) => block.type === 'file_ref')
  const text = textBlocks.map((block) => block.text).filter(Boolean).join('\n\n')
  const relatedActions = pendingActions.filter((action) => action.message_id === message.id)
  const voiceParts = !isUser && preferVoiceLead && text ? splitVoiceReply(text) : null
  const displayText = voiceParts?.hasExplicit ? voiceParts.written : text

  if (!text && toolBlocks.length === 0 && relatedActions.length === 0 && fileBlocks.length === 0) return null

  return (
    <div className={`flex min-w-0 flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
      {fileBlocks.length > 0 && (
        <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5 sm:max-w-md">
          {fileBlocks.map((block, i) => (
            <AttachmentChip
              key={block.file_id ?? i}
              filename={block.filename ?? 'файл'}
              contentType={block.content_type}
              onClick={
                block.file_id ? () => downloadFileById(block.file_id as number, block.filename ?? 'файл') : undefined
              }
            />
          ))}
        </div>
      )}
      {voiceParts?.hasExplicit && voiceParts.spoken && (
        <div className="flex max-w-[85%] items-start gap-2 rounded-md border border-ai/25 bg-ai/10 px-3.5 py-2 text-[13px] leading-relaxed text-ink sm:max-w-md">
          <Volume2 size={14} className="mt-0.5 shrink-0 text-ai-accent" />
          <p>{voiceParts.spoken}</p>
        </div>
      )}
      {displayText && (
        <Markdown
          text={displayText}
          className={`max-w-[85%] break-words rounded-md px-3.5 py-2.5 text-[13px] leading-relaxed sm:max-w-md ${
            isUser ? 'bg-brand text-white' : 'bg-surface-muted text-ink'
          }`}
        />
      )}
      {!isUser &&
        toolBlocks.map(
          (block, i) =>
            !relatedActions.some((a) => a.tool_name === block.name) && (
              <div
                key={block.id ?? i}
                className="flex items-center gap-1.5 rounded-pill bg-surface-muted px-3 py-1 text-[12px] text-muted"
              >
                <Wrench size={12} />
                {describeToolUse
                  ? describeToolUse(block, block.id ? message.tool_resolutions?.[block.id] : undefined)
                  : block.name}
              </div>
            ),
        )}
      {relatedActions.map((action) => (
        <PendingActionCard key={action.id} action={action} onResolve={onResolve} canAct={canAct} />
      ))}
    </div>
  )
}
