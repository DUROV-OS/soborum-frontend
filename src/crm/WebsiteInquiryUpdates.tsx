import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Bell, BellOff, BellRing, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ApiError, apiRequest } from '@/shared/lib/httpClient'
import { ringForInquiries, saveSoundPreference, soundPreference } from './websiteInquirySound'

type Snapshot = { cursor: string; entries: { id: number; notify: boolean }[] }
type SoundControl = { enabled: boolean; ready: boolean; toggle: () => void }
const InboxRevision = createContext(0)
const Sound = createContext<SoundControl | null>(null)

export function useWebsiteInboxRevision() {
  return useContext(InboxRevision)
}

export function WebsiteInquirySoundButton() {
  const sound = useContext(Sound)
  if (!sound) return null

  const audible = sound.enabled && sound.ready
  const label = audible ? 'Выключить звук заявок' : 'Включить звук заявок'
  const Icon = audible ? BellRing : BellOff
  return <button type="button" aria-label={label} title={label} aria-pressed={audible}
    onClick={sound.toggle}
    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-inherit hover:bg-white/10">
    <Icon size={18} aria-hidden="true" />
  </button>
}

export function WebsiteInquiryUpdates({ enabled, soundUserId, children }: {
  enabled: boolean
  soundUserId?: number
  children: ReactNode
}) {
  const [revision, setRevision] = useState(0)
  const [notice, setNotice] = useState<number[]>([])
  const [soundEnabled, setSoundEnabled] = useState(() => soundUserId !== undefined && soundPreference(soundUserId))
  const [audioReady, setAudioReady] = useState(false)
  const audio = useRef<AudioContext | null>(null)

  const prepareAudio = useCallback(() => {
    try {
      const Audio = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Audio) return
      const context = audio.current ?? new Audio()
      audio.current = context
      context.onstatechange = () => setAudioReady(context.state === 'running')
      if (context.state === 'running') setAudioReady(true)
      else void context.resume().catch(() => {})
    } catch {
      // A blocked audio device never prevents the visible alert or inbox refresh.
    }
  }, [])

  useEffect(() => {
    if (!soundEnabled || audioReady) return
    document.addEventListener('click', prepareAudio)
    document.addEventListener('keydown', prepareAudio)
    return () => {
      document.removeEventListener('click', prepareAudio)
      document.removeEventListener('keydown', prepareAudio)
    }
  }, [audioReady, prepareAudio, soundEnabled])

  useEffect(() => () => {
    const context = audio.current
    if (context) {
      context.onstatechange = null
      void context.close().catch(() => {})
      audio.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    let cursor: string | undefined
    let retry = 1000
    const seen = new Set<number>()
    let cancelDelay: (() => void) | undefined

    async function watch() {
      while (!controller.signal.aborted) {
        try {
          const snapshot = await apiRequest<Snapshot | undefined>({
            section: 'crm',
            path: '/inquiries/live',
            query: { cursor },
            timeoutMs: 27_000,
            signal: controller.signal,
          })
          if (controller.signal.aborted) return
          retry = 1000
          if (!snapshot) continue

          const fresh = snapshot.entries.filter(entry => !seen.has(entry.id) && entry.notify)
          for (const entry of snapshot.entries) seen.add(entry.id)
          setRevision(value => value + 1)
          if (cursor !== undefined && soundUserId !== undefined && fresh.length) {
            const ids = fresh.map(entry => entry.id)
            setNotice(ids)
            if (audio.current) ringForInquiries(audio.current, soundUserId, ids)
          }
          cursor = snapshot.cursor
        } catch (error) {
          if (controller.signal.aborted || (error instanceof ApiError && [401, 403].includes(error.status))) return
          await new Promise<void>(resolve => {
            const timer = window.setTimeout(resolve, retry)
            cancelDelay = () => { window.clearTimeout(timer); resolve() }
          })
          cancelDelay = undefined
          retry = Math.min(retry * 2, 15_000)
        }
      }
    }

    void watch()
    return () => {
      controller.abort()
      cancelDelay?.()
    }
  }, [enabled, soundUserId])

  const toggleSound = () => {
    if (soundUserId === undefined) return
    const next = !soundEnabled || !audioReady
    saveSoundPreference(soundUserId, next)
    setSoundEnabled(next)
    if (next) prepareAudio()
  }

  return <InboxRevision.Provider value={revision}>
    <Sound.Provider value={soundUserId !== undefined ? { enabled: soundEnabled, ready: audioReady, toggle: toggleSound } : null}>
      {children}
      {notice.length > 0 && <aside role="status"
        className="fixed inset-x-4 top-4 z-[70] rounded-2xl border border-border bg-surface p-4 shadow-xl sm:inset-x-auto sm:right-4 sm:w-80">
        <div className="flex items-start gap-3">
          <Bell size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{notice.length === 1 ? 'Новая заявка с сайта' : 'Новые заявки с сайта · ' + notice.length}</p>
            <Link className="mt-2 inline-block text-sm font-medium text-brand hover:underline"
              onClick={() => setNotice([])}
              to={notice.length === 1 ? '/crm?tab=inquiry&entry=' + notice[0] : '/crm?tab=inquiry'}>
              {notice.length === 1 ? 'Открыть заявку' : 'Открыть входящие'}
            </Link>
          </div>
          <button type="button" onClick={() => setNotice([])} aria-label="Закрыть оповещение о заявке"
            className="rounded-md p-1 text-muted hover:bg-surface-muted">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </aside>}
    </Sound.Provider>
  </InboxRevision.Provider>
}
