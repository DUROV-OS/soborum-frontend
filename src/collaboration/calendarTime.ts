/** Wall-clock strings in the selected IANA zone; independent of browser zone. */
export function wallTime(value: Date | string, zone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function wallDate(value: Date | string, zone: string) {
  return new Date(wallTime(value, zone));
}
export function instant(value: string, zone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Укажите дату и время");
  const naive = Date.parse(value + "Z");
  if (!Number.isFinite(naive)) throw new Error("Некорректная дата");
  const offsets = new Set<number>();
  for (const delta of [-36, -12, 0, 12, 36]) {
    const at = naive + delta * 3600000;
    offsets.add(Date.parse(wallTime(new Date(at), zone) + "Z") - at);
  }
  const candidates = [...offsets]
    .map((offset) => naive - offset)
    .filter((at) => wallTime(new Date(at), zone) === value)
    .sort((a, b) => a - b);
  if (!candidates.length)
    throw new Error(
      "Такого местного времени нет из-за перевода часов. Выберите другое время.",
    );
  if (candidates.length > 1)
    throw new Error(
      "Это время повторяется при переводе часов. Выберите время вне перехода.",
    );
  return new Date(candidates[0]).toISOString();
}
export const localInput = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
