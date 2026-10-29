import { useSearchParams } from 'react-router-dom'

/** Navigation links, reload and browser history share the same selected page. */
export function useQueryChoice<T extends string>(
  key: string,
  choices: readonly T[],
  fallback: T,
  legacy?: (query: URLSearchParams) => string | null,
): [T, (next: T) => void] {
  const [query, setQuery] = useSearchParams()
  const raw = query.get(key) ?? legacy?.(query)
  const selected = choices.includes(raw as T) ? (raw as T) : fallback
  return [
    selected,
    (next: T) =>
      setQuery((previous) => {
        const q = new URLSearchParams(previous)
        q.set(key, next)
        return q
      }),
  ]
}
