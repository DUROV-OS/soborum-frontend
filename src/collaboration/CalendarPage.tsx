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
import { CalendarAdd } from "./CalendarAdd";
import {
  CalendarAttachments,
  discardCalendarFile,
  type CalendarFile,
} from "./CalendarAttachments";
import { Link } from "react-router-dom";
import { Modal } from "@/shared/ui/Modal";
import { calendarDragType, readCalendarDrag } from './calendarDrag';
import { CalendarCategoryIcon } from './CalendarCategory';
import { CalendarDays } from 'lucide-react';
type Person = { id: number; name: string; can_work_tasks?: boolean };
type Event = {
  id: number;
  version: number;
  owner_id: number;
  can_edit: boolean;
  can_delete?: boolean;
  can_manage_access?: boolean;
  can_respond?: boolean;
  coorganizers?: number[];
  editors?: number[];
  tags?: string[];
  links?: { label: string; url: string }[];
  attachment_ids?: string[];
  attachments?: CalendarFile[];
  task_assignee_id?: number | null;
  task_reviewer_id?: number | null;
  task?: { id: number; status: string; can_open: boolean } | null;
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
  occurrence_id?: string;
};
const call = <T,>(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: unknown,
) =>
  apiRequest<T>({
    section: "projects",
    path: "/calendar" + path,
    timeoutMs: 30000,
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
  const [movePending, setMovePending] = useState<{ row: Event; at: Date } | null>(null);
  const [moving, setMoving] = useState(false);
  const [moveNotice, setMoveNotice] = useState('');
  const [moveError, setMoveError] = useState('');
  const [preview, setPreview] = useState<Event | null>(null);
  const [previewTime, setPreviewTime] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
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
      category?: string;
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
  const saveMove = async (row: Event, at: Date, scope: 'occurrence' | 'series') => {
    setMoving(true); setMoveError(''); setMoveNotice('');
    try {
      await call(`/events/${row.id}/move`, "PATCH", {
        version: row.version,
        request_id: crypto.randomUUID(),
        occurrence_id: row.occurrence_id || '0', scope,
        start: instant(local(at), row.all_day ? row.timezone : preferences.timezone),
      });
      setRevision((v) => v + 1);
      setMovePending(null); setMoveNotice('Время события изменено');
    } catch (e) {
      setMoveError((e as Error).message);
      setMovePending(null); setRevision(v => v + 1);
    } finally { setMoving(false); }
  };
  const move = (id: number, at: Date, occurrence?: string) => {
    const row = events.find(e => e.id === id && (!occurrence || e.occurrence_id === occurrence));
    if (!row?.can_edit || moving) return;
    if (row.recurrence !== 'none') setMovePending({ row, at });
    else void saveMove(row, at, 'occurrence');
  };
  const dropOnDay = (transfer: DataTransfer, date: Date) => {
    const item = readCalendarDrag(transfer);
    if (!item) return;
    const row = shown.find(e => e.id === item.id && e.occurrence_id === item.occurrence);
    if (!row) return;
    const start = new Date(row.occurrence_start), at = new Date(date);
    at.setHours(row.all_day ? 0 : start.getHours(), row.all_day ? 0 : start.getMinutes(), 0, 0);
    move(item.id, at, item.occurrence);
  };
  const openPreview = (event: Event) => {
    const canonical = events.find(e => e.id === event.id && e.occurrence_id === event.occurrence_id) || event;
    setPreview(canonical);
    setPreviewTime(local(wallDate(canonical.occurrence_start, canonical.all_day ? canonical.timezone : preferences.timezone)));
  };
  const eventButton = (e: Event) => (
    <button
      key={`${e.id}-${e.occurrence_id ?? e.occurrence_start}`}
      draggable={e.can_edit && !moving}
      onDragStart={(a) => a.dataTransfer.setData(calendarDragType, JSON.stringify({ id: e.id, occurrence: e.occurrence_id || '0' }))}
      onClick={() => openPreview(e)}
      className="my-1 block w-full rounded-md border-l-4 bg-surface-muted px-2 py-1 text-left text-xs hover:brightness-95"
      style={{ borderColor: colors[e.category] }}
    >
      <strong>
        <CalendarCategoryIcon category={e.category} color={colors[e.category]} />
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
      {(moving || moveNotice) && <p role="status" className="text-sm text-muted">{moving ? 'Сохраняем новое время…' : moveNotice}</p>}
      {moveError && <p role="alert" className="rounded-lg bg-danger-bg p-3 text-danger">Не удалось перенести событие: {moveError}</p>}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.title || 'Событие'} footer={preview?.can_edit && <Button onClick={() => { setEditor({ row: preview, at: new Date(preview.start) }); setPreview(null); }}>{preview.recurrence === 'none' ? 'Редактировать' : 'Редактировать серию'}</Button>}>
        {preview && <div className="space-y-3 text-sm">
          <p className="border-l-4 pl-3" style={{ borderColor: colors[preview.category] }}><CalendarCategoryIcon category={preview.category} color={colors[preview.category]} />{preferences.categories[preview.category]?.label}</p>
          <p>{new Date(preview.occurrence_start).toLocaleString('ru-RU', { timeZone: preferences.timezone })} — {new Date(preview.occurrence_end).toLocaleString('ru-RU', { timeZone: preferences.timezone })} · {preferences.timezone}</p>
          {preview.location && <p>{preview.location}</p>}{preview.description && <p className="whitespace-pre-wrap break-words">{preview.description}</p>}
          {!!preview.participants.length && <p className="text-muted">Участники: {preview.participants.map(id => people.find(p => p.id === id)?.name || 'Сотрудник').join(', ')}</p>}
          {preview.can_edit && <div className="space-y-2 border-t border-border pt-3"><Field label="Перенести на"><Input aria-label="Новое время события" type="datetime-local" value={previewTime} onChange={e => setPreviewTime(e.target.value)}/></Field><Button variant="secondary" disabled={!previewTime || moving} onClick={() => { move(preview.id, new Date(previewTime), preview.occurrence_id); setPreview(null); }}>Перенести</Button></div>}
        </div>}
      </Modal>
      <Modal open={!!movePending} onClose={() => { if (!moving) setMovePending(null); }} title="Перенести повторяющуюся встречу" footer={<>
        <Button variant="ghost" disabled={moving} onClick={() => setMovePending(null)}>Отмена</Button>
        <Button disabled={moving} onClick={() => movePending && void saveMove(movePending.row, movePending.at, 'occurrence')}>Только это событие</Button>
        <Button disabled={moving} onClick={() => movePending && void saveMove(movePending.row, movePending.at, 'series')}>Всю серию</Button>
      </>}><p>Новое время: {movePending?.at.toLocaleString('ru-RU')}. При переносе серии остальные встречи сдвинутся на тот же интервал.</p></Modal>
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
          <CalendarAdd
            choose={(category) => {
              const at = new Date(date);
              at.setHours(10, 0, 0, 0);
              setEditor({ at, category });
            }}
          />
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
              aria-label="Сегодня"
              className="!px-2 sm:!px-4"
              onClick={() =>
                setDate(day(wallDate(new Date(), preferences.timezone)))
              }
            >
              <CalendarDays size={18} className="sm:hidden"/><span className="hidden sm:inline">Сегодня</span>
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
            <div className="w-32 shrink-0 sm:w-40">
              <Input
                aria-label="Дата календаря"
                type="date"
                className="w-full"
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
                className="flex w-full min-w-0 gap-1 overflow-x-auto sm:w-auto sm:flex-wrap"
                role="tablist"
                aria-label="Режим календаря"
              >
                {modes.map(([key, label]) => (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={mode === key}
                    onClick={() => setMode(key)}
                    className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm ${mode === key ? "bg-brand text-white" : "hover:bg-surface-muted"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {section === "mine" && (
            <>
            <Button variant="secondary" className="sm:hidden" aria-expanded={filtersOpen} aria-controls="calendar-filters" onClick={() => setFiltersOpen(v => !v)}>Поиск и фильтры{(query || category || participantFilter || invitationsOnly) ? ' · включены' : ''}</Button>
            <div id="calendar-filters" className={`${filtersOpen ? 'flex' : 'hidden'} flex-wrap gap-3 sm:flex`}>
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
            </>
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
                  <div key={i} className="min-h-24 min-w-0 border border-border p-1 sm:p-2" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); dropOnDay(e.dataTransfer, d); }}>
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
                    <div className="space-y-1">
                      {items.slice(0, 3).map((e) => (
                        <button
                          key={`${e.id}-${e.occurrence_id}`}
                          title={e.title}
                          aria-label={e.title}
                          draggable={e.can_edit && !moving}
                          onDragStart={a => a.dataTransfer.setData(calendarDragType, JSON.stringify({ id: e.id, occurrence: e.occurrence_id || '0' }))}
                          onClick={() =>
                            openPreview(e)
                          }
                          style={{ borderColor: colors[e.category] }}
                          className="block w-full truncate rounded border-l-4 bg-surface-muted px-1 py-1 text-left text-[10px] sm:text-xs"
                        ><CalendarCategoryIcon category={e.category} color={colors[e.category]} />{e.title}</button>
                      ))}
                      {items.length > 3 && <button className="text-xs text-brand-dark" onClick={() => { setDate(d); setMode('day'); }}>Ещё {items.length - 3}</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <CalendarTimeGrid
              begin={begin}
              colors={colors}
              workStart={preferences.work_start}
              workEnd={preferences.work_end}
              workingDays={preferences.weekdays}
              disabled={moving}
              days={length}
              weekdays={mode === "work" ? preferences.weekdays : undefined}
              events={shown}
              open={openPreview}
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
          initialCategory={editor.category}
          savePreferences={savePreferences}
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
function EventForm({
  row,
  at,
  until,
  initialParticipants,
  initialCategory,
  savePreferences,
  preferences,
  people,
  close,
  saved,
}: {
  row?: Event;
  at: Date;
  until?: Date;
  initialParticipants?: number[];
  initialCategory?: string;
  savePreferences: (value: CalendarPreferences) => void;
  preferences: CalendarPreferences;
  people: Person[];
  close: () => void;
  saved: () => void;
}) {
  const zone = row?.timezone || preferences.timezone;
  const taskAccess = useAuthStore(s => s.accessLevel('tasks'));
  const editorRoot = useRef<HTMLDivElement>(null);
  const [fieldErrors,setFieldErrors] = useState<Record<string,string>>({});
  const initialAllDay = row?.all_day || (!row && initialCategory === 'anniversary');
  const initialStart = new Date(at); if(initialAllDay) initialStart.setHours(0,0,0,0);
  const initialEnd = until ? new Date(until) : new Date(at.getTime()+3600000);
  if(initialAllDay) { initialEnd.setTime(initialStart.getTime()); initialEnd.setDate(initialEnd.getDate()+1); }
  else if(!until && at.getHours()<21 && initialEnd.getHours()>=21) initialEnd.setHours(21,0,0,0);
  const colors = Object.fromEntries(
    Object.entries(preferences.categories).map(([k, v]) => [k, v.color]),
  );
  const [title, setTitle] = useState(row?.title || ""),
    [start, setStart] = useState(row ? wallTime(row.start, zone) : local(initialStart)),
    [end, setEnd] = useState(
      row
        ? wallTime(row.end, zone)
        : local(initialEnd),
    ),
    [allDay, setAllDay] = useState(initialAllDay),
    [reminder, setReminder] = useState<number | null>(
      row?.reminder_minutes ?? null,
    ),
    [location, setLocation] = useState(row?.location || ""),
    [description, setDescription] = useState(row?.description || ""),
    [category, setCategory] = useState(
      row?.category || initialCategory || "meeting",
    ),
    [recurrence, setRecurrence] = useState(row?.recurrence || "none"),
    [count, setCount] = useState(row?.count || 12),
    [participants, setParticipants] = useState(
      row?.participants || initialParticipants || [],
    ),
    [availability, setAvailability] = useState(row?.availability || "busy"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [attachments, setAttachments] = useState<CalendarFile[]>(
    row?.attachments || [],
  );
  const staged = useRef(new Set<string>());
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deletion = useRef(crypto.randomUUID());
  const [templateMessage, setTemplateMessage] = useState("");
  const saveTemplate = async () => {
    setBusy(true);
    setError("");
    setTemplateMessage("");
    try {
      const duration = Math.round(
        (new Date(end).getTime() - new Date(start).getTime()) / 60000,
      );
      if (
        !title.trim() ||
        !Number.isFinite(duration) ||
        duration < 1 ||
        duration > 1440
      )
        throw new Error(
          "Для шаблона укажите тему и длительность от минуты до суток",
        );
      const templates = [
        ...(preferences.templates || []),
        {
          id: crypto.randomUUID(),
          title,
          description,
          location,
          category,
          duration_minutes: duration,
          reminder_minutes: reminder,
          recurrence,
          count,
        },
      ];
      const result = await apiRequest<CalendarPreferences>({
        section: "projects",
        path: "/calendar/preferences",
        method: "PUT",
        body: { ...preferences, templates },
      });
      savePreferences(result);
      setTemplateMessage("Шаблон сохранён в вашей учётной записи");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const [tags, setTags] = useState((row?.tags || []).join(", "));
  const [links, setLinks] = useState(row?.links || []);
  const [coorganizers, setCoorganizers] = useState(row?.coorganizers || []);
  const [editors, setEditors] = useState(row?.editors || []);
  const [assignee, setAssignee] = useState<number | null>(
    row?.task_assignee_id || null,
  );
  const [reviewer, setReviewer] = useState<number | null>(
    row?.task_reviewer_id || null,
  );
  const managing = !row || !!row.can_manage_access;
  const closeForm = () => {
    if (busy || uploading) return;
    // Bound files cannot be discarded; a lost save response is safe here as well.
    for (const id of staged.current)
      void discardCalendarFile(id).catch(() => {});
    close();
  };
  const deleteRecord = async () => {
    if (!row || busy) return;
    setBusy(true);
    setError("");
    try {
      await call(`/events/${row.id}`, "DELETE", {
        version: row.version,
        request_id: deletion.current,
      });
      saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const retry = useRef({ json: "", id: "" }),
    readonly = !!row && !row.can_edit;
  const save = async (cancelled = false) => {
    if (busy || uploading) return;
    const invalid: Record<string,string> = {};
    if(!title.trim()) invalid.title='Укажите тему записи';
    if(!start || !Number.isFinite(new Date(start).getTime())) invalid.start='Укажите дату и время начала';
    if(!end || !Number.isFinite(new Date(end).getTime())) invalid.end='Укажите дату и время окончания';
    else if(start && new Date(end)<=new Date(start)) invalid.end='Окончание должно быть позже начала';
    if(category==='work') {
      if(taskAccess==='none' || taskAccess==='view') invalid.assignee='Для полноценной задачи нужны права редактирования раздела «Задачи»';
      else if(!assignee) invalid.assignee='Выберите исполнителя задачи';
      if(!reviewer) invalid.reviewer='Выберите сотрудника для приёмки';
      else if(assignee===reviewer) invalid.reviewer='Исполнитель и проверяющий должны быть разными сотрудниками';
    }
    setFieldErrors(invalid);
    if(Object.keys(invalid).length) {
      setError(Object.values(invalid).join('. '));
      requestAnimationFrame(()=>editorRoot.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());
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
      title: title.trim(),
      start: startUTC,
      end: endUTC,
      timezone: zone,
      location,
      description,
      category,
      availability,
      recurrence,
      count,
      participants:
        category === "work"
          ? Array.from(
              new Set([
                ...participants,
                ...[assignee, reviewer].filter(
                  (id): id is number => id !== null,
                ),
              ]),
            )
          : participants,
      coorganizers: coorganizers.filter((id) => participants.includes(id)),
      editors: editors.filter((id) => participants.includes(id)),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      links,
      attachment_ids: attachments.map((f) => f.id),
      task_assignee_id: category === "work" ? assignee : null,
      task_reviewer_id: category === "work" ? reviewer : null,
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
      staged.current.clear();
      saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (confirmDelete)
    return (
      <Modal
        open
        onClose={() => {
          if (!busy) setConfirmDelete(false);
        }}
        title="Удалить запись"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setConfirmDelete(false)}
            >
              Отмена
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => void deleteRecord()}
            >
              Удалить
            </Button>
          </>
        }
      >
        <p>Вы уверены, что хотите удалить эту запись?</p>
        {row?.recurrence !== "none" && (
          <p className="mt-2 text-sm text-muted">Будет удалена вся серия.</p>
        )}
        {row?.task && (
          <p className="mt-2 text-sm text-muted">
            Связанная задача уйдёт из рабочих списков. История выполнения
            сохранится.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-danger">
            {error}
          </p>
        )}
      </Modal>
    );
  return (
    <Modal
      open
      width="max-w-4xl"
      mobileFull
      onClose={closeForm}
      title={
        row
          ? {
              meeting: "Встреча",
              briefing: "Планёрка",
              work: "Задача",
              personal: "Личное",
              anniversary: "Юбилей",
            }[category] || "Запись"
          : "Добавить запись"
      }
      footer={
        <>
          {row?.can_delete && (
            <Button
              variant="danger"
              disabled={busy || uploading}
              onClick={() => {
                setError("");
                setConfirmDelete(true);
              }}
            >
              Удалить
            </Button>
          )}
          <Button
            variant="secondary"
            disabled={busy || uploading}
            onClick={closeForm}
          >
            Закрыть
          </Button>
          {!readonly && (
            <Button
              disabled={busy || uploading}
              onClick={() => void save()}
            >
              {busy ? "Сохраняем…" : uploading ? "Загрузка файлов…" : "Сохранить"}
            </Button>
          )}
        </>
      }
    >
      <div ref={editorRoot} className="space-y-4">
        {!row && !!preferences.templates?.length && (
          <Field label="Из шаблона">
            <Select
              aria-label="Из шаблона"
              disabled={busy || uploading}
              value=""
              onChange={(e) => {
                const t = preferences.templates?.find(
                  (t) => t.id === e.target.value,
                );
                if (!t) return;
                setTitle(t.title);
                setDescription(t.description);
                setLocation(t.location);
                setCategory(t.category);
                setReminder(t.reminder_minutes);
                setRecurrence(t.category === "work" ? "none" : t.recurrence);
                setCount(t.count);
                setAllDay(false);
                if (start)
                  setEnd(
                    local(
                      new Date(
                        new Date(start).getTime() + t.duration_minutes * 60000,
                      ),
                    ),
                  );
              }}
            >
              <option value="">Выберите шаблон</option>
              {preferences.templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <p className="text-xs text-muted">
          Часовой пояс: {zone}
          {row &&
            ` · Организатор: ${people.find((p) => p.id === row.owner_id)?.name || "сотрудник"}`}
        </p>
        {row?.task && (
          <div className="rounded-lg border border-border bg-surface-muted p-3 text-sm">
            <span>
              Задача №{row.task.id} ·{" "}
              {
                {
                  not_ready: "Ожидает",
                  ready: "Готова к работе",
                  in_progress: "В работе",
                  in_review: "На проверке",
                  done: "Выполнена",
                }[row.task.status]
              }
            </span>
            {row.task.can_open && (
              <Link
                onClick={closeForm}
                className="ml-3 text-accent underline"
                to={`/tasks?task=${row.task.id}`}
              >
                Выполнение и отчёты →
              </Link>
            )}
          </div>
        )}
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
        <fieldset
          disabled={readonly || busy || uploading}
          className="space-y-3"
        >
          <Field label="Тема" required hint={fieldErrors.title}>
            <Input
              aria-label="Тема встречи"
              aria-invalid={!!fieldErrors.title}
              className={fieldErrors.title ? "border-danger" : ""}
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
                  const last = new Date(
                    (end || start || local(at)).slice(0, 10) + "T00:00",
                  );
                  last.setDate(last.getDate() + 1);
                  setStart(a);
                  setEnd(local(last));
                }
              }}
            />
            Весь день
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Начало" required hint={fieldErrors.start}>
              <Input
                aria-label="Начало встречи"
                aria-invalid={!!fieldErrors.start}
                className={fieldErrors.start ? "border-danger" : ""}
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
              required hint={fieldErrors.end}
            >
              <Input
                aria-label="Окончание встречи"
                aria-invalid={!!fieldErrors.end}
                className={fieldErrors.end ? "border-danger" : ""}
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
              aria-label="Повестка"
              rows={6}
              className="w-full min-h-36 resize-y"
              maxLength={10000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Select
            aria-label="Тип встречи"
            value={category}
            disabled={!!row?.task}
            onChange={(e) => {
              setCategory(e.target.value);
              if (e.target.value === "work") setRecurrence("none");
            }}
          >
            {Object.keys(colors).map((k) => (
              <option key={k} value={k}>
                {preferences.categories[k].label}
              </option>
            ))}
          </Select>
          {category === "work" && (
            <div className="space-y-3 rounded-xl border border-border bg-surface-muted p-4">
              <p className="text-sm text-muted">
                Задача появится в разделе «Задачи». Окончание — срок выполнения.
                Отчёт принимает другой сотрудник.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(["assignee", "reviewer"] as const).map((kind) => (
                  <Field
                    key={kind}
                    label={kind === "assignee" ? "Исполнитель" : "Проверяющий"}
                    required hint={fieldErrors[kind]}
                  >
                    <Select
                      aria-label={
                        kind === "assignee" ? "Исполнитель" : "Проверяющий"
                      }
                      disabled={!managing}
                      aria-invalid={!!fieldErrors[kind]}
                      className={fieldErrors[kind] ? "border-danger" : ""}
                      value={(kind === "assignee" ? assignee : reviewer) || ""}
                      onChange={(e) => {
                        const id = Number(e.target.value) || null;
                        (kind === "assignee" ? setAssignee : setReviewer)(id);
                        if (id)
                          setParticipants((old) =>
                            Array.from(new Set([...old, id])),
                          );
                      }}
                    >
                      <option value="">Выберите сотрудника</option>
                      {people
                        .filter((p) => p.can_work_tasks)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </Select>
                  </Field>
                ))}
              </div>
            </div>
          )}
          <Field label="Теги (через запятую)">
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Продажи, планёрка, проект"
            />
          </Field>
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
            disabled={category === "work"}
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
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-2 py-1 text-sm"
              >
                <label className="flex flex-1 items-center gap-2">
                  <input
                    type="checkbox"
                    disabled={
                      !managing ||
                      (category === "work" &&
                        (p.id === assignee || p.id === reviewer))
                    }
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
                {participants.includes(p.id) && p.id !== row?.owner_id && (
                  <Select
                    aria-label={`Права: ${p.name}`}
                    className="w-auto max-w-full py-1 text-xs"
                    disabled={!managing}
                    value={
                      coorganizers.includes(p.id)
                        ? "coorganizer"
                        : editors.includes(p.id)
                          ? "editor"
                          : "viewer"
                    }
                    onChange={(e) => {
                      setCoorganizers((old) => [
                        ...old.filter((id) => id !== p.id),
                        ...(e.target.value === "coorganizer" ? [p.id] : []),
                      ]);
                      setEditors((old) => [
                        ...old.filter((id) => id !== p.id),
                        ...(e.target.value === "editor" ? [p.id] : []),
                      ]);
                    }}
                  >
                    <option value="viewer">Просмотр</option>
                    <option value="editor">Редактирование</option>
                    <option value="coorganizer">Соорганизатор</option>
                  </Select>
                )}
              </div>
            ))}
          </div>
          <section className="space-y-2 rounded-xl border border-border p-3">
            <h3 className="text-sm font-medium">Ссылки на документы</h3>
            {links.map((link, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                <Input
                  aria-label={`Название ссылки ${i + 1}`}
                  placeholder="Название документа"
                  value={link.label}
                  maxLength={120}
                  onChange={(e) =>
                    setLinks((old) =>
                      old.map((v, n) =>
                        n === i ? { ...v, label: e.target.value } : v,
                      ),
                    )
                  }
                />
                <Input
                  aria-label={`Адрес ссылки ${i + 1}`}
                  type="url"
                  placeholder="https://…"
                  value={link.url}
                  onChange={(e) =>
                    setLinks((old) =>
                      old.map((v, n) =>
                        n === i ? { ...v, url: e.target.value } : v,
                      ),
                    )
                  }
                />
                {!readonly && (
                  <Button
                    variant="ghost"
                    aria-label={`Убрать ссылку ${i + 1}`}
                    onClick={() =>
                      setLinks((old) => old.filter((_, n) => n !== i))
                    }
                  >
                    ×
                  </Button>
                )}
              </div>
            ))}
            {!readonly && (
              <Button
                variant="secondary"
                size="sm"
                disabled={links.length >= 10}
                onClick={() =>
                  setLinks((old) => [...old, { label: "", url: "" }])
                }
              >
                Добавить ссылку
              </Button>
            )}
          </section>
        </fieldset>
        {links
          .filter((l) => /^https?:\/\//i.test(l.url))
          .map((link, i) => (
            <a
              key={i}
              className="block truncate text-sm text-accent underline"
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {link.label || link.url} ↗
            </a>
          ))}
        <CalendarAttachments
          files={attachments}
          onChange={setAttachments}
          disabled={readonly || busy}
          uploading={uploading}
          setUploading={setUploading}
          staged={staged}
        />
        {!readonly && (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              disabled={
                busy ||
                uploading ||
                !title.trim() ||
                (preferences.templates?.length || 0) >= 20 ||
                allDay
              }
              onClick={() => void saveTemplate()}
            >
              Сохранить как шаблон
            </Button>
            <span className="text-xs text-muted">
              Тема, повестка, место и длительность. Участники и файлы выбираются
              отдельно.
            </span>
            {templateMessage && (
              <p role="status" className="text-sm">
                {templateMessage}
              </p>
            )}
          </div>
        )}
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
        {row?.can_respond && (
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
