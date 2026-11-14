import { CalendarDays, ClipboardList, FileText, FolderKanban, HardDrive, LayoutDashboard, Mail, MessagesSquare, Mic, Newspaper, Sparkles } from 'lucide-react'

const icons = { messenger: MessagesSquare, gpt: Sparkles, feed: Newspaper, calendar: CalendarDays, documents: FileText, boards: LayoutDashboard, drive: HardDrive, mail: Mail, projects: FolderKanban, tasks: ClipboardList, meetings: Mic }
export function ToolIcon({ id, size = 20 }: { id: string; size?: number }) {
  const Icon = icons[id as keyof typeof icons] ?? FolderKanban
  return <Icon aria-hidden="true" size={size} strokeWidth={1.6} className="shrink-0"/>
}
