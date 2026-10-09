/** Вложение сообщения MAX. Поля приходят выборочно — бэк отдаёт только
 * непустые (см. app/max/service.py `_fmt_attach`). Все id — строки:
 * снежинки MAX больше 2^53 и числом ломаются. */
export interface MaxAttach {
  type?: 'FILE' | 'PHOTO' | 'VIDEO' | 'AUDIO' | 'UNSUPPORTED' | 'SHARE' | 'CONTROL' | string
  name?: string
  fileId?: string
  photoId?: string
  videoId?: string
  audioId?: string
  size?: number
  /** PHOTO: готовый URL картинки (i.oneme.ru), грузится прямо в <img>. */
  baseUrl?: string
  /** SHARE: внешняя ссылка. */
  url?: string
  /** SHARE: заголовок ссылки. */
  title?: string
  /** VIDEO/AUDIO: длительность в миллисекундах. */
  duration?: number
  /** VIDEO: кадр-постер, data:image/webp;base64. */
  previewData?: string
  /** VIDEO: URL превью-кадра (iv.okcdn.ru). */
  thumbnail?: string
  /** AUDIO (голосовое): картинка-волна, data:image/webp;base64. */
  wave?: string
}

/** Одно сообщение чата MAX (см. `_fmt_msg`). `time` — Unix-время в
 * миллисекундах. `isOutgoing` бэк считает по совпадению `senderId` с
 * текущим пользователем (не по типу чата). Служебные события чата
 * (кто-то вступил / вышел / переименовал) приходят с `isSystem: true`
 * и текстом в `systemText`. */
export interface MaxMessage {
  id: string
  time: number
  /** Стабильный id участника MAX (строка). null у служебных без автора. */
  senderId: string | null
  /** Имя автора из справочника контактов. null, если контакт неизвестен. */
  senderName: string | null
  isOutgoing: boolean
  isSystem: boolean
  systemText: string | null
  type?: string
  status?: string
  text: string
  elements: unknown[]
  attaches: MaxAttach[]
  /** Пересланное сообщение (0098): свои text/attaches пустые, оригинал здесь.
   * Вложения оригинала скачиваются по id самого пересланного сообщения. */
  forwarded?: MaxForwarded | null
  /** Исходящее (0101): `read` — собеседник (в группе — хоть кто-то) прочитал,
   * `sent` — ещё нет. У входящих, служебных и «Избранного» — null. */
  readStatus?: MaxReadStatus | null
}

export type MaxReadStatus = 'read' | 'sent'

/** Оригинал пересланного сообщения (см. `_fmt_forwarded`). */
export interface MaxForwarded {
  senderId: string | null
  /** Имя автора оригинала из контактов. null — автор не в контактах. */
  senderName: string | null
  /** Чат, откуда переслано. */
  chatId: number | null
  text: string
  attaches: MaxAttach[]
}

/** Одна строка списка чатов — GET /api/max/chats (см. `_fmt_chat`). */
export interface MaxChatSummary {
  id: number
  type?: string
  title: string | null
  /** Непрочитанных сообщений в чате. */
  unread: number
  /** Unix-время последнего события в чате (мс) — по нему список отсортирован. */
  lastEventTime: number | null
  lastMessage: MaxMessage | null
  /** Клиент (app.clients), к которому привязан чат — null, если не привязан. */
  linkedClientId: number | null
  linkedClientName: string | null
  /** Партнёр (app.partners), к которому привязан чат — null, если не привязан
   * (0105). Чат не может быть привязан и к клиенту, и к партнёру одновременно. */
  linkedPartnerId: number | null
  linkedPartnerName: string | null
  /** Номер собеседника личного диалога (`+79001234567`) — только если он есть
   * в контактах аккаунта MAX; у групп и остальных диалогов null (0099). */
  phone: string | null
}

/** Ответ GET /api/max/chats — все чаты, самые свежие сверху. */
export interface MaxChatList {
  count: number
  chats: MaxChatSummary[]
}

/** Ответ GET /api/max/chats/:id — история одного чата. */
export interface MaxChatHistory {
  chatId: number
  title: string | null
  viewerId: string
  /** true — беседа на несколько человек (не диалог 1:1). У входящих
   * сообщений в таком чате фронт подписывает автора. */
  isGroup: boolean
  /** Собеседник личного диалога (0099); null у группы и «Избранного». */
  peer: MaxDialogPeer | null
  count: number
  messages: MaxMessage[]
}

/** Собеседник личного диалога. `phone` null — человека нет в контактах
 * аккаунта, MAX его номер не раскрывает. */
export interface MaxDialogPeer {
  contactId: string
  name: string | null
  phone: string | null
}

/** Ответ POST /api/max/messages — отправленное сообщение. */
export interface MaxSendResult {
  chatId: number
  message: MaxMessage | null
}

/** Ответ POST /api/max/contacts (0093) — личный диалог с человеком,
 * найденным в MAX по номеру. */
export interface MaxStartDialogResult {
  /** id диалога — открывается как обычный чат `/chats/:chatId`, даже если в
   * нём ещё нет сообщений и его нет в списке чатов. */
  chatId: number
  contactId: string
  name: string | null
  /** Человек уже был в контактах аккаунта — имя в MAX не меняли. */
  alreadyContact: boolean
}

/** Ответ GET /api/max/media — воспроизводимая ссылка на видео/аудио. */
export interface MaxMediaUrl {
  /** Прямой MP4 (okcdn для видео, v.oneme.ru для голосовых). */
  url: string | null
  /** Запасной веб-плеер (m.ok.ru) — если прямой ссылки нет. */
  external: string | null
}
