export type ExportEvent = {
  id: number;
  version: number;
  title: string;
  description: string;
  location: string;
  category: string;
  availability: string;
  timezone: string;
  all_day?: boolean;
  occurrence_start: string;
  occurrence_end: string;
  reminder_minutes?: number | null;
};
const escapeText = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
const utc = (s: string) =>
  new Date(s)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
const dateInZone = (s: string, zone: string) => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(s));
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k)!.value)
    .join("");
};
// RFC 5545 counts UTF-8 octets, not JavaScript characters. Preserve code points.
export function foldLine(line: string) {
  let result = "",
    size = 0;
  for (const char of line) {
    const bytes = new TextEncoder().encode(char).length;
    if (size + bytes > 75) {
      result += "\r\n ";
      size = 1;
    }
    result += char;
    size += bytes;
  }
  return result;
}
export function calendarICS(events: ExportEvent[], now = new Date()) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Durov OS//Calendar//RU",
    "CALSCALE:GREGORIAN",
  ];
  for (const e of events) {
    // Snapshot: each visible occurrence has a stable UID; never exports unseen repetitions.
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}-${utc(e.occurrence_start)}@calendar.durov.house`,
      `SEQUENCE:${e.version}`,
      `DTSTAMP:${utc(now.toISOString())}`,
    );
    if (e.all_day)
      lines.push(
        `DTSTART;VALUE=DATE:${dateInZone(e.occurrence_start, e.timezone)}`,
        `DTEND;VALUE=DATE:${dateInZone(e.occurrence_end, e.timezone)}`,
      );
    else
      lines.push(
        `DTSTART:${utc(e.occurrence_start)}`,
        `DTEND:${utc(e.occurrence_end)}`,
      );
    lines.push(
      `SUMMARY:${escapeText(e.title)}`,
      `DESCRIPTION:${escapeText(e.description)}`,
      `LOCATION:${escapeText(e.location)}`,
      `CATEGORIES:${escapeText(e.category)}`,
      `TRANSP:${e.availability === "free" ? "TRANSPARENT" : "OPAQUE"}`,
      "CLASS:PRIVATE",
    );
    if (e.reminder_minutes != null)
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeText(e.title)}`,
        `TRIGGER:-PT${e.reminder_minutes}M`,
        "END:VALARM",
      );
    lines.push("END:VEVENT");
  }
  return [...lines, "END:VCALENDAR"].map(foldLine).join("\r\n") + "\r\n";
}
const cell = (value: string) =>
  '"' +
  (/^[\s]*[=+@-]|^[\t\r\n]/.test(value) ? "'" + value : value).replace(
    /"/g,
    '""',
  ) +
  '"';
export function calendarCSV(events: ExportEvent[], zone: string) {
  const time = (s: string) =>
    new Date(s).toLocaleString("ru-RU", { timeZone: zone });
  return (
    "\uFEFF" +
    [
      [
        "Тема",
        "Начало",
        "Окончание (не включая)",
        "Часовой пояс",
        "Весь день",
        "Место",
        "Повестка",
      ],
      ...events.map((e) => [
        e.title,
        time(e.occurrence_start),
        time(e.occurrence_end),
        zone,
        e.all_day ? "Да" : "Нет",
        e.location,
        e.description,
      ]),
    ]
      .map((row) => row.map(cell).join(";"))
      .join("\r\n")
  );
}
export function downloadCalendar(text: string, format: "ics" | "csv") {
  const url = URL.createObjectURL(
    new Blob([text], {
      type:
        format === "ics"
          ? "text/calendar;charset=utf-8"
          : "text/csv;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `durov-calendar.${format}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
