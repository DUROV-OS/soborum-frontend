import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/shared/lib/httpClient";
import { Button } from "@/shared/ui/Button";
import { Field, Input, Select, Textarea } from "@/shared/ui/Field";
import { CalendarTimeGrid } from "./CalendarTimeGrid";
import { MeetingPlanner } from "./MeetingPlanner";
import { useLocation } from "react-router-dom";
import { useAuthStore } from "@/auth/store";
import { calendarSection, calendarSections } from "./calendarSections";
import { CalendarSettings, type CalendarPreferences } from "./CalendarSettings";
import { CalendarPlannerPage } from "./CalendarPlannerPage";
import { wallDate, wallTime, instant } from "./calendarTime";
import { calendarICS, calendarCSV, downloadCalendar } from "./calendarExport";
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
  all_day?: boolean;
  reminder_minutes?: number | null;
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
const modes = [
  ["day", "День"],
  ["week", "Неделя"],
  ["work", "Рабочая неделя"],
  ["month", "Месяц"],
  ["schedule", "Расписание"],
];
export function CalendarPage() {
  const userId = useAuthStore((s) => s.current?.id);
  const [preferences, setPreferences] = useState<CalendarPreferences | null>(
      null,
    ),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setPreferences(null);
    setError("");
    call<CalendarPreferences>("/preferences")
      .then((p) => {
        if (active) setPreferences(p);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [userId, retry]);
  if (error)
    return (
      <div role="alert" className="space-y-3">
        <p>{error}</p>
        <Button onClick={() => setRetry((x) => x + 1)}>
          Повторить загрузку
        </Button>
      </div>
    );
  if (!preferences) return <p role="status">Загружаем настройки календаря…</p>;
  return (
    <CalendarWorkspace
      preferences={preferences}
      savePreferences={setPreferences}
    />
  );
}
function CalendarWorkspace({
  preferences,
  savePreferences,
}: {
  preferences: CalendarPreferences;
  savePreferences: (value: CalendarPreferences) => void;
}) {
  const search = useLocation().search;
  const section = calendarSection(search);
  const [invitations, setInvitations] = useState<Event[]>([]);
  const [invitationError, setInvitationError] = useState("");
  const [invitationsOnly, setInvitationsOnly] = useState(false);
  const colors = Object.fromEntries(
    Object.entries(preferences.categories).map(([k, v]) => [k, v.color]),
  );
  const [viewMode, setMode] = useState("week"),
    [date, setDate] = useState(() =>
      day(wallDate(new Date(), preferences.timezone)),
    ),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [participantFilter, setParticipantFilter] = useState("");
  const mode = section === "team" ? "people" : viewMode;
  useEffect(() => {
    setDate(day(wallDate(new Date(), preferences.timezone)));
  }, [preferences.timezone]);
  const [events, setEvents] = useState<Event[]>([]),
    [people, setPeople] = useState<Person[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<{
      row?: Event;
      at: Date;
      until?: Date;
      participants?: number[];
    } | null>(null),
    [selectedPeople, setSelectedPeople] = useState<number[]>([]),
    [busy, setBusy] = useState<
      { person_id: number; start: string; end: string }[]
    >([]);
  const [teamLoading, setTeamLoading] = useState(false),
    [teamError, setTeamError] = useState("");
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
        : mode === "schedule"
          ? 30
          : 7;
  const finish = add(begin, length),
    key = begin.toISOString() + mode + preferences.timezone + section;
  useEffect(() => {
    let active = true;
    setInvitationError("");
    setInvitations([]);
    call<Event[]>("/invitations")
      .then((rows) => {
        if (active) setInvitations(rows);
      })
      .catch((e) => {
        if (active) setInvitationError(e.message);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  useEffect(() => {
    const raw = new URLSearchParams(search).get("date");
    if (raw && Number.isFinite(Date.parse(raw)))
      setDate(day(wallDate(raw, preferences.timezone)));
  }, [search, preferences.timezone]);
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
    setLoading(false);
    setError("");
    if (section !== "mine") return;
    setLoading(true);
    setEvents([]);
    const timer = setTimeout(() => {
      call<Event[]>(
        "/events?" +
          new URLSearchParams({
            start: instant(local(begin), preferences.timezone),
            end: instant(local(finish), preferences.timezone),
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
    setTeamLoading(false);
    setTeamError("");
    if (mode !== "people" || !selectedPeople.length) return;
    setTeamLoading(true);
    const p = new URLSearchParams({
      start: instant(local(begin), preferences.timezone),
      end: instant(local(finish), preferences.timezone),
    });
    selectedPeople.forEach((id) => p.append("person_id", String(id)));
    call<typeof busy>("/busy?" + p)
      .then((r) => {
        if (active) setBusy(r);
      })
      .catch((e) => {
        if (active) setTeamError(e.message);
      })
      .finally(() => {
        if (active) setTeamLoading(false);
      });
    return () => {
      active = false;
    };
  }, [key, selectedPeople, revision]);
  const filtered = (invitationsOnly ? invitations : events)
    .filter((e) => !category || e.category === category)
    .filter(
      (e) =>
        !participantFilter ||
        e.owner_id === Number(participantFilter) ||
        e.participants.includes(Number(participantFilter)),
    )
    .filter(
      (e) =>
        !invitationsOnly ||
        (e.title + " " + e.description)
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase()),
    );
  const openedLink = useRef("");
  useEffect(() => {
    const id = Number(new URLSearchParams(search).get("event"));
    const row = events.find((e) => e.id === id);
    if (row && openedLink.current !== search) {
      openedLink.current = search;
      setEditor({ row, at: new Date(row.start) });
    }
  }, [search, events]);
  const shown = filtered.map((e) => ({
    ...e,
    occurrence_start: wallDate(
      e.occurrence_start,
      e.all_day ? e.timezone : preferences.timezone,
    ).toISOString(),
    occurrence_end: wallDate(
      e.occurrence_end,
      e.all_day ? e.timezone : preferences.timezone,
    ).toISOString(),
  }));
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
        start: instant(local(at), preferences.timezone),
        end: new Date(
          Date.parse(instant(local(at), preferences.timezone)) +
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
      draggable={e.can_edit && e.recurrence === "none" && !e.all_day}
      onDragStart={(a) => a.dataTransfer.setData("text/plain", String(e.id))}
      onClick={() => setEditor({ row: e, at: new Date(e.start) })}
      className="my-1 block w-full rounded-md border-l-4 bg-surface-muted px-2 py-1 text-left text-xs hover:brightness-95"
      style={{ borderColor: colors[e.category] }}
    >
      <strong>
        {(mode === "schedule" || invitationsOnly) &&
          new Date(e.occurrence_start).toLocaleDateString("ru-RU") + " · "}
        {e.all_day
          ? "Весь день"
          : new Date(e.occurrence_start).toLocaleTimeString("ru-RU", {
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
          <h1 className="text-2xl font-semibold">
            {calendarSections.find(([key]) => key === section)?.[1]}
          </h1>
          <p className="text-sm text-muted">
            {
              {
                mine: "Ваши встречи и приглашения",
                team: "Занятость коллег",
                planner: "Поиск общего свободного времени",
                settings: "Ваш рабочий график и оформление",
              }[section]
            }{" "}
            · {preferences.timezone}
          </p>
        </div>
        {(section === "mine" || section === "team") && (
          <Button
            onClick={() => {
              const at = new Date(date);
              at.setHours(10);
              setEditor({ at });
            }}
          >
            Новая встреча
          </Button>
        )}
      </div>
      {section === "settings" ? (
        <CalendarSettings preferences={preferences} saved={savePreferences} />
      ) : section === "planner" ? (
        <CalendarPlannerPage
          key={preferences.timezone}
          preferences={preferences}
          people={people}
          choose={(slot, participants) =>
            setEditor({
              at: wallDate(slot.start, preferences.timezone),
              until: wallDate(slot.end, preferences.timezone),
              participants,
            })
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3">
            <Button
              variant="secondary"
              onClick={() =>
                setDate(day(wallDate(new Date(), preferences.timezone)))
              }
            >
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
            {section === "mine" && (
              <div
                className="flex flex-wrap gap-1"
                role="tablist"
                aria-label="Режим календаря"
              >
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
            )}
          </div>
          {section === "mine" && (
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
                {Object.entries(preferences.categories).map(([key, c]) => (
                  <option key={key} value={key}>
                    {c.label}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Участник событий"
                className="max-w-xs"
                value={participantFilter}
                onChange={(e) => setParticipantFilter(e.target.value)}
              >
                <option value="">Все участники</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <Button
                variant={invitationsOnly ? "primary" : "secondary"}
                aria-pressed={invitationsOnly}
                disabled={!!invitationError}
                onClick={() => setInvitationsOnly(!invitationsOnly)}
              >
                Приглашения ({invitations.length})
              </Button>
              <details className="relative rounded-lg border border-border px-3 py-2 text-sm">
                <summary className="cursor-pointer">Экспорт</summary>
                <div className="absolute right-0 z-30 mt-2 w-72 space-y-3 rounded-xl border border-border bg-surface p-4 shadow-lg">
                  <p>
                    Снимок{" "}
                    {invitationsOnly
                      ? "списка приглашений"
                      : "выбранного периода"}{" "}
                    с текущими фильтрами. Повторения выгружаются отдельными
                    событиями. Это не синхронизация.
                  </p>
                  <Button
                    variant="secondary"
                    disabled={loading || !!error || !filtered.length}
                    onClick={() =>
                      downloadCalendar(calendarICS(filtered), "ics")
                    }
                  >
                    Скачать iCalendar (.ics)
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={loading || !!error || !filtered.length}
                    onClick={() =>
                      downloadCalendar(
                        calendarCSV(filtered, preferences.timezone),
                        "csv",
                      )
                    }
                  >
                    Скачать CSV для Excel
                  </Button>
                </div>
              </details>
              {invitationError && (
                <p role="alert" className="text-danger">
                  Не удалось загрузить приглашения: {invitationError}
                </p>
              )}
            </div>
          )}
          {invitationsOnly && section === "mine" && (
            <p className="text-sm text-muted">
              Предстоящие приглашения без ответа за все даты. Откройте встречу,
              чтобы принять или отклонить приглашение.
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-lg bg-danger-bg p-3 text-danger">
              {error}
            </p>
          )}
          {loading && <p role="status">Загружаем календарь…</p>}
          {mode === "people" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Выберите коллег. Показывается только занятость, без названий
                чужих встреч.
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
              {teamLoading && <p role="status">Загружаем занятость…</p>}
              {teamError && (
                <p role="alert" className="text-danger">
                  {teamError}
                </p>
              )}
              {!teamLoading &&
                !teamError &&
                selectedPeople.map((id) => (
                  <div key={id} className="rounded-xl border border-border p-3">
                    <strong>{people.find((p) => p.id === id)?.name}</strong>
                    <div className="flex flex-wrap gap-2">
                      {!busy.some((b) => b.person_id === id) && (
                        <span className="text-sm text-muted">
                          Нет занятых интервалов на выбранный день.
                        </span>
                      )}
                      {busy
                        .filter((b) => b.person_id === id)
                        .map((b, i) => (
                          <span
                            key={i}
                            className="rounded bg-surface-muted p-2"
                          >
                            {new Date(b.start).toLocaleTimeString("ru-RU", {
                              timeZone: preferences.timezone,
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            –
                            {new Date(b.end).toLocaleTimeString("ru-RU", {
                              timeZone: preferences.timezone,
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          ) : mode === "schedule" || invitationsOnly ? (
            <div className="space-y-3">
              {shown.length ? (
                shown.map(eventButton)
              ) : (
                <p className="p-8 text-muted">
                  В выбранном периоде нет событий.
                </p>
              )}
            </div>
          ) : mode === "month" ? (
            <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-border">
              {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
                <div
                  key={d}
                  className="bg-surface-muted p-2 text-center text-sm"
                >
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
              colors={colors}
              days={length}
              weekdays={mode === "work" ? preferences.weekdays : undefined}
              events={shown}
              open={(e) => setEditor({ row: e, at: new Date(e.start) })}
              create={(at) => setEditor({ at })}
              move={move}
            />
          )}
        </>
      )}
      {editor && (
        <EventForm
          row={editor.row}
          at={editor.at}
          until={editor.until}
          initialParticipants={editor.participants}
          preferences={preferences}
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
    all_day = false,
    reminder_minutes = null,
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
    all_day,
    reminder_minutes,
    version,
  };
}
function EventForm({
  row,
  at,
  until,
  initialParticipants,
  preferences,
  people,
  close,
  saved,
}: {
  row?: Event;
  at: Date;
  until?: Date;
  initialParticipants?: number[];
  preferences: CalendarPreferences;
  people: Person[];
  close: () => void;
  saved: () => void;
}) {
  const zone = row?.timezone || preferences.timezone;
  const colors = Object.fromEntries(
    Object.entries(preferences.categories).map(([k, v]) => [k, v.color]),
  );
  const [title, setTitle] = useState(row?.title || ""),
    [start, setStart] = useState(row ? wallTime(row.start, zone) : local(at)),
    [end, setEnd] = useState(
      row
        ? wallTime(row.end, zone)
        : local(until || new Date(at.getTime() + 3600000)),
    ),
    [allDay, setAllDay] = useState(row?.all_day || false),
    [reminder, setReminder] = useState<number | null>(
      row?.reminder_minutes ?? null,
    ),
    [location, setLocation] = useState(row?.location || ""),
    [description, setDescription] = useState(row?.description || ""),
    [category, setCategory] = useState(row?.category || "meeting"),
    [recurrence, setRecurrence] = useState(row?.recurrence || "none"),
    [count, setCount] = useState(row?.count || 12),
    [participants, setParticipants] = useState(
      row?.participants || initialParticipants || [],
    ),
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
    let startUTC: string, endUTC: string;
    try {
      startUTC = instant(start, zone);
      endUTC = instant(end, zone);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    const data = {
      title,
      start: startUTC,
      end: endUTC,
      timezone: zone,
      location,
      description,
      category,
      availability,
      recurrence,
      count,
      participants,
      cancelled,
      all_day: allDay,
      reminder_minutes: reminder,
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
        <p className="text-xs text-muted">Время встречи: {zone}</p>
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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => {
                setAllDay(e.target.checked);
                if (e.target.checked) {
                  const a = (start || local(at)).slice(0, 10) + "T00:00";
                  const last = new Date((end || start || local(at)).slice(0, 10) + "T00:00");
                  last.setDate(last.getDate() + 1);
                  setStart(a);
                  setEnd(local(last));
                }
              }}
            />
            Весь день
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Начало">
              <Input
                aria-label="Начало встречи"
                type={allDay ? "date" : "datetime-local"}
                value={allDay ? start.slice(0, 10) : start}
                onChange={(e) =>
                  setStart(
                    e.target.value
                      ? e.target.value + (allDay ? "T00:00" : "")
                      : "",
                  )
                }
              />
            </Field>
            <Field
              label={allDay ? "Последний день (включительно)" : "Окончание"}
            >
              <Input
                aria-label="Окончание встречи"
                type={allDay ? "date" : "datetime-local"}
                value={
                  allDay && end
                    ? local(add(new Date(end), -1)).slice(0, 10)
                    : end
                }
                onChange={(e) =>
                  setEnd(
                    allDay && e.target.value
                      ? local(add(new Date(e.target.value + "T00:00"), 1))
                      : e.target.value,
                  )
                }
              />
            </Field>
          </div>
          <Field label="Напоминание в Durov OS">
            <Select
              aria-label="Напоминание"
              value={reminder == null ? "" : reminder}
              onChange={(e) =>
                setReminder(
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            >
              <option value="">Без напоминания</option>
              {[
                [0, "В момент начала"],
                [5, "За 5 минут"],
                [15, "За 15 минут"],
                [30, "За 30 минут"],
                [60, "За час"],
                [1440, "За день"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
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
            {Object.keys(colors).map((k) => (
              <option key={k} value={k}>
                {preferences.categories[k].label}
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
        {!readonly && !allDay && (
          <MeetingPlanner
            preferences={{ ...preferences, timezone: zone }}
            participants={participants}
            start={start}
            end={end}
            excludeId={row?.id}
            disabled={busy}
            choose={(slot) => {
              setStart(wallTime(slot.start, zone));
              setEnd(wallTime(slot.end, zone));
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
          push ещё не подключена. Напоминания появляются в любом разделе, пока
          Durov OS открыта; проверка каждые 30 секунд. «Понятно» скрывает
          напоминание до перезагрузки страницы.
        </p>
      </div>
    </Modal>
  );
}
