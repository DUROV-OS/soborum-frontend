import { create } from 'zustand'
import { ApiError } from '@/shared/lib/httpClient'
import { plainErrorText } from '@/shared/lib/humanError'
import { speakPrincess, splitVoiceReply, stopSpeaking } from '@/shared/lib/speechReply'
import { chimeListening, chimeReady, chimeThinking } from './earcon'
import { initVoiceFromStorage } from './voice'
import {
  appendTranscript,
  askMeeting,
  createMeeting,
  finishMeeting,
  refreshNotes,
  updateLineSpeaker,
  uploadMeetingAudio,
} from './api'
import { MeetingNotesOut } from './types'
import {
  ActiveRecording,
  abortRecording,
  extensionForMime,
  isRecordingSupported,
  startRecording,
} from './recorder'
import {
  FinalSegment,
  LiveTranscription,
  speechRecognitionAvailable,
  startTranscription,
} from './transcription'

/**
 * idle      — совещание не идёт
 * starting  — запрашиваем микрофон / создаём сессию
 * recording — идёт запись
 * finishing — останавливаем, грузим аудио, закрываем сессию
 * saved     — сессия сохранена (панель показывает ссылку на список)
 */
export type MeetingPhase = 'idle' | 'starting' | 'recording' | 'finishing' | 'saved'

/** Пауза между финальными фрагментами, после которой считаем, что сменился спикер. */
const SPEAKER_PAUSE_MS = 2500
/** Как часто досылаем накопленные реплики на бэк. */
const FLUSH_INTERVAL_MS = 3000
/** Сколько новых реплик должно накопиться, чтобы авто-пересчитать заметки. */
const NOTES_NEW_LINES_THRESHOLD = 8
/** Тишина после последней речи в вопросе — считаем, что вопрос закончился. */
const QUESTION_SILENCE_MS = 2200
/** Предохранитель: не пишем вопрос дольше этого. */
const QUESTION_MAX_MS = 25000

/**
 * idle      — обычный режим
 * capturing — записываем голосовой вопрос (совещание на паузе)
 * thinking  — Марина думает над вопросом
 * answering — Марина озвучивает ответ
 */
export type AssistantState = 'idle' | 'capturing' | 'thinking' | 'answering'

export interface TranscriptLine {
  localId: string
  /** серверный id — есть, когда строка долетела на бэк */
  lineId: number | null
  speaker: string
  text: string
  atMs: number
  synced: boolean
}

function friendlyError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'Нет доступа к микрофону. Разрешите доступ в браузере и попробуйте снова.'
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'Микрофон не найден. Подключите его и попробуйте снова.'
    }
  }
  return plainErrorText(error, 'Не удалось выполнить действие в режиме «Совещание»')
}

function otherSpeaker(speaker: string): string {
  return speaker === 'Спикер 2' ? 'Спикер 1' : 'Спикер 2'
}

function nextSpeaker(prev: TranscriptLine | undefined, gapMs: number): string {
  if (!prev) return 'Спикер 1'
  return gapMs > SPEAKER_PAUSE_MS ? otherSpeaker(prev.speaker) : prev.speaker
}

interface MeetingState {
  phase: MeetingPhase
  panelOpen: boolean
  meetingId: number | null
  startedAt: number | null
  savedMeetingId: number | null
  error: string | null

  transcript: TranscriptLine[]
  interim: string
  /** Проставлено, если распознавание недоступно/запрещено (запись всё равно идёт). */
  speechNotice: string | null

  notes: MeetingNotesOut | null
  /** false — бэк ответил 409 (нет ключа ИИ): авто-пересчёт и кнопку отключаем. */
  notesAiEnabled: boolean
  notesRefreshing: boolean

  /** Ответ Марины на последний вопрос из панели (markdown). */
  assistantAnswer: string | null
  /** idle → capturing → thinking → answering → idle */
  assistantState: AssistantState
  /** Живой текст записываемого голосового вопроса. */
  questionInterim: string
  /** Разовая пометка, если вопросы Марине недоступны (нет ключа ИИ / браузера). */
  voiceTriggerNotice: string | null

  start: () => Promise<void>
  finish: () => Promise<void>
  setLineSpeaker: (localId: string, speaker: string) => void
  requestNotesRefresh: () => void
  /** Нажали «Спросить Марину»: сигнал, пауза совещания, запись голосового вопроса. */
  startAskingMarina: () => void
  /** Вопрос закончен (кнопка «Готово» или тишина): фраза, сигнал, возобновление, ответ. */
  finishAskingMarina: () => void
  /** Отмена записи вопроса без отправки. */
  cancelAskingMarina: () => void
  dismissAssistantAnswer: () => void
  openPanel: () => void
  closePanel: () => void
  reset: () => void
}

