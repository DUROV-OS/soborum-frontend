import { useEffect, useState } from "react";
import { apiRequest } from "@/shared/lib/httpClient";
import { Button } from "@/shared/ui/Button";
import { Field, Input, Select } from "@/shared/ui/Field";
export type CalendarPreferences = {
  templates?: {
    id: string;
    title: string;
    description: string;
    location: string;
    category: string;
    duration_minutes: number;
    reminder_minutes: number | null;
    recurrence: string;
    count: number;
  }[];
  version: number;
  timezone: string;
  work_start: number;
  work_end: number;
  weekdays: number[];
  categories: Record<string, { label: string; color: string }>;
};
export const defaultPreferences: CalendarPreferences = {
  version: 0,
  timezone: "Europe/Moscow",
  work_start: 480,
  work_end: 1140,
  weekdays: [0, 1, 2, 3, 4],
  categories: {
    meeting: { label: "Встречи", color: "#4776d0" },
    work: { label: "Задачи", color: "#138b78" },
    personal: { label: "Личное", color: "#8854bf" },
    anniversary: { label: "Юбилеи", color: "#b06b0d" },
  },
};
export const minutesText = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
export const timeMinutes = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};
export function CalendarSettings({
  preferences,
  saved,
}: {
  preferences: CalendarPreferences;
  saved: (value: CalendarPreferences) => void;
}) {
  const [draft, setDraft] = useState(preferences),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  useEffect(() => { setDraft(preferences); }, [preferences]);
  const change = (patch: Partial<CalendarPreferences>) => {
    setDraft((old) => ({ ...old, ...patch }));
    setDone(false);
  };
  const valid =
    Number.isFinite(draft.work_start) &&
    Number.isFinite(draft.work_end) &&
    draft.work_end > draft.work_start &&
    draft.weekdays.length > 0 &&
    Object.values(draft.categories).every((x) => x.label.trim());
  return (
    <section className="max-w-3xl space-y-5 rounded-xl border border-border bg-surface p-5">
      <p className="text-sm text-muted">
        Личные настройки сохраняются в вашей учётной записи и доступны на других
        устройствах. Рабочие часы используются для подбора встреч; цвета и
        названия категорий видны только вам.
      </p>
      <fieldset disabled={busy} className="space-y-5">
        <Field label="Часовой пояс календаря">
          <Select
            aria-label="Часовой пояс календаря"
            value={draft.timezone}
            onChange={(e) => change({ timezone: e.target.value })}
          >
            {[
              ...new Set([
                draft.timezone,
                Intl.DateTimeFormat().resolvedOptions().timeZone,
                "Europe/Kaliningrad",
                "Europe/Moscow",
                "Asia/Yekaterinburg",
                "Asia/Novosibirsk",
                "Asia/Vladivostok",
                "UTC",
              ]),
            ].map((z) => (
              <option key={z}>{z}</option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Начало рабочего дня">
            <Input
              aria-label="Начало рабочего дня"
              type="time"
              value={minutesText(draft.work_start)}
              onChange={(e) =>
                change({ work_start: timeMinutes(e.target.value) })
              }
            />
          </Field>
          <Field label="Конец рабочего дня">
            <Input
              aria-label="Конец рабочего дня"
              type="time"
              value={minutesText(draft.work_end)}
              onChange={(e) =>
                change({ work_end: timeMinutes(e.target.value) })
              }
            />
          </Field>
        </div>
        <div>
          <p className="mb-2 font-medium">Рабочие дни</p>
          <div className="flex flex-wrap gap-4">
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d, i) => (
              <label key={d} className="flex gap-2">
                <input
                  type="checkbox"
                  checked={draft.weekdays.includes(i)}
                  onChange={(e) =>
                    change({
                      weekdays: e.target.checked
                        ? [...draft.weekdays, i]
                        : draft.weekdays.filter((x) => x !== i),
                    })
                  }
                />
                {d}
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="font-semibold">Категории и цвета</h2>
          {Object.entries(draft.categories).map(([key, value]) => (
            <div key={key} className="flex items-center gap-3">
              <input
                aria-label={`Цвет: ${value.label}`}
                type="color"
                value={value.color}
                className="h-10 w-12 rounded border border-border"
                onChange={(e) =>
                  change({
                    categories: {
                      ...draft.categories,
                      [key]: { ...value, color: e.target.value },
                    },
                  })
                }
              />
              <Input
                aria-label={`Название категории ${key}`}
                maxLength={40}
                value={value.label}
                onChange={(e) =>
                  change({
                    categories: {
                      ...draft.categories,
                      [key]: { ...value, label: e.target.value },
                    },
                  })
                }
              />
            </div>
          ))}
        </div>
        {!!draft.templates?.length && (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Ваши шаблоны</h3>
            {draft.templates.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <span className="text-sm">{t.title}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    change({
                      templates: draft.templates?.filter((x) => x.id !== t.id),
                    })
                  }
                >
                  Убрать шаблон
                </Button>
              </div>
            ))}
          </section>
        )}
        <Button
          disabled={!valid || busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            setDone(false);
            try {
              const value = await apiRequest<CalendarPreferences>({
                section: "projects",
                path: "/calendar/preferences",
                method: "PUT",
                body: draft,
              });
              setDraft(value);
              saved(value);
              setDone(true);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Сохраняем…" : "Сохранить настройки"}
        </Button>
      </fieldset>
      {!valid && (
        <p className="text-sm text-danger">
          Проверьте рабочие часы, дни и названия категорий.
        </p>
      )}
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="text-success">
          Настройки сохранены.
        </p>
      )}
    </section>
  );
}
