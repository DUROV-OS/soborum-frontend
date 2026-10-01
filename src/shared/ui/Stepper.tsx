import { useEffect, useRef } from 'react'
import { Check } from 'lucide-react'

export interface StepperStep {
  key: string
  label: string
}

export function Stepper({
  steps,
  currentKey,
}: {
  steps: StepperStep[]
  currentKey: string
}) {
  const currentIndex = steps.findIndex((s) => s.key === currentKey)
  const currentRef = useRef<HTMLLIElement>(null)

  // Шагов может быть больше, чем влезает в ширину карточки (путь клиента из
  // восьми стадий — 0079), и тогда лента уезжает вбок. Подтягиваем текущий
  // шаг в видимую часть, иначе непонятно, где вообще находится карточка.
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [currentKey])

  return (
    <ol className="flex items-stretch overflow-x-auto">
      {steps.map((step, index) => {
        const isDone = index < currentIndex
        const isCurrent = index === currentIndex
        return (
          <li
            key={step.key}
            ref={isCurrent ? currentRef : undefined}
            className="flex flex-1 items-center last:flex-none"
          >
            <div className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-pill text-[12px] font-medium ${
                  isDone
                    ? 'bg-brand text-white'
                    : isCurrent
                      ? 'bg-brand/10 text-brand-dark ring-1 ring-inset ring-brand'
                      : 'bg-surface-muted text-muted'
                }`}
              >
                {isDone ? <Check size={13} /> : index + 1}
              </span>
              <span
                className={`whitespace-nowrap text-[13px] ${
                  isCurrent ? 'font-medium text-ink' : isDone ? 'text-ink/70' : 'text-muted'
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <span
                className={`mx-3 h-px flex-1 ${isDone ? 'bg-brand' : 'bg-border'}`}
                aria-hidden
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
