import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react'
import { API_BASE, ApiError, apiRequest, getToken } from '@/shared/lib/httpClient'
import { Button } from '@/shared/ui/Button'
import { Select } from '@/shared/ui/Field'
import { useAuthStore } from '@/auth/store'

type Status = { can_call: boolean; gateway_configured: boolean; account_configured: boolean; login: string | null; ice_servers?: RTCIceServer[] }
type Phase = 'idle' | 'preparing' | 'connecting' | 'calling' | 'ringing' | 'active' | 'ended' | 'error'
type PhoneState = { phase: Phase; phone: string; name: string; entityId: number; message: string; muted: boolean }
type PhoneContext = { state: PhoneState; start: (entityId: number, phone: string, name: string) => Promise<void>; hangup: () => void }
const initial: PhoneState = { phase: 'idle', phone: '', name: '', entityId: 0, message: '', muted: false }
const Context = createContext<PhoneContext | null>(null)
const ongoing = (phase: Phase) => !['idle', 'ended', 'error'].includes(phase)
const labels: Record<Phase, string> = { idle: '', preparing: 'Подключаем микрофон…', connecting: 'Подключаемся к ВАТС…', calling: 'Набираем номер…', ringing: 'Ожидаем ответа…', active: 'Разговор', ended: 'Звонок завершён', error: 'Звонок не подтверждён' }
export const useBrowserPhone = () => useContext(Context)

