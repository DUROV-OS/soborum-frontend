import { useState } from 'react'
import { Tabs } from '@/shared/ui/Tabs'
import { SectionStub } from '../components/SectionStub'
import { ProductionOverviewPage } from './ProductionOverviewPage'

/**
 * Раздел «Производство» делится не на «модули», а на функциональные разделы
 * (запрос Арсения от 16.09.2026, эпик 0062): Главная / Поставка / Сборка /
 * Остальное. Сегодня реальным содержимым наполнена только «Сборка» — туда
 * переехал весь прежний функционал без изменений (ProductionOverviewPage и
 * дальше по её собственным маршрутам /production/:id, /production/modules/:id
 * — эти маршруты не трогали, чтобы не сломать внешние ссылки).
 *
 * По умолчанию открыта «Сборка», а не «Главная» — иначе первым экраном при
 * заходе в «Производство» была бы заглушка вместо рабочего функционала.
 * Поменять на «Главная», когда там появится реальный контент (виджеты
 * «Требует внимания» / «Актуальное» / «Сроки»).
 */

const TABS = [
  { key: 'glavnaya', label: 'Главная' },
  { key: 'postavka', label: 'Поставка' },
  { key: 'sborka', label: 'Сборка' },
  { key: 'ostalnoe', label: 'Остальное' },
] as const

type TabKey = (typeof TABS)[number]['key']

export function ProductionSectionPage() {
  const [tab, setTab] = useState<TabKey>('sborka')

  return (
    <div>
      <Tabs tabs={[...TABS]} activeKey={tab} onChange={setTab} />
      <div className="pt-5">
        {tab === 'glavnaya' && <SectionStub title="Главная" />}
        {tab === 'postavka' && <SectionStub title="Поставка" />}
        {tab === 'sborka' && <ProductionOverviewPage />}
        {tab === 'ostalnoe' && <SectionStub title="Остальное" />}
      </div>
    </div>
  )
}
