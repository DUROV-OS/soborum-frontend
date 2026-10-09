/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  /** Публичный VAPID-ключ для Web Push (0080-e) — не секрет, та же строка
   * генерируется на backend (VAPID_PUBLIC_KEY) и отдаётся сюда сборкой. */
  readonly VITE_VAPID_PUBLIC_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
