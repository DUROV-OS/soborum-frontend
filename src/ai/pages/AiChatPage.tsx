import { MouseEvent, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Sparkles, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '@/auth/store'
import { Button } from '@/shared/ui/Button'
import { HelpButton } from '@/shared/ui/HelpButton'
import { OnboardingDialog, OnboardingPage } from '@/shared/ui/OnboardingDialog'
import { Tabs } from '@/shared/ui/Tabs'
import { useSectionOnboarding } from '@/shared/lib/useSectionOnboarding'
import { AgentActivitySection } from '../components/AgentActivitySection'
import { ChatPanel } from '../components/ChatPanel'
import { GrowthSection } from '../components/GrowthSection'
import { useAiStore } from '../store'
import { ChatDomain, DOMAIN_LABEL, DOMAIN_TO_SECTION } from '../types'

type MarinaTab = 'chat' | 'growth'

const ALL_DOMAINS: ChatDomain[] = ['general', 'clients', 'production', 'cycle', 'warehouse', 'marketing', 'tasks']

const ONBOARDING_PAGES: OnboardingPage[] = [
  {
    title: 'Чаты по разделам',
    body: (
      <p>
        Вкладки сверху списка чатов — это разделы: «Общий» и по одному на каждый раздел, к которому у вас есть
        доступ. Выбор вкладки фильтрует список и определяет, в контексте какого раздела ИИ будет отвечать в
        новом чате.
      </p>
    ),
  },
  {
    title: 'Новый чат',
    body: (
      <p>
        Кнопка «Новый чат» создаёт переписку в выбранном разделе. ИИ учитывает данные этого раздела при ответах —
        например, в «Складе» он видит остатки материалов, а в «Клиентах» — карточки клиентов.
      </p>
    ),
  },
  {
    title: 'Управление чатами',
    body: (
      <p>
        Кликните по чату в списке, чтобы открыть переписку. При наведении на чат появляется значок корзины —
        удаляет чат безвозвратно.
      </p>
    ),
  },
]

export function AiChatPage() {
  const { chatId } = useParams()
  const location = useLocation()
  const initialMessage = !chatId && typeof location.state?.draftMessage === 'string' ? location.state.draftMessage : ''
  const navigate = useNavigate()
  const hasAccess = useAuthStore((s) => s.hasAccess)
  const chats = useAiStore((s) => s.chats)
  const chatsLoading = useAiStore((s) => s.chatsLoading)
  const activeChat = useAiStore((s) => s.activeChat)
  const draftDomain = useAiStore((s) => s.draftDomain)
  const loadChats = useAiStore((s) => s.loadChats)
  const openChat = useAiStore((s) => s.openChat)
  const startDraft = useAiStore((s) => s.startDraft)
  const removeChat = useAiStore((s) => s.removeChat)

  // На мобильной ширине список чатов и переписка не помещаются рядом — показываем одно за раз.
  const showChatPanel = Boolean(chatId) || draftDomain !== null
  // На мобильной ширине (ниже lg) весь чат — сворачиваемый виджет над «Действиями агента»,
  // изначально свёрнут; открытие конкретного чата/черновика само его разворачивает.
  const [mobileChatOpen, setMobileChatOpen] = useState(false)

  const domains = ALL_DOMAINS.filter((d) => d === 'general' || hasAccess(DOMAIN_TO_SECTION[d]))
  const [domain, setDomain] = useState<ChatDomain>('general')
  const [tab, setTab] = useState<MarinaTab>('chat')
  const onboarding = useSectionOnboarding('ai')

  useEffect(() => {
    if (showChatPanel) setMobileChatOpen(true)
  }, [showChatPanel])

  useEffect(() => {
    loadChats(domain)
  }, [domain, loadChats])

  useEffect(() => {
    // Пропускаем повторную загрузку, если чат только что создан первым сообщением —
    // он уже лежит в activeChat, а URL просто синхронизировался следом.
    if (chatId && useAiStore.getState().activeChat?.id !== Number(chatId)) {
      openChat(Number(chatId))
    }
  }, [chatId, openChat])

  useEffect(() => {
    if (activeChat) setDomain(activeChat.domain)
  }, [activeChat?.id, activeChat?.domain])

  function handleNewChat() {
    startDraft(domain)
    navigate('/ai')
  }

  async function handleDelete(id: number, e: MouseEvent) {
    e.stopPropagation()
    await removeChat(id)
    if (String(id) === chatId) navigate('/ai')
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        tabs={[
          { key: 'chat' as MarinaTab, label: 'Чат' },
          { key: 'growth' as MarinaTab, label: 'Развитие' },
        ]}
        activeKey={tab}
        onChange={setTab}
      />

      {tab === 'growth' && <GrowthSection />}

      {tab === 'chat' && (
        <div className="flex flex-col gap-3 lg:h-[calc(100vh-10rem)] lg:min-h-[480px] lg:flex-row lg:gap-4">
          {/* Колонка чата: на десктопе (lg+) — фиксированной ширины, узкая, чтобы освободить
              место «Действиям агента» справа. На мобильной ширине — сворачиваемый виджет:
              изначально свёрнут, разворачивается по тапу или при открытии конкретного чата. */}
          <div className="flex min-h-0 flex-col gap-3 lg:h-full lg:shrink-0">
            <button
              type="button"
              onClick={() => setMobileChatOpen((open) => !open)}
              className="flex items-center justify-between gap-3 rounded-md border border-ai/30 bg-ai-bg px-4 py-3 text-left lg:hidden"
            >
              <span className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ai/15">
                  <Sparkles size={16} className="text-ai-accent" />
                </span>
                <span className="text-[13px] font-medium text-ink">
                  {activeChat?.title || 'Марина'}
                </span>
              </span>
              {mobileChatOpen ? (
                <ChevronUp size={16} className="shrink-0 text-muted" />
              ) : (
                <ChevronDown size={16} className="shrink-0 text-muted" />
              )}
            </button>

            <div
              className={`min-h-0 gap-3 lg:flex lg:h-full lg:flex-1 lg:flex-row ${
                mobileChatOpen ? 'flex h-[65vh]' : 'hidden'
              }`}
            >
              <div
                className={`w-full min-w-0 flex-col rounded-md border border-border bg-surface sm:flex sm:w-72 sm:shrink-0 ${
                  showChatPanel ? 'hidden' : 'flex'
                }`}
              >
                <div className="flex flex-col gap-2 border-b border-border p-3">
                  <div className="flex flex-wrap gap-1">
                    {domains.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDomain(d)}
                        className={`rounded-pill px-2.5 py-1 text-[12px] font-medium transition-colors ${
                          d === domain ? 'bg-ai/10 text-ai-accent' : 'text-muted hover:bg-surface-muted hover:text-ink'
                        }`}
                      >
                        {DOMAIN_LABEL[d]}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ai" size="sm" className="flex-1" onClick={handleNewChat}>
                      <Plus size={14} />
                      Новый чат
                    </Button>
                    <HelpButton onClick={onboarding.show} />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                  {chatsLoading && <p className="px-2 py-2 text-[12px] text-muted">Загрузка…</p>}
                  {!chatsLoading && chats.length === 0 && (
                    <p className="px-2 py-2 text-[12px] text-muted">Чатов пока нет — начните новый.</p>
                  )}
                  <div className="flex flex-col gap-1">
                    {chats.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => navigate(`/ai/${c.id}`)}
                        className={`group flex items-start justify-between gap-2 rounded-sm px-3 py-2 text-left transition-colors ${
                          String(c.id) === chatId ? 'bg-ai/10' : 'hover:bg-surface-muted'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium text-ink">{c.title ?? 'Без названия'}</div>
                          <div className="mt-0.5 text-[11px] text-muted">
                            {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ru })}
                          </div>
                        </div>
                        <span
                          role="button"
                          onClick={(e) => handleDelete(c.id, e)}
                          aria-label="Удалить чат"
                          className="shrink-0 rounded-pill p-1 text-muted opacity-0 hover:bg-danger-bg hover:text-danger group-hover:opacity-100"
                        >
                          <Trash2 size={13} />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div
                className={`min-w-0 flex-1 rounded-md border border-border bg-surface sm:flex lg:w-[480px] lg:flex-none ${
                  showChatPanel ? 'flex' : 'hidden'
                }`}
              >
                <ChatPanel
                  initialMessage={initialMessage}
                  onDeleted={() => navigate('/ai')}
                  onChatCreated={(id) => navigate(`/ai/${id}`, { replace: true })}
                  onBack={() => {
                    navigate('/ai')
                    useAiStore.setState({ draftDomain: null })
                  }}
                />
              </div>
            </div>
          </div>

          <AgentActivitySection className="lg:min-h-0 lg:flex-1" />
        </div>
      )}

      <OnboardingDialog
        open={onboarding.open}
        onClose={onboarding.close}
        title="Раздел «ИИ-ассистент»"
        pages={ONBOARDING_PAGES}
      />
    </div>
  )
}