let active: ActiveRecording | null = null
let transcriber: LiveTranscription | null = null
let flushTimer: ReturnType<typeof setInterval> | null = null
let flushing = false
let linesAtLastNotesRefresh = 0
/** Пока true — финальные реплики уходят в вопрос, а не в транскрипт совещания. */
let capturingQuestion = false
let questionBuffer = ''
let qSilenceTimer: ReturnType<typeof setTimeout> | null = null
let qMaxTimer: ReturnType<typeof setTimeout> | null = null

export const useMeetingStore = create<MeetingState>((set, get) => {
  function stopSideEffects() {
    transcriber?.stop()
    transcriber = null
    if (flushTimer !== null) {
      clearInterval(flushTimer)
      flushTimer = null
    }
    capturingQuestion = false
    questionBuffer = ''
    clearQuestionTimers()
    stopSpeaking()
  }

  async function flushTranscript(): Promise<boolean> {
    if (flushing) return false
    const { meetingId, transcript } = get()
    if (meetingId === null) return true
    const pending = transcript.filter((line) => !line.synced)
    if (pending.length === 0) return true

    flushing = true
    try {
      const created = await appendTranscript(
        meetingId,
        pending.map((line) => ({ speaker: line.speaker, text: line.text, at_ms: line.atMs })),
      )
      // бэк возвращает строки в том же порядке — сшиваем по позиции
      set((state) => {
        const byLocalId = new Map(pending.map((line, i) => [line.localId, created[i]]))
        return {
          transcript: state.transcript.map((line) => {
            const match = byLocalId.get(line.localId)
            return match ? { ...line, lineId: match.id, synced: true } : line
          }),
        }
      })
      maybeAutoRefreshNotes()
      return true
    } catch {
      // не страшно — строки остаются несинхронизированными, попробуем ещё раз
      return false
    } finally {
      flushing = false
    }
  }

  /** На finish пытаемся дослать остаток настойчивее — потом сессия закроется. */
  async function drainTranscript(attempts = 3): Promise<void> {
    for (let i = 0; i < attempts; i += 1) {
      if (await flushTranscript()) return
      await new Promise((resolve) => setTimeout(resolve, 600))
    }
  }

  async function refreshNotesNow(): Promise<void> {
    const { meetingId, notesAiEnabled, notesRefreshing, transcript } = get()
    if (meetingId === null || !notesAiEnabled || notesRefreshing) return
    set({ notesRefreshing: true })
    const linesNow = transcript.length
    try {
      const notes = await refreshNotes(meetingId)
      set({ notes })
      linesAtLastNotesRefresh = linesNow
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        set({ notesAiEnabled: false }) // нет ключа ИИ — больше не дёргаем
      }
      // прочее — молча, попробуем в следующий раз
    } finally {
      set({ notesRefreshing: false })
    }
  }

  function maybeAutoRefreshNotes() {
    const { notesAiEnabled, transcript } = get()
    if (!notesAiEnabled) return
    if (transcript.length - linesAtLastNotesRefresh >= NOTES_NEW_LINES_THRESHOLD) {
      void refreshNotesNow()
    }
  }

  function clearQuestionTimers() {
    if (qSilenceTimer !== null) {
      clearTimeout(qSilenceTimer)
      qSilenceTimer = null
    }
    if (qMaxTimer !== null) {
      clearTimeout(qMaxTimer)
      qMaxTimer = null
    }
  }

  /** Любая речь в режиме записи вопроса — сдвигаем таймер «тишины». */
  function bumpQuestionSilence() {
    if (!capturingQuestion) return
    if (qSilenceTimer !== null) clearTimeout(qSilenceTimer)
    qSilenceTimer = setTimeout(() => {
      finishAskingMarina()
    }, QUESTION_SILENCE_MS)
  }

  function startAskingMarina() {
    const { phase, assistantState, speechNotice } = get()
    if (phase !== 'recording' || assistantState !== 'idle') return
    if (speechNotice) {
      set({ voiceTriggerNotice: 'Голосовой вопрос недоступен в этом браузере.' })
      return
    }
    chimeListening() // сигнал: начали задавать вопрос

    // Не потерять то, что говорилось до нажатия: недоговорённый interim
    // фиксируем как строку транскрипта — иначе следующий финал уедет в вопрос.
    set((s) => {
      const pending = s.interim.trim()
      if (!pending) return { interim: '' }
      const prev = s.transcript[s.transcript.length - 1]
      const line: TranscriptLine = {
        localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        lineId: null,
        speaker: nextSpeaker(prev, 0),
        text: pending,
        atMs: Math.max(0, Date.now() - (s.startedAt ?? Date.now())),
        synced: false,
      }
      return { transcript: [...s.transcript, line], interim: '' }
    })

    questionBuffer = ''
    capturingQuestion = true // финальные реплики теперь идут в вопрос, не в транскрипт
    transcriber?.restart() // чистая граница между речью совещания и вопросом
    void flushTranscript() // и сразу сохранить всё сказанное до вопроса
    set({ assistantState: 'capturing', questionInterim: '', assistantAnswer: null, error: null })
    qMaxTimer = setTimeout(() => finishAskingMarina(), QUESTION_MAX_MS)
    bumpQuestionSilence()
  }

  function cancelAskingMarina() {
    if (get().assistantState !== 'capturing') return
    capturingQuestion = false
    clearQuestionTimers()
    questionBuffer = ''
    transcriber?.restart()
    set({ assistantState: 'idle', questionInterim: '' })
  }

  /** Проговорить фразу, приглушив микрофон на это время (иначе TTS попадёт в транскрипт). */
  async function speakWithMicPause(text: string): Promise<void> {
    transcriber?.setPaused(true)
    try {
      await new Promise<void>((resolve) => {
        void speakPrincess(text, { onEnd: resolve, onError: resolve })
      })
    } finally {
      transcriber?.setPaused(false)
    }
  }

  async function finishAskingMarina(): Promise<void> {
    if (get().assistantState !== 'capturing') return
    capturingQuestion = false // совещание снова пишется
    clearQuestionTimers()
    transcriber?.restart() // чистая граница: дальше речь снова идёт в транскрипт
    const question = questionBuffer.trim()
    questionBuffer = ''
    set({ questionInterim: '' })

    const { meetingId } = get()
    if (meetingId === null) {
      set({ assistantState: 'idle' })
      return
    }
    if (!question) {
      set({ assistantState: 'idle' })
      void speakWithMicPause('Не расслышала вопрос, попробуйте ещё раз')
      return
    }

    // Вопрос закончился — фраза (микрофон на паузе на время фразы), сигнал,
    // дальше думаем: запись совещания уже идёт, микрофон снова активен.
    set({ assistantState: 'thinking' })
    await speakWithMicPause('Продолжайте диалог, я уже думаю над вашим вопросом')
    chimeThinking()

    let written: string
    let spoken: string
    try {
      const res = await askMeeting(meetingId, question)
      const parts = splitVoiceReply(res.answer_markdown)
      written = parts.written
      spoken = parts.spoken
    } catch (error) {
      set({ assistantState: 'idle' })
      if (error instanceof ApiError && error.status === 503) {
        set({ voiceTriggerNotice: 'Вопросы Марине недоступны: не задан ключ ИИ.' })
      } else {
        set({ assistantAnswer: '_Не удалось получить ответ. Попробуйте ещё раз._' })
      }
      return
    }

    // Закончила думать — сигнал, короткий ответ голосом, развёрнутый — текстом.
    chimeReady()
    set({ assistantState: 'answering', assistantAnswer: written })
    await speakWithMicPause(spoken)
    set({ assistantState: 'idle' })
  }

  function handleInterim(text: string) {
    if (capturingQuestion) {
      set({ questionInterim: text })
      bumpQuestionSilence()
    } else {
      set({ interim: text })
    }
  }

  function handleFinalSegment(segment: FinalSegment) {
    if (capturingQuestion) {
      // Реплика — часть голосового вопроса, в транскрипт совещания не попадает.
      questionBuffer = `${questionBuffer} ${segment.text}`.trim()
      set({ questionInterim: '' })
      bumpQuestionSilence()
      return
    }
    set((s) => {
      const prev = s.transcript[s.transcript.length - 1]
      const line: TranscriptLine = {
        localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        lineId: null,
        speaker: nextSpeaker(prev, segment.gapMs),
        text: segment.text,
        atMs: segment.atMs,
        synced: false,
      }
      return { transcript: [...s.transcript, line] }
    })
  }

  return {
    phase: 'idle',
    panelOpen: false,
    meetingId: null,
    startedAt: null,
    savedMeetingId: null,
    error: null,
    transcript: [],
    interim: '',
    speechNotice: null,
    notes: null,
    notesAiEnabled: true,
    notesRefreshing: false,
    assistantAnswer: null,
    assistantState: 'idle' as const,
    questionInterim: '',
    voiceTriggerNotice: null,

    start: async () => {
      const { phase } = get()
      if (phase === 'starting' || phase === 'recording' || phase === 'finishing') {
        set({ panelOpen: true })
        return
      }
      linesAtLastNotesRefresh = 0
      capturingQuestion = false
      questionBuffer = ''
      clearQuestionTimers()
      initVoiceFromStorage()
      set({
        phase: 'starting',
        panelOpen: true,
        error: null,
        savedMeetingId: null,
        transcript: [],
        interim: '',
        speechNotice: null,
        notes: null,
        notesAiEnabled: true,
        notesRefreshing: false,
        assistantAnswer: null,
        assistantState: 'idle',
        questionInterim: '',
        voiceTriggerNotice: null,
      })

      if (!isRecordingSupported()) {
        set({ phase: 'idle', error: 'Этот браузер не поддерживает запись с микрофона.' })
        return
      }

      // Сначала микрофон (это и есть запрос доступа), только потом создаём сессию —
      // при отказе на бэке не остаётся пустого совещания.
      try {
        active = await startRecording()
      } catch (error) {
        abortRecording()
        active = null
        set({ phase: 'idle', error: friendlyError(error) })
        return
      }

      let meetingId: number
      try {
        const meeting = await createMeeting(null)
        meetingId = meeting.id
      } catch (error) {
        abortRecording()
        active = null
        set({ phase: 'idle', meetingId: null, startedAt: null, error: friendlyError(error) })
        return
      }

      const startedAt = Date.now()
      set({ phase: 'recording', meetingId, startedAt })

      transcriber = startTranscription({
        startedAt,
        onFinal: handleFinalSegment,
        onInterim: handleInterim,
        onUnavailable: (reason) => set({ speechNotice: reason, interim: '' }),
      })
      flushTimer = setInterval(() => {
        void flushTranscript()
      }, FLUSH_INTERVAL_MS)
    },

    finish: async () => {
      const { phase, meetingId } = get()
      if (phase !== 'recording' || meetingId === null) return
      set({ phase: 'finishing', error: null, interim: '' })

      stopSideEffects()
      await drainTranscript().catch(() => {})

      try {
        const recording = active
        const blob = recording ? await recording.stop() : null
        active = null
        if (blob && blob.size > 0) {
          const ext = extensionForMime(recording?.mimeType ?? 'audio/webm')
          await uploadMeetingAudio(meetingId, blob, `meeting-${meetingId}.${ext}`)
        }
        await finishMeeting(meetingId)
        // Бэк на finish уже пересчитал заметки по всему транскрипту — подтянем их.
        await refreshNotesNow().catch(() => {})
        set({ phase: 'saved', savedMeetingId: meetingId, meetingId: null, startedAt: null })
      } catch (error) {
        // Сессия могла не закрыться — возвращаем в recording, чтобы можно было
        // повторить «Завершить» (аудио уже остановлено, дойдёт без него).
        set({ phase: 'recording', error: friendlyError(error) })
      }
    },

    setLineSpeaker: (localId, speaker) => {
      const line = get().transcript.find((l) => l.localId === localId)
      if (!line || line.speaker === speaker) return
      set((state) => ({
        transcript: state.transcript.map((l) => (l.localId === localId ? { ...l, speaker } : l)),
      }))
      const { meetingId } = get()
      if (meetingId !== null && line.lineId !== null) {
        void updateLineSpeaker(meetingId, line.lineId, speaker).catch((error) =>
          set({ error: friendlyError(error) }),
        )
      }
    },

    requestNotesRefresh: () => {
      void refreshNotesNow()
    },

    startAskingMarina,
    finishAskingMarina: () => {
      void finishAskingMarina()
    },
    cancelAskingMarina,

    dismissAssistantAnswer: () => set({ assistantAnswer: null }),

    openPanel: () => set({ panelOpen: true }),
    closePanel: () => set({ panelOpen: false }),

    reset: () => {
      stopSideEffects()
      stopSpeaking()
      abortRecording()
      active = null
      linesAtLastNotesRefresh = 0
      set({
        phase: 'idle',
        panelOpen: false,
        meetingId: null,
        startedAt: null,
        savedMeetingId: null,
        error: null,
        transcript: [],
        interim: '',
        speechNotice: null,
        notes: null,
        notesAiEnabled: true,
        notesRefreshing: false,
        assistantAnswer: null,
        assistantState: 'idle',
        questionInterim: '',
        voiceTriggerNotice: null,
      })
    },
  }
})

export { speechRecognitionAvailable }
