import { RefreshCw } from 'lucide-react'
import { useAccessLevel } from '@/app/AccessGate'
import { accessLevelAtLeast } from '@/auth/types'
import { Button } from '@/shared/ui/Button'
import { HelpButton } from '@/shared/ui/HelpButton'
import { OnboardingDialog, OnboardingPage } from '@/shared/ui/OnboardingDialog'
import { useSectionOnboarding } from '@/shared/lib/useSectionOnboarding'
import { BoardChat } from '../components/BoardChat'
import { BoardTree } from '../components/BoardTree'
import { MobileWarningModal } from '../components/MobileWarningModal'
import { NodePopover } from '../components/NodePopover'
import { ProposalPanel } from '../components/ProposalPanel'
import { useBoardStore } from '../store'

const ONBOARDING_PAGES: OnboardingPage[] = [
  {
    title: 'Дерево направлений',
    body: (
      <p>
        Каждая нода дерева — направление или аспект бизнеса. Цвет рамки показывает статус: зелёный — «в порядке»,
        жёлтый — «требует внимания», красный — «критично».
      </p>
    ),
  },
  {
    title: 'Карточка ноды',
    body: (
      <p>
        Кликните по ноде, чтобы открыть окно с её статусом и подробным описанием текущего положения дел,
        составленным ИИ.
      </p>
    ),
  },
  {
    title: 'Внести изменения',
    body: (
      <p>
        В окне ноды есть кнопка «Внести изменения» — опишите словами, что хотите поменять, и совет директоров
        (роли ИИ) обсудит предложение в несколько раундов, выскажется «за», «с оговорками» или «против» и вынесет
        итоговое решение.
      </p>
    ),
  },
  {
    title: 'Актуализация по данным',
    body: (
      <p>
        Администраторам доступна кнопка «Актуализировать по данным» — она пересчитывает статусы и описания нод по
        свежим данным из всех разделов системы.
      </p>
    ),
  },
  {
    title: 'Чат с советом',
    body: (
      <p>
        Под графом — свободный чат с ИИ-советом по компании в целом. Здесь можно задавать вопросы и разбирать
        варианты; в отличие от «Внести изменения», этот диалог ничего не меняет в дереве.
      </p>
    ),
  },
]

export function BoardPage() {
  const canFull = accessLevelAtLeast(useAccessLevel('board'), 'full')
  const actualizing = useBoardStore((s) => s.actualizing)
  const animating = useBoardStore((s) => s.animating)
  const runActualize = useBoardStore((s) => s.runActualize)
  const onboarding = useSectionOnboarding('board')

  return (
    <div>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[20px] font-medium text-ink">Совет директоров</h1>
          <p className="mt-1 text-[13px] text-muted">
            Стратегические направления компании: текущее положение дел и обсуждение изменений с ИИ-советом.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          {canFull && (
            <Button
              variant="secondary"
              disabled={actualizing || animating}
              onClick={() => runActualize()}
            >
              <RefreshCw size={16} className={actualizing ? 'animate-spin' : ''} />
              Актуализировать по данным
            </Button>
          )}
          <HelpButton onClick={onboarding.show} />
        </div>
      </div>

      <BoardTree />
      <BoardChat />
      <NodePopover />
      <ProposalPanel />
      <MobileWarningModal />

      <OnboardingDialog
        open={onboarding.open}
        onClose={onboarding.close}
        title="Раздел «Совет директоров»"
        pages={ONBOARDING_PAGES}
      />
    </div>
  )
}
