import { useState } from "react";
import { Field, Input, Select } from "@/shared/ui/Field";
import { MeetingPlanner } from "./MeetingPlanner";
import { localInput, wallTime } from "./calendarTime";
import type { CalendarPreferences } from "./CalendarSettings";

export function CalendarPlannerPage({
  people,
  preferences,
  choose,
}: {
  people: { id: number; name: string }[];
  preferences: CalendarPreferences;
  choose: (
    slot: { start: string; end: string },
    participants: number[],
  ) => void;
}) {
  const [start, setStart] = useState(() =>
      wallTime(new Date(Date.now() + 3600000), preferences.timezone),
    ),
    [duration, setDuration] = useState(60),
    [days, setDays] = useState(7),
    [participants, setParticipants] = useState<number[]>([]);
  const date = new Date(start),
    end = Number.isFinite(date.getTime())
      ? localInput(new Date(date.getTime() + duration * 60000))
      : "";
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(240px,1fr)_2fr]">
      <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Кого и когда пригласить</h2>
        <Field label="Искать начиная с">
          <Input
            aria-label="Начало поиска встречи"
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
        <Field label="Продолжительность, минут">
          <Input
            aria-label="Продолжительность встречи"
            type="number"
            min={5}
            max={480}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </Field>
        <Field label="Диапазон поиска">
          <Select
            aria-label="Диапазон поиска"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {[1, 3, 7, 14].map((n) => (
              <option key={n} value={n}>
                {n} дн.
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-sm text-muted">
          Ваша занятость учитывается автоматически. Выберите коллег:
        </p>
        <div className="max-h-72 space-y-2 overflow-auto">
          {people.map((p) => (
            <label key={p.id} className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={participants.includes(p.id)}
                onChange={(e) =>
                  setParticipants((old) =>
                    e.target.checked
                      ? [...old, p.id]
                      : old.filter((x) => x !== p.id),
                  )
                }
              />
              {p.name}
            </label>
          ))}
        </div>
      </section>
      <MeetingPlanner
        preferences={preferences}
        start={start}
        end={end}
        searchDays={days}
        participants={participants}
        opensEditor
        choose={(slot) => choose(slot, participants)}
      />
    </div>
  );
}
