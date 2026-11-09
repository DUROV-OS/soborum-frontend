import { useEffect, useRef } from 'react'

const focusable = 'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
let locks = 0
let previousOverflow = ''
const dialogs: HTMLDivElement[] = []

export function useDialogFocus(open: boolean, onClose: () => void, trapFocus = true) {
  const ref = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    if (!open || !ref.current) return
    const dialog = ref.current
    dialogs.push(dialog)
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (trapFocus && locks++ === 0) { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden' }
    const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusable)).filter(el => el.getClientRects().length > 0 && !el.closest('[hidden],[inert]'))
    const foremost = () => dialogs[dialogs.length - 1] === dialog
    const frame = requestAnimationFrame(() => { if (foremost()) (controls()[0] ?? dialog).focus() })
    function keydown(event: KeyboardEvent) {
      if (!foremost()) return
      if (!trapFocus && !dialog.contains(document.activeElement)) return
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close.current(); return }
      if (event.key !== 'Tab' || !trapFocus) return
      const items = controls(), first = items[0], last = items[items.length - 1]
      if (!first) { event.preventDefault(); dialog.focus(); return }
      if (!dialog.contains(document.activeElement) || (event.shiftKey && (document.activeElement === first || document.activeElement === dialog))) {
        event.preventDefault(); (event.shiftKey ? last : first)?.focus()
      } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    function focusin(event: FocusEvent) {
      if (trapFocus && foremost() && !dialog.contains(event.target as Node)) (controls()[0] ?? dialog).focus()
    }
    document.addEventListener('keydown', keydown, true)
    document.addEventListener('focusin', focusin)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', keydown, true)
      document.removeEventListener('focusin', focusin)
      const wasForemost = foremost()
      dialogs.splice(dialogs.indexOf(dialog), 1)
      if (trapFocus && --locks === 0) document.body.style.overflow = previousOverflow
      if (wasForemost && opener?.isConnected) opener.focus()
    }
  }, [open, trapFocus])
  return ref
}
