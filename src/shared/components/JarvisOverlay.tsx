import { useState } from 'react'
import { ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react'
import { ConsultChatCore } from '@/agents/components/ConsultChatCore'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { useJarvisStore } from '../jarvisStore'

/**
 * Глобальный оверлей Jarvis (0051-a) — смонтирован на уровне `AppShell`, не
 * внутри дерева роутов, поэтому переход между разделами не пересоздаёт чат.
 * Внутри — то же ядро консультационного чата (`ConsultChatCore`), что и на
 * странице `/agents`: общий `useConsultStore`, общая история и `chatId`.
 *
 * Плавающая панель, а не модалка на весь экран: без затемняющего фона,
 * не перехватывает клики за своими границами — работа с разделом под ней
 * не блокируется. Сворачивается в компактную «шапку», не закрывая чат.
 */
export function JarvisOverlay() {
  const canUse = accessLevelAtLeast(useAccessLevel('agents'), 'view')
  const enabled = useJarvisStore((s) => s.enabled)
  const disable = useJarvisStore((s) => s.disable)
  const [collapsed, setCollapsed] = useState(false)

  if (!enabled || !canUse) return null

  return (
    <div className="fixed bottom-4 right-4 z-40 flex w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-ai/25 bg-surface shadow-xl">
      <div className="flex shrink-0 items-center justify-between gap-2 bg-ai-bg px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-ai-accent">
          <Sparkles size={15} />
          Jarvis
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? 'Развернуть Jarvis' : 'Свернуть Jarvis'}
            className="rounded-pill p-1 text-ai-accent hover:bg-ai/15"
          >
            {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            type="button"
            onClick={disable}
            aria-label="Выключить Jarvis"
            className="rounded-pill p-1 text-ai-accent hover:bg-ai/15"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className={collapsed ? 'hidden' : 'flex max-h-[70vh] min-h-[24rem] flex-1 flex-col'}>
        <ConsultChatCore compact handsFree />
      </div>
    </div>
  )
}
