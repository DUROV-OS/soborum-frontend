import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/shared/lib/httpClient";
import { Button } from "@/shared/ui/Button";
import { Field, Input, Select, Textarea } from "@/shared/ui/Field";
import { CalendarTimeGrid } from "./CalendarTimeGrid";
import { MeetingPlanner } from "./MeetingPlanner";
import { Modal } from "@/shared/ui/Modal";
type Person = { id: number; name: string };
type Event = {
  id: number;
  version: number;
  owner_id: number;
  can_edit: boolean;
  title: string;
  start: string;
  end: string;
  timezone: string;
  description: string;
  location: string;
  category: string;
  availability: string;
  recurrence: string;
  count: number;
  participants: number[];
  responses: Record<string, string>;
  cancelled: boolean;
  occurrence_start: string;
  occurrence_end: string;
};
const call = <T,>(
  path: string,
  method: "GET" | "POST" | "PATCH" = "GET",
  body?: unknown,
) =>
  apiRequest<T>({
    section: "projects",
    path: "/calendar" + path,
    method,
    body,
  });
const local = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
const day = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};
const add = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};
const colors: Record<string, string> = {
  meeting: "#4776d0",
  work: "#138b78",
  personal: "#8854bf",
  anniversary: "#b06b0d",
};
const modes = [
  ["day", "День"],
  ["week", "Неделя"],
  ["work", "Рабочая неделя"],
  ["month", "Месяц"],
  ["schedule", "Расписание"],
  ["people", "Люди"],
];
export function CalendarPage() {
  const [mode, setMode] = useState("week"),
    [date, setDate] = useState(() => day(new Date())),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("");
  const [events, setEvents] = useState<Event[]>([]),
    [people, setPeople] = useState<Person[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<{ row?: Event; at: Date } | null>(null),
    [selectedPeople, setSelectedPeople] = useState<number[]>([]),
    [busy, setBusy] = useState<
      { person_id: number; start: string; end: string }[]
    >([]);
  const begin = day(date);
  if (["week", "work"].includes(mode))
    begin.setDate(begin.getDate() - ((begin.getDay() + 6) % 7));
  if (mode === "month") {
    begin.setDate(1);
    begin.setDate(begin.getDate() - ((begin.getDay() + 6) % 7));
  }
  const length =
    mode === "month"
      ? 42
      : mode === "day" || mode === "people"
        ? 1
        : mode === "work"
          ? 5
          : mode === "schedule"
            ? 30
            : 7;
  const finish = add(begin, length),
    key = begin.toISOString() + mode;
  useEffect(() => {
    let active = true;
    call<Person[]>("/people")
      .then((r) => {
        if (active) setPeople(r);
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      call<Event[]>(
        "/events?" +
          new URLSearchParams({
            start: begin.toISOString(),
            end: finish.toISOString(),
            query,
          }),
      )
        .then((r) => {
          if (active) setEvents(r);
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key, query, revision]);
  useEffect(() => {
    let active = true;
    setBusy([]);
    if (mode !== "people" || !selectedPeople.length) return;
    const p = new URLSearchParams({
      start: begin.toISOString(),
      end: finish.toISOString(),
    });
    selectedPeople.forEach((id) => p.append("person_id", String(id)));
    call<typeof busy>("/busy?" + p)
      .then((r) => {
        if (active) setBusy(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [key, selectedPeople, revision]);
  const shown = events.filter((e) => !category || e.category === category);
  const atDay = (d: Date) =>
    shown.filter(
      (e) =>
        new Date(e.occurrence_start) < add(d, 1) &&
        new Date(e.occurrence_end) > d,
    );
  const move = async (id: number, at: Date) => {
    const row = events.find((e) => e.id === id);
    if (!row?.can_edit) return;
    if (row.recurrence !== "none") {
      setError(
        "Повторяющаяся встреча: откройте карточку для изменения всей серии.",
      );
      return;
    }
    try {
      await call(`/events/${id}`, "PATCH", {
        ...payload(row),
        request_id: crypto.randomUUID(),
        start: at.toISOString(),
        end: new Date(
          at.getTime() +
            new Date(row.end).getTime() -
            new Date(row.start).getTime(),
        ).toISOString(),
      });
      setRevision((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const eventButton = (e: Event) => (
    <button
      key={`${e.id}-${e.occurrence_start}`}
      draggable={e.can_edit && e.recurrence === "none"}
      onDragStart={(a) => a.dataTransfer.setData("text/plain", String(e.id))}
      onClick={() => setEditor({ row: e, at: new Date(e.start) })}
      className="my-1 block w-full rounded-md border-l-4 bg-surface-muted px-2 py-1 text-left text-xs hover:brightness-95"
      style={{ borderColor: colors[e.category] }}
    >
      <strong>
        {mode === "schedule" &&
          new Date(e.occurrence_start).toLocaleDateString("ru-RU") + " · "}
        {new Date(e.occurrence_start).toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
        })}{" "}
        · {e.title}
      </strong>
      <span className="block text-muted">{e.location}</span>
    </button>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Календарь</h1>
          <p className="text-sm text-muted">
            Встречи команды · время:{" "}
            {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </p>
        </div>
        <Button
          onClick={() => {
            const at = new Date(date);
            at.setHours(10);
            setEditor({ at });
          }}
        >
          Новая встреча
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3">
        <Button variant="secondary" onClick={() => setDate(day(new Date()))}>
          Сегодня
        </Button>
        <Button
          variant="secondary"
          aria-label="Предыдущий период"
          onClick={() =>
            setDate(
              mode === "month"
                ? new Date(date.getFullYear(), date.getMonth() - 1, 1)
                : add(date, -length),
            )
          }
        >
          ‹
        </Button>
        <div className="w-40 shrink-0">
          <Input
            aria-label="Дата календаря"
            type="date"
            className="w-40"
            value={local(date).slice(0, 10)}
            onChange={(e) => {
              if (e.target.value)
                setDate(new Date(e.target.value + "T00:00:00"));
            }}
          />
        </div>
        <Button
          variant="secondary"
          aria-label="Следующий период"
          onClick={() =>
            setDate(
              mode === "month"
                ? new Date(date.getFullYear(), date.getMonth() + 1, 1)
                : add(date, length),
            )
          }
        >
          ›
        </Button>
        <div className="flex flex-wrap gap-1" role="tablist">
          {modes.map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={mode === key}
              onClick={() => setMode(key)}
              className={`rounded-lg px-3 py-2 text-sm ${mode === key ? "bg-brand text-white" : "hover:bg-surface-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Input
          aria-label="Поиск событий"
          className="max-w-sm"
          placeholder="Тема или описание"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select
          aria-label="Категория событий"
          className="max-w-xs"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Все категории</option>
          <option value="meeting">Встречи</option>
          <option value="work">Работа</option>
          <option value="personal">Личное</option>
          <option value="anniversary">Юбилеи</option>
        </Select>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-danger-bg p-3 text-danger">
          {error}
        </p>
      )}
      {loading && <p role="status">Загружаем календарь…</p>}
      {mode === "people" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Выберите коллег. Показывается только занятость, без названий чужих
            встреч.
          </p>
          <div className="flex flex-wrap gap-3">
            {people.map((p) => (
              <label key={p.id} className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedPeople.includes(p.id)}
                  onChange={(e) =>
                    setSelectedPeople((old) =>
                      e.target.checked
                        ? [...old, p.id]
                        : old.filter((id) => id !== p.id),
                    )
                  }
                />
                {p.name}
              </label>
            ))}
          </div>
          {selectedPeople.map((id) => (
            <div key={id} className="rounded-xl border border-border p-3">
              <strong>{people.find((p) => p.id === id)?.name}</strong>
              <div className="flex flex-wrap gap-2">
                {busy
                  .filter((b) => b.person_id === id)
                  .map((b, i) => (
                    <span key={i} className="rounded bg-surface-muted p-2">
                      {new Date(b.start).toLocaleTimeString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      –
                      {new Date(b.end).toLocaleTimeString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>
      ) : mode === "schedule" ? (
        <div className="space-y-3">
          {shown.length ? (
            shown.map(eventButton)
          ) : (
            <p className="p-8 text-muted">В выбранном периоде нет событий.</p>
          )}
        </div>
      ) : mode === "month" ? (
        <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-border">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
            <div key={d} className="bg-surface-muted p-2 text-center text-sm">
              {d}
            </div>
          ))}
          {Array.from({ length: 42 }, (_, i) => {
            const d = add(begin, i),
              items = atDay(d);
            return (
              <div key={i} className="min-h-24 border border-border p-2">
                <button
                  aria-label={`Открыть ${d.toLocaleDateString("ru-RU")}`}
                  onClick={() => {
                    setDate(d);
                    setMode("day");
                  }}
                  className="font-semibold"
                >
                  {d.getDate()}
                </button>
                <div className="flex flex-wrap gap-1">
                  {items.map((e) => (
                    <button
                      key={e.id}
                      title={e.title}
                      aria-label={e.title}
                      onClick={() =>
                        setEditor({ row: e, at: new Date(e.start) })
                      }
                      style={{ background: colors[e.category] }}
                      className="h-2 w-2 rounded-full"
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <CalendarTimeGrid
          begin={begin}
          days={length}
          events={shown}
          open={(e) => setEditor({ row: e, at: new Date(e.start) })}
          create={(at) => setEditor({ at })}
          move={move}
        />
      )}
      {editor && (
        <EventForm
          row={editor.row}
          at={editor.at}
          people={people}
          close={() => setEditor(null)}
          saved={() => {
            setEditor(null);
            setRevision((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}
function payload(r: Event) {
  const {
    title,
    start,
    end,
    timezone,
    description,
    location,
    category,
    availability,
    recurrence,
    count,
    participants,
    cancelled,
    version,
  } = r;
  return {
    title,
    start,
    end,
    timezone,
    description,
    location,
    category,
    availability,
    recurrence,
    count,
    participants,
    cancelled,
    version,
  };
}
function EventForm({
  row,
  at,
  people,
  close,
  saved,
}: {
  row?: Event;
  at: Date;
  people: Person[];
  close: () => void;
  saved: () => void;
}) {
  const [title, setTitle] = useState(row?.title || ""),
    [start, setStart] = useState(local(row ? new Date(row.start) : at)),
    [end, setEnd] = useState(
      local(row ? new Date(row.end) : new Date(at.getTime() + 3600000)),
    ),
    [location, setLocation] = useState(row?.location || ""),
    [description, setDescription] = useState(row?.description || ""),
    [category, setCategory] = useState(row?.category || "meeting"),
    [recurrence, setRecurrence] = useState(row?.recurrence || "none"),
    [count, setCount] = useState(row?.count || 12),
    [participants, setParticipants] = useState(row?.participants || []),
    [availability, setAvailability] = useState(row?.availability || "busy"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const retry = useRef({ json: "", id: "" }),
    readonly = !!row && !row.can_edit;
  const save = async (cancelled = false) => {
    if (busy) return;
    if (
      !start ||
      !end ||
      !Number.isFinite(new Date(start).getTime()) ||
      !Number.isFinite(new Date(end).getTime())
    ) {
      setError("Укажите корректное начало и окончание встречи");
      return;
    }
    const data = {
      title,
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      timezone:
        row?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      location,
      description,
      category,
      availability,
      recurrence,
      count,
      participants,
      cancelled,
      version: row?.version || 0,
    };
    const json = JSON.stringify(data);
    if (retry.current.json !== json)
      retry.current = { json, id: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      await call(
        row ? `/events/${row.id}` : "/events",
        row ? "PATCH" : "POST",
        { ...data, request_id: retry.current.id },
      );
      saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={close}
      title={row ? "Встреча" : "Новая встреча"}
      footer={
        <>
          {row?.can_edit && (
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => void save(true)}
            >
              Отменить {row.recurrence === "none" ? "встречу" : "всю серию"}
            </Button>
          )}
          <Button variant="secondary" onClick={close}>
            Закрыть
          </Button>
          {!readonly && (
            <Button
              disabled={
                busy ||
                !title.trim() ||
                !start ||
                !end ||
                new Date(end) <= new Date(start)
              }
              onClick={() => void save()}
            >
              Сохранить
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        {row && row.recurrence !== "none" && (
          <p className="text-sm text-muted">
            Изменения применяются ко всей серии встреч.
          </p>
        )}
        <fieldset disabled={readonly || busy} className="space-y-3">
          <Field label="Тема">
            <Input
              aria-label="Тема встречи"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Начало">
              <Input
                aria-label="Начало встречи"
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </Field>
            <Field label="Окончание">
              <Input
                aria-label="Окончание встречи"
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Место или ссылка">
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </Field>
          <Field label="Повестка">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Select
            aria-label="Тип встречи"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {Object.keys(colors).map((k, i) => (
              <option key={k} value={k}>
                {["Встреча", "Работа", "Личное", "Юбилей"][i]}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Занятость"
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
          >
            <option value="busy">Занят</option>
            <option value="free">Свободен</option>
            <option value="away">Нет на месте</option>
          </Select>
          <Select
            aria-label="Повторение"
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value)}
          >
            {["none", "daily", "weekly", "monthly"].map((k, i) => (
              <option key={k} value={k}>
                {
                  ["Без повторения", "Ежедневно", "Еженедельно", "Ежемесячно"][
                    i
                  ]
                }
              </option>
            ))}
          </Select>
          {recurrence !== "none" && (
            <Field label="Число повторений">
              <Input
                type="number"
                min={1}
                max={366}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </Field>
          )}
          <p className="text-sm font-medium">
            Участники · внутренние приглашения
          </p>
          <div className="max-h-44 overflow-auto">
            {people.map((p) => (
              <label key={p.id} className="flex gap-2 py-1 text-sm">
                <input
                  type="checkbox"
                  checked={participants.includes(p.id)}
                  onChange={(e) =>
                    setParticipants((old) =>
                      e.target.checked
                        ? [...old, p.id]
                        : old.filter((id) => id !== p.id),
                    )
                  }
                />
                {p.name}{" "}
                {row?.responses[String(p.id)] &&
                  `· ${{ pending: "Ожидаем ответ", accepted: "Придёт", tentative: "Возможно", declined: "Не придёт" }[row.responses[String(p.id)]]}`}
              </label>
            ))}
          </div>
        </fieldset>
        {!readonly && (
          <MeetingPlanner
            participants={participants}
            start={start}
            end={end}
            excludeId={row?.id}
            disabled={busy}
            choose={(slot) => {
              setStart(local(new Date(slot.start)));
              setEnd(local(new Date(slot.end)));
            }}
          />
        )}
        {readonly && (
          <div className="flex flex-wrap gap-2">
            {["accepted", "tentative", "declined"].map((response, i) => (
              <Button
                key={response}
                variant="secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await call(`/events/${row!.id}/response`, "POST", {
                      response,
                      version: row!.version,
                    });
                    saved();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {["Приду", "Возможно", "Не приду"][i]}
              </Button>
            ))}
          </div>
        )}
        <p className="text-xs text-muted">
          Встреча появится в календарях участников Durov OS. Отправка писем и
          напоминаний ещё не подключена.
        </p>
      </div>
    </Modal>
  );
}
