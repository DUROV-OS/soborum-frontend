import { ChatPickerModal } from '@/max/components/ChatPickerModal'
import { useSuppliersStore } from '../store'

export function LinkMaxChatModal({
  supplierId,
  open,
  onClose,
}: {
  supplierId: number
  open: boolean
  onClose: () => void
}) {
  const linkChat = useSuppliersStore((s) => s.linkChat)
  return <ChatPickerModal open={open} onClose={onClose} onPick={(chat) => linkChat(supplierId, chat.id)} />
}
