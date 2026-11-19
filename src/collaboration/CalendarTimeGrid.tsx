import { useEffect, useRef, useState } from "react";
import { layoutDay, type Occurrence } from "./calendarLayout";
import { CALENDAR_START, CALENDAR_END, CalendarCategoryIcon } from './CalendarCategory';
import { calendarDragType, readCalendarDrag } from './calendarDrag';

type Item = Occurrence & {
  title: string;
  category: string;
  can_edit: boolean;
  recurrence: string;
  location: string;
  all_day?: boolean;
  occurrence_id?: string;
};
const defaultColors: Record<string, string> = {
  meeting: "#4776d0",
  work: "#138b78",
  personal: "#8854bf",
  anniversary: "#b06b0d",
  briefing: "#8b5a16",
};
const clock = (d: Date) =>
  d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
const SCALE = 1.2;

export function CalendarTimeGrid<T extends Item>({
  begin,
  days,
  weekdays,
  events,
  open,
  create,
  move,
  colors = defaultColors,
  workStart = 480,
  workEnd = 1140,
  workingDays = [0, 1, 2, 3, 4],
  disabled = false,
}: {
  begin: Date;
  days: number;
  weekdays?: number[];
  events: T[];
  open: (event: T) => void;
  create: (date: Date) => void;
  move: (id: number, date: Date, occurrence?: string) => void;
  colors?: Record<string, string>;
  workStart?: number;
  workEnd?: number;
  workingDays?: number[];
  disabled?: boolean;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [dropHint, setDropHint] = useState<{ date: number; minute: number } | null>(null);
  const dateKey = begin.toISOString();
  useEffect(() => {
    if (viewport.current) viewport.current.scrollTop = 0;
  }, [dateKey, days, workStart]);
  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date(begin);
    d.setDate(d.getDate() + i);
    return d;
  }).filter((d) => !weekdays || weekdays.includes((d.getDay() + 6) % 7));
  const columns = dates.length;
  const timeAt = (d: Date, minute: number) => {
    const value = new Date(d);
    value.setHours(0, Math.min(1439, minute), 0, 0);
    return value;
  };
  return (
    <section className="space-y-2">
    <p className="text-xs text-muted">Сетка 08:00–21:00. События за пределами диапазона доступны в режиме «Расписание».</p>
    <div
      ref={viewport}
      aria-label="Почасовая сетка календаря"
      className="max-h-[70vh] overflow-auto rounded-xl border border-border bg-surface"
    >
      <div style={{ minWidth: columns === 1 ? 300 : columns * 115 + 56 }}>
        <div className="sticky top-0 z-20 bg-surface shadow-sm">
        <div
          className="grid border-b border-border bg-surface"
          style={{
            gridTemplateColumns: `56px repeat(${columns},minmax(0,1fr))`,
          }}
        >
          <div className="p-2 text-xs text-muted">Время</div>
          {dates.map((d) => (
            <div
              key={d.toISOString()}
              className="p-3 text-center text-sm font-semibold"
            >
              {d.toLocaleDateString("ru-RU", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </div>
          ))}
        </div>
        <div
          className="grid border-b border-border bg-surface-muted"
          style={{
            gridTemplateColumns: `56px repeat(${columns},minmax(0,1fr))`,
          }}
        >
          <div className="p-2 text-xs text-muted">Весь день</div>
          {dates.map((d) => (
            <div
              key={d.toISOString()}
              className="space-y-1 border-l border-border p-1"
            >
              {events
                .filter(
                  (e) =>
                    e.all_day &&
                    new Date(e.occurrence_start) < timeAt(d, 1439) &&
                    new Date(e.occurrence_end) > d,
                )
                .map((e) => (
                  <button
                    key={`${e.id}-${e.occurrence_id ?? e.occurrence_start}`}
                    className="block w-full rounded border-l-4 bg-surface p-1 text-left text-xs font-medium"
                    style={{ borderColor: colors[e.category] }}
                    onClick={() => open(e)}
                  >
                    <CalendarCategoryIcon category={e.category} color={colors[e.category]} />{e.title}
                  </button>
                ))}
            </div>
          ))}
        </div>
        </div>
        <div
          className="grid"
          style={{
            gridTemplateColumns: `56px repeat(${columns},minmax(0,1fr))`,
          }}
        >
          <div
            className="relative bg-surface-muted"
            style={{ height: (CALENDAR_END - CALENDAR_START) * SCALE }}
          >
            {Array.from({ length: 14 }, (_, h) => (
              <span
                key={h}
                className="absolute right-2 text-xs text-muted"
                style={{ top: h * 60 * SCALE, transform: h === 13 ? "translateY(-100%)" : undefined }}
              >
                {String(h + 8).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {dates.map((d) => (
            <div
              key={d.toISOString()}
              className="relative border-l border-border bg-surface-muted"
              data-calendar-day={d.toLocaleDateString('en-CA')}
              style={{
                height: (CALENDAR_END - CALENDAR_START) * SCALE,
                backgroundImage:
                  "linear-gradient(to bottom, var(--color-border, #e5e7eb) 1px, transparent 1px)",
                backgroundSize: `100% ${30 * SCALE}px`,
              }}
              onDragOver={(e) => {
                if (disabled || !e.dataTransfer.types.includes(calendarDragType)) return;
                e.preventDefault();
                setDropHint({ date: d.getTime(), minute: Math.max(CALENDAR_START, Math.min(CALENDAR_END - 15, CALENDAR_START + Math.round((e.clientY - e.currentTarget.getBoundingClientRect().top) / SCALE / 15) * 15)) });
              }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropHint(null); }}
              onDragEnd={() => setDropHint(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDropHint(null);
                const item = readCalendarDrag(e.dataTransfer);
                if (!item || disabled) return;
                const minutes =
                  Math.round(
                    (e.clientY - e.currentTarget.getBoundingClientRect().top) /
                      SCALE /
                      15,
                  ) * 15;
                move(item.id, timeAt(d, Math.max(CALENDAR_START, Math.min(CALENDAR_END - 15, CALENDAR_START + minutes))), item.occurrence);
              }}
            >
              {workingDays.includes((d.getDay() + 6) % 7) && <div
                aria-label={`Рабочие часы ${String(Math.floor(workStart / 60)).padStart(2, '0')}:${String(workStart % 60).padStart(2, '0')}–${String(Math.floor(workEnd / 60)).padStart(2, '0')}:${String(workEnd % 60).padStart(2, '0')}`}
                data-work-start={workStart} data-work-end={workEnd}
                className="pointer-events-none absolute left-0 w-full bg-surface"
                style={{ top: (Math.min(CALENDAR_END, Math.max(CALENDAR_START, workStart)) - CALENDAR_START) * SCALE, height: Math.max(0, Math.min(workEnd, CALENDAR_END) - Math.max(workStart, CALENDAR_START)) * SCALE,
                  backgroundImage: 'linear-gradient(to bottom, var(--color-border, #e5e7eb) 1px, transparent 1px)', backgroundSize: `100% ${30 * SCALE}px` }} />}
              {dropHint?.date === d.getTime() && <div className="pointer-events-none absolute left-0 z-30 w-full border-t-2 border-brand text-xs text-brand-dark" style={{ top: (dropHint.minute - CALENDAR_START) * SCALE }}><span className="rounded bg-surface px-2">{clock(timeAt(d, dropHint.minute))}</span></div>}
              {Array.from({ length: 26 }, (_, i) => (
                <button
                  type="button"
                  key={i}
                  aria-label={`Создать встречу ${d.toLocaleDateString("ru-RU")} ${String(8 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`}
                  className="absolute left-0 w-full text-left text-xs text-transparent hover:bg-brand/5 hover:text-muted focus:bg-brand/10 focus:text-ink"
                  style={{ top: i * 30 * SCALE, height: 30 * SCALE }}
                  onClick={() => create(timeAt(d, CALENDAR_START + i * 30))}
                >
                  ＋ Новая встреча
                </button>
              ))}
              {layoutDay(
                events.filter((e) => !e.all_day),
                d, CALENDAR_START, CALENDAR_END,
              ).map(({ event, start, end, lane, lanes }) => (
                <button
                  type="button"
                  key={`${event.id}-${event.occurrence_id ?? event.occurrence_start}`}
                  title={`${event.title} · ${clock(new Date(event.occurrence_start))}–${clock(new Date(event.occurrence_end))}${event.location ? " · " + event.location : ""}`}
                  aria-label={`${event.title}, ${clock(new Date(event.occurrence_start))}–${clock(new Date(event.occurrence_end))}`}
                  draggable={event.can_edit && !disabled}
                  onDragStart={(e) =>
                    e.dataTransfer.setData(
                      calendarDragType,
                      JSON.stringify({ id: event.id, occurrence: event.occurrence_id || event.occurrence_start }),
                    )
                  }
                  onClick={() => open(event)}
                  className="absolute z-10 flex flex-col items-stretch overflow-hidden rounded-md border-l-4 px-1 py-1 text-left text-xs shadow-sm ring-1 ring-inset ring-white/60 hover:brightness-95 focus:z-20 focus:outline focus:outline-2 focus:outline-brand"
                  style={{
                    top: (start - CALENDAR_START) * SCALE,
                    height: Math.max(3, (end - start) * SCALE - 1),
                    left: `calc(${(lane / lanes) * 100}% + 2px)`,
                    width: `calc(${100 / lanes}% - 4px)`,
                    borderColor: colors[event.category],
                    backgroundColor: `color-mix(in srgb, ${colors[event.category] || "#4776d0"} 16%, white)`,
                  }}
                >
                  <span className="block truncate font-semibold">
                    <CalendarCategoryIcon category={event.category} color={colors[event.category]} />{event.title}
                  </span>
                  {end - start >= 20 && (
                    <span className="block truncate">
                      {clock(new Date(event.occurrence_start))}–
                      {clock(new Date(event.occurrence_end))}
                    </span>
                  )}
                  {end - start >= 45 && (
                    <span className="block truncate text-muted">
                      {event.location}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
    </section>
  );
}
