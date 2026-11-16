import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/shared/lib/httpClient";
import { Button } from "@/shared/ui/Button";
import { Field, Input } from "@/shared/ui/Field";

import { instant } from "./calendarTime";
import {
  defaultPreferences,
  minutesText,
  type CalendarPreferences,
} from "./CalendarSettings";

type Slot = { start: string; end: string };
const minutes = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
};

export function MeetingPlanner({
  participants,
  start,
  end,
  excludeId,
  choose,
  disabled = false,
  preferences = defaultPreferences,
  searchDays = 7,
  opensEditor = false,
}: {
  participants: number[];
  start: string;
  end: string;
  excludeId?: number;
  choose: (slot: Slot) => void;
  disabled?: boolean;
  preferences?: CalendarPreferences;
  searchDays?: number;
  opensEditor?: boolean;
}) {
  const [workStart, setWorkStart] = useState(
      minutesText(preferences.work_start),
    ),
    [workEnd, setWorkEnd] = useState(minutesText(preferences.work_end));
  const [weekdays, setWeekdays] = useState(preferences.weekdays),
    [slots, setSlots] = useState<Slot[] | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const generation = useRef(0);
  const key = JSON.stringify({
    participants,
    start,
    end,
    excludeId,
    workStart,
    workEnd,
    weekdays,
    timezone: preferences.timezone,
    searchDays,
  });
  useEffect(() => {
    generation.current++;
    setSlots(null);
    setError("");
    setBusy(false);
    return () => {
      generation.current++;
    };
  }, [key]);
  let from = "",
    to = "";
  try {
    from = instant(start, preferences.timezone);
    to = instant(end, preferences.timezone);
  } catch {
    /* Invalid wall time disables search. */
  }
  const duration = Math.round((Date.parse(to) - Date.parse(from)) / 60000);
  const valid =
    Number.isFinite(duration) &&
    duration >= 5 &&
    duration <= 480 &&
    weekdays.length > 0 &&
    minutes(workEnd) - minutes(workStart) >= duration;
  const search = async () => {
    if (!valid || busy) return;
    const request = ++generation.current;
    setBusy(true);
    setSlots(null);
    setError("");
    const until = new Date(Date.parse(from) + searchDays * 86400000);
    try {
      const result = await apiRequest<{ slots: Slot[] }>({
        section: "projects",
        path: "/calendar/suggestions",
        method: "POST",
        body: {
          start: from,
          end: until.toISOString(),
          participants,
          duration_minutes: duration,
          timezone: preferences.timezone,
          work_start: minutes(workStart),
          work_end: minutes(workEnd),
          weekdays,
          exclude_event_id: excludeId || null,
        },
      });
      if (request === generation.current) setSlots(result.slots);
    } catch (e) {
      if (request === generation.current) setError((e as Error).message);
    } finally {
      if (request === generation.current) setBusy(false);
    }
  };
  return (
    <section
      aria-label="Планировщик встречи"
      className="space-y-3 rounded-xl border border-border bg-surface-muted p-4"
    >
      <h3 className="font-semibold">Подобрать свободное время</h3>
      <p className="text-xs text-muted">
        Проверим календарь организатора и выбранных участников на {searchDays}{" "}
        дней вперёд от начала встречи. Подбор относится к одной встрече; будущие
        повторения требуют отдельной проверки.
      </p>
      <fieldset disabled={disabled || busy} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Рабочий день с">
            <Input
              aria-label="Рабочий день с"
              type="time"
              value={workStart}
              onChange={(e) => setWorkStart(e.target.value)}
            />
          </Field>
          <Field label="Рабочий день до">
            <Input
              aria-label="Рабочий день до"
              type="time"
              value={workEnd}
              onChange={(e) => setWorkEnd(e.target.value)}
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-3">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d, i) => (
            <label key={d} className="flex gap-1 text-xs">
              <input
                type="checkbox"
                checked={weekdays.includes(i)}
                onChange={(e) =>
                  setWeekdays((old) =>
                    e.target.checked ? [...old, i] : old.filter((n) => n !== i),
                  )
                }
              />
              {d}
            </label>
          ))}
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={!valid || busy}
          onClick={() => void search()}
        >
          Найти время
          {Number.isFinite(duration) && duration > 0
            ? ` · ${duration} мин`
            : ""}
        </Button>
      </fieldset>
      {!valid && (
        <p className="text-xs text-muted">
          Укажите длительность от 5 минут до 8 часов, которая помещается в
          рабочий день.
        </p>
      )}
      {busy && (
        <p role="status" className="text-sm">
          Сверяем занятость участников…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {slots && (
        <div className="space-y-2">
          {slots.length ? (
            <>
              <p className="text-xs text-muted">
                Свободно по данным календаря на момент проверки.{" "}
                {opensEditor
                  ? "Выбор откроет карточку новой встречи."
                  : "Выбор заполнит время в карточке."}{" "}
                Встреча создаётся кнопкой «Сохранить».
              </p>
              <div className="flex max-h-52 flex-wrap gap-2 overflow-auto">
                {slots.map((slot) => (
                  <button
                    key={slot.start}
                    type="button"
                    disabled={disabled}
                    className="rounded-lg border border-brand/30 bg-surface p-2 text-left text-sm hover:bg-brand/10"
                    onClick={() => choose(slot)}
                  >
                    <span className="block font-medium">
                      {new Date(slot.start).toLocaleDateString("ru-RU", {
                        timeZone: preferences.timezone,
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    {new Date(slot.start).toLocaleTimeString("ru-RU", {
                      timeZone: preferences.timezone,
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    –
                    {new Date(slot.end).toLocaleTimeString("ru-RU", {
                      timeZone: preferences.timezone,
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm">
              На ближайшие {searchDays} дней общего свободного времени не
              найдено. Измените начало поиска, длительность или рабочие часы.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
