import { useEffect, useState } from 'react'
import { BellOff } from 'lucide-react'
import { useNotificationsStore } from '../store'
import { MUTABLE_MODULES, moduleLabel } from '../types'

/**
 * Вкладка «Настройки» на странице уведомлений (0080-d): мьют раздела
 * целиком (переключатель) и список точечных мьютов объектов со снятием.
 * Добавление точечного мьюта прямо из карточки объекта (клиент/производство/
 * пост/проводка) — следующий шаг, не вошедший в эту задачу (см. журнал
 * 0080-d): здесь только список и снятие через то же API `PUT /mutes`.
 */
export function NotificationSettingsTab() {
  const mutes = useNotificationsStore((s) => s.mutes)
  const loadMutes = useNotificationsStore((s) => s.loadMutes)
  const setMute = useNotificationsStore((s) => s.setMute)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadMutes().catch((e) => setError(e instanceof Error ? e.message : 'Не удалось загрузить настройки'))
  }, [loadMutes])

  const moduleMuted = new Set(mutes.filter((m) => m.object_id === null).map((m) => m.module))
  const objectMutes = mutes.filter((m) => m.object_id !== null)

  async function toggleModule(moduleId: string, muted: boolean) {
    setError(null)
    try {
      await setMute(moduleId, null, muted)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось изменить настройку')
    }
  }

  async function removeObjectMute(moduleId: string, objectId: number) {
    setError(null)
    try {
      await setMute(moduleId, objectId, false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось снять мьют')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-[13px] text-danger">{error}</p>}

      <div>
        <h2 className="mb-2 text-[14px] font-medium text-ink">Разделы</h2>
        <p className="mb-3 text-[12px] text-muted">
          Выключите раздел целиком — уведомления по нему перестанут приходить. Касается только ваших
          личных уведомлений.
        </p>
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
          {MUTABLE_MODULES.map((m) => {
            const muted = moduleMuted.has(m.id)
            return (
              <label key={m.id} className="flex items-center justify-between gap-3 py-1 text-[13px] text-ink">
                <span>{m.label}</span>
                <span className="inline-flex items-center gap-2">
                  {muted && <BellOff size={13} className="text-muted" />}
                  <input
                    type="checkbox"
                    aria-label={`Уведомления: ${m.label}`}
                    checked={!muted}
                    onChange={(e) => toggleModule(m.id, !e.target.checked)}
                    className="h-4 w-4 accent-[#395b4b]"
                  />
                </span>
              </label>
            )
          })}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-[14px] font-medium text-ink">Точечные мьюты</h2>
        <p className="mb-3 text-[12px] text-muted">
          Конкретные объекты, по которым вы отключили уведомления (замьючиваются из карточки объекта).
        </p>
        {objectMutes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted">
            Точечных мьютов нет.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {objectMutes.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-[13px]"
              >
                <span className="text-ink">
                  {moduleLabel(m.module)} · объект #{m.object_id}
                </span>
                <button
                  type="button"
                  onClick={() => removeObjectMute(m.module, m.object_id as number)}
                  className="rounded-pill border border-border px-2.5 py-1 text-[12px] text-ink hover:border-brand/40"
                >
                  Снять мьют
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
