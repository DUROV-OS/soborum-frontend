import { Sparkles } from 'lucide-react'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { useJarvisStore } from '../jarvisStore'

/**
 * Тумблер «Jarvis» в Topbar (0051-a) — тот же гейт доступа, что у страницы
 * `/agents` (`AccessGate section="agents"`, минимум `view`): доступен любому
 * вошедшему сотруднику, как «Пульс». Включает/выключает глобальный оверлей
 * `JarvisOverlay`, смонтированный на уровне `AppShell`.
 */
export function JarvisToggle() {
  const canUse = accessLevelAtLeast(useAccessLevel('agents'), 'view')
  const enabled = useJarvisStore((s) => s.enabled)
  const toggle = useJarvisStore((s) => s.toggle)

  if (!canUse) return null

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Режим «Jarvis»"
      aria-pressed={enabled}
      title={enabled ? 'Выключить Jarvis' : 'Включить Jarvis — голосовое управление системой'}
      className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[13px] font-medium transition-colors ${
        enabled ? 'border-ai/30 bg-ai-bg text-ai-accent' : 'border-ai/25 text-ai-accent hover:bg-ai-bg'
      }`}
    >
      <Sparkles size={14} />
      <span className="hidden sm:inline">Jarvis</span>
      {enabled && <span className="h-2 w-2 animate-pulse rounded-pill bg-ai-accent" />}
    </button>
  )
}
