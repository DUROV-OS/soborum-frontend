export const calendarDragType = 'application/x-durov-calendar'
export function readCalendarDrag(transfer: DataTransfer): { id: number; occurrence?: string } | null {
  try {
    const value = JSON.parse(transfer.getData(calendarDragType))
    return Number.isSafeInteger(value.id) && value.id > 0 && typeof value.occurrence === 'string'
      ? value : null
  } catch { return null }
}