export function BrowserPhoneProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initial)
  const resources = useRef<{ socket?: WebSocket; pc?: RTCPeerConnection; stream?: MediaStream; id?: string; ping?: number }>({})
  const speaker = useRef<HTMLAudioElement>(null)
  const locked = useRef(false)
  const generation = useRef(0)
  const userId = useAuthStore(s => s.current?.id)
  const pending = useRef<{ id: string; target: string } | null>(null)
  function release() {
    const current = resources.current
    resources.current = {}
    if (current.id) void apiRequest({ section: 'crm', path: `/browser-phone/calls/${current.id}/cancel`, method: 'POST' }).catch(() => {})
    if (current.ping) window.clearInterval(current.ping)
    current.socket?.close()
    current.pc?.close()
    current.stream?.getTracks().forEach(track => track.stop())
    if (speaker.current) speaker.current.srcObject = null
    locked.current = false
  }
  function hangup() {
    if (!ongoing(state.phase)) { generation.current++; release(); pending.current = null; setState(initial); return }
    const current = resources.current
    generation.current++
    if (current.socket?.readyState === WebSocket.OPEN) current.socket.send(JSON.stringify({ type: 'hangup' }))
    release(); pending.current = null
    setState(value => ({ ...value, phase: 'ended', muted: false, message: value.phase === 'active' ? 'Запись и текстовый разбор появятся в истории карточки после обработки.' : 'Вызов завершён. Если разговор не состоялся, записи не будет.' }))
  }
  useEffect(() => { setState(initial); pending.current = null; return () => { generation.current++; release() } }, [userId])
  useEffect(() => {
    if (!ongoing(state.phase)) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [state.phase])
  async function start(entityId: number, phone: string, name: string) {
    if (locked.current) return
    locked.current = true
    const ticket = ++generation.current
    release(); locked.current = true
    const alive = () => ticket === generation.current
    setState({ phase: 'preparing', phone, name, entityId, message: '', muted: false })
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) throw new Error('Для звонков откройте CRM по HTTPS в Chrome, Edge, Яндекс Браузере или Firefox.')
      const status = await apiRequest<Status>({ section: 'crm', path: '/browser-phone/status' })
      if (!alive()) return
      if (!status.can_call) throw new Error('Браузерный телефон ещё не подключён. Руководителю нужно сохранить действующий SIP-логин и пароль в разделе «Доступ».')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false })
      if (!alive()) { stream.getTracks().forEach(track => track.stop()); return }
      resources.current.stream = stream
      const target = `${entityId}:${phone}`
      if (pending.current?.target !== target) pending.current = { id: crypto.randomUUID(), target }
      const result = await apiRequest<{ id: string; state: string }>({ section: 'crm', path: `/entries/${entityId}/browser-calls`, method: 'POST', body: { phone, request_id: pending.current.id } })
      if (!alive()) {
        void apiRequest({ section: 'crm', path: `/browser-phone/calls/${result.id}/cancel`, method: 'POST' }).catch(() => {})
        return
      }
      resources.current.id = result.id
      if (result.state !== 'prepared') throw new Error('Этот запрос на звонок уже использован. Проверьте историю и нажмите «Завершить», прежде чем звонить ещё раз.')
      const pc = new RTCPeerConnection({ iceServers: status.ice_servers ?? [] })
      resources.current.pc = pc
      stream.getTracks().forEach(track => pc.addTrack(track, stream))
      pc.ontrack = event => {
        if (speaker.current) {
          speaker.current.srcObject = event.streams[0] ?? new MediaStream([event.track])
          void speaker.current.play().catch(() => { if (alive()) setState(value => ({ ...value, message: 'Нажмите «Включить звук разговора», если браузер заблокировал воспроизведение.' })) })
        }
      }
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' && alive()) {
          setState(value => ({ ...value, phase: 'error', message: 'Не удалось передать звук. Проверьте интернет и разрешение микрофона перед новым звонком.' }))
          release()
        }
      }
      const url = new URL(`${API_BASE}/crm/browser-phone/ws/${result.id}`, window.location.origin)
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
      const socket = new WebSocket(url)
      resources.current.socket = socket
      setState(value => ({ ...value, phase: 'connecting' }))
      let terminal = false
      let answered = false
      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'auth', token: getToken() }))
        resources.current.ping = window.setInterval(() => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'ping' })) }, 20000)
      }
      socket.onmessage = event => {
        void (async () => {
          if (!alive()) return
          const signal = JSON.parse(String(event.data))
          if (signal.type === 'registered') {
            await pc.setLocalDescription(await pc.createOffer())
            if (pc.iceGatheringState !== 'complete') await new Promise<void>((resolve, reject) => {
              const timer = window.setTimeout(() => { pc.removeEventListener('icegatheringstatechange', change); reject(new Error('Не удалось подготовить аудиосоединение. Проверьте сеть.')) }, 15000)
              const change = () => { if (pc.iceGatheringState === 'complete') { window.clearTimeout(timer); pc.removeEventListener('icegatheringstatechange', change); resolve() } }
              pc.addEventListener('icegatheringstatechange', change)
              change()
            })
            if (alive() && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'offer', sdp: pc.localDescription?.sdp }))
          } else if (signal.type === 'candidate' && signal.candidate && !signal.candidate.completed) await pc.addIceCandidate(signal.candidate)
          else if (['calling', 'ringing', 'progress', 'accepted'].includes(signal.type)) {
            if (signal.type === 'accepted') answered = true
            if (signal.jsep && !pc.remoteDescription) await pc.setRemoteDescription(signal.jsep)
            setState(value => ({ ...value, phase: signal.type === 'accepted' ? 'active' : signal.type === 'calling' ? 'calling' : 'ringing' }))
          } else if (signal.type === 'ended' || signal.type === 'error') {
            terminal = true; pending.current = null; generation.current++
            setState(value => ({ ...value, phase: signal.type === 'error' ? 'error' : 'ended', muted: false,
              message: signal.message || (signal.code && signal.code !== 200 ? `Вызов завершён оператором (${signal.code}).` : answered ? 'Запись и разбор появятся в истории карточки после обработки.' : 'Вызов завершён без разговора. Запись отсутствует.') }))
            release()
          }
        })().catch(() => {
          if (!alive()) return
          terminal = true
          setState(value => ({ ...value, phase: 'error', message: 'Аудиосоединение прервано. Проверьте историю перед повторным звонком.' }))
          release()
        })
      }
      socket.onclose = () => {
        if (!alive() || terminal) return
        terminal = true
        setState(value => ({ ...value, phase: 'error', message: 'Связь с телефонией прервана. Проверьте историю перед повтором; автоматически звонок не повторяется.' }))
        release()
      }
    } catch (error) {
      if (!alive()) return
      if (error instanceof ApiError && error.status < 500) pending.current = null
      const message = error instanceof DOMException && error.name === 'NotAllowedError' ? 'Разрешите CRM использовать микрофон в настройках браузера и повторите вызов.'
        : error instanceof Error ? error.message : 'Не удалось подключить телефон'
      setState(value => ({ ...value, phase: 'error', message })); release()
    }
  }
  return <Context.Provider value={{ state, start, hangup }}>
    {children}
    <audio ref={speaker} autoPlay aria-label="Звук разговора" />
    {state.phase !== 'idle' && <section aria-label="Телефон CRM" className="fixed bottom-4 right-4 z-[70] w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-border bg-surface p-4 shadow-xl">
      <p className="text-sm font-semibold" role="status">{labels[state.phase]}</p>
      <p className="mt-1 break-words font-medium">{state.name}</p><p className="text-sm text-muted">{state.phone}</p>
      {state.message && <p className="mt-2 text-sm">{state.message}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {ongoing(state.phase) && <Button size="sm" variant="secondary" onClick={() => {
          const muted = !state.muted
          resources.current.stream?.getAudioTracks().forEach(track => { track.enabled = !muted })
          setState(value => ({ ...value, muted }))
        }}>{state.muted ? <MicOff size={16} /> : <Mic size={16} />}{state.muted ? 'Включить микрофон' : 'Выключить микрофон'}</Button>}
        <Button size="sm" variant="secondary" onClick={hangup}><PhoneOff size={16} />{ongoing(state.phase) ? 'Завершить' : 'Закрыть'}</Button>
        {state.message.includes('Включить звук') && <Button size="sm" onClick={() => void speaker.current?.play()}>Включить звук разговора</Button>}
        <Link className="self-center text-sm text-brand underline" to={`/crm?entry=${state.entityId}&channel=calls`}>Карточка и запись</Link>
      </div>
    </section>}
  </Context.Provider>
}

