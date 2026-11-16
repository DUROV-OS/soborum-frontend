import { useEffect, useRef } from "react";
import { layoutDay, type Occurrence } from "./calendarLayout";

type Item = Occurrence & {
  title: string;
  category: string;
  can_edit: boolean;
  recurrence: string;
  location: string;
};
const defaultColors: Record<string, string> = {
  meeting: "#4776d0",
  work: "#138b78",
  personal: "#8854bf",
  anniversary: "#b06b0d",
};
const clock = (d: Date) =>
  d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
const SCALE = 1.2;

export function CalendarTimeGrid<T extends Item>({
  begin,
  days,
  events,
  open,
  create,
  move,
  colors = defaultColors,
}: {
  begin: Date;
  days: number;
  events: T[];
  open: (event: T) => void;
  create: (date: Date) => void;
  move: (id: number, date: Date) => void;
  colors?: Record<string, string>;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const dateKey = begin.toISOString();
  useEffect(() => {
    if (viewport.current) viewport.current.scrollTop = 8 * 60 * SCALE;
  }, [dateKey, days]);
  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date(begin);
    d.setDate(d.getDate() + i);
    return d;
  });
  const timeAt = (d: Date, minute: number) => {
    const value = new Date(d);
    value.setHours(0, Math.min(1439, minute), 0, 0);
    return value;
  };
  return (
    <div
      ref={viewport}
      aria-label="Почасовая сетка календаря"
      className="max-h-[70vh] overflow-auto rounded-xl border border-border bg-surface"
    >
      <div style={{ minWidth: days === 1 ? 300 : days * 115 + 56 }}>
        <div
          className="sticky top-0 z-20 grid border-b border-border bg-surface shadow-sm"
          style={{ gridTemplateColumns: `56px repeat(${days},minmax(0,1fr))` }}
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
          className="grid"
          style={{ gridTemplateColumns: `56px repeat(${days},minmax(0,1fr))` }}
        >
          <div
            className="relative bg-surface-muted"
            style={{ height: 1440 * SCALE }}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <span
                key={h}
                className="absolute right-2 text-xs text-muted"
                style={{ top: h * 60 * SCALE + 2 }}
              >
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {dates.map((d) => (
            <div
              key={d.toISOString()}
              className="relative border-l border-border"
              style={{
                height: 1440 * SCALE,
                backgroundImage:
                  "linear-gradient(to bottom, var(--color-border, #e5e7eb) 1px, transparent 1px)",
                backgroundSize: `100% ${30 * SCALE}px`,
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = Number(
                  e.dataTransfer.getData("application/x-durov-calendar"),
                );
                if (!Number.isSafeInteger(id) || id <= 0) return;
                const minutes =
                  Math.round(
                    (e.clientY - e.currentTarget.getBoundingClientRect().top) /
                      SCALE /
                      15,
                  ) * 15;
                move(id, timeAt(d, Math.max(0, Math.min(1425, minutes))));
              }}
            >
              {Array.from({ length: 48 }, (_, i) => (
                <button
                  type="button"
                  key={i}
                  aria-label={`Создать встречу ${d.toLocaleDateString("ru-RU")} ${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`}
                  className="absolute left-0 w-full text-left text-xs text-transparent hover:bg-brand/5 hover:text-muted focus:bg-brand/10 focus:text-ink"
                  style={{ top: i * 30 * SCALE, height: 30 * SCALE }}
                  onClick={() => create(timeAt(d, i * 30))}
                >
                  ＋ Новая встреча
                </button>
              ))}
              {layoutDay(events, d).map(
                ({ event, start, end, lane, lanes }) => (
                  <button
                    type="button"
                    key={`${event.id}-${event.occurrence_start}`}
                    title={`${event.title} · ${clock(new Date(event.occurrence_start))}–${clock(new Date(event.occurrence_end))}${event.location ? " · " + event.location : ""}`}
                    aria-label={`${event.title}, ${clock(new Date(event.occurrence_start))}–${clock(new Date(event.occurrence_end))}`}
                    draggable={event.can_edit && event.recurrence === "none"}
                    onDragStart={(e) =>
                      e.dataTransfer.setData(
                        "application/x-durov-calendar",
                        String(event.id),
                      )
                    }
                    onClick={() => open(event)}
                    className="absolute z-10 flex flex-col items-stretch overflow-hidden rounded-md border-l-4 px-1 py-1 text-left text-xs shadow-sm ring-1 ring-inset ring-white/60 hover:brightness-95 focus:z-20 focus:outline focus:outline-2 focus:outline-brand"
                    style={{
                      top: start * SCALE,
                      height: Math.max(3, (end - start) * SCALE - 1),
                      left: `calc(${(lane / lanes) * 100}% + 2px)`,
                      width: `calc(${100 / lanes}% - 4px)`,
                      borderColor: colors[event.category],
                      backgroundColor: `color-mix(in srgb, ${colors[event.category] || "#4776d0"} 16%, white)`,
                    }}
                  >
                    <span className="block truncate font-semibold">
                      {event.title}
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
                ),
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