export function BrowserCallPanel({ entityId, canEdit, initialPhone = '' }: { entityId: number; canEdit: boolean; initialPhone?: string }) {
  const phone = useBrowserPhone()
  const [choices, setChoices] = useState<{ phone: string; name: string }[]>([])
  const [selected, select] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    apiRequest<{ items: typeof choices }>({ section: 'crm', path: `/entries/${entityId}/chat-phones` }).then(value => {
      if (!alive) return
      if (!value || !Array.isArray(value.items)) throw new Error('Не удалось загрузить телефоны клиента. Обновите карточку.')
      setChoices(value.items); select(value.items.find(item => item.phone === initialPhone)?.phone || value.items[0]?.phone || '')
    }).catch(error => { if (alive) setError(error.message) })
    return () => { alive = false }
  }, [entityId, initialPhone])
  return <div aria-label="Позвонить из карточки" className="mt-4 space-y-3">
    <p className="text-sm text-muted">Разговор через микрофон и гарнитуру компьютера. Запись и краткий анализ сохраняются в этой карточке.</p>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {choices.length > 0 ? <div className="flex flex-wrap gap-2">
      <Select aria-label="Номер для звонка" value={selected} onChange={event => select(event.target.value)} className="min-w-0 flex-1">{choices.map(item => <option key={item.phone} value={item.phone}>{item.name} · {item.phone}</option>)}</Select>
      <Button disabled={!canEdit || !phone || ongoing(phone.state.phase)} onClick={() => void phone?.start(entityId, selected, choices.find(item => item.phone === selected)?.name || 'Клиент')}><Phone size={16} />Позвонить из CRM</Button>
    </div> : !error && <p className="text-sm text-muted">Для звонка сохраните телефон клиента в карточке.</p>}
  </div>
}
