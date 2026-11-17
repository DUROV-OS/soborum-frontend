import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/auth/store";
import { apiRequest } from "@/shared/lib/httpClient";
type Reminder = {
  id: number;
  title: string;
  occurrence_start: string;
  occurrence_end: string;
  timezone: string;
  reminder_key: string;
};
export function CalendarReminders() {
  const userId = useAuthStore((s) => s.current?.id);
  const [items, setItems] = useState<Reminder[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => {
    let active = true,
      inFlight = false;
    setItems([]);
    setDismissed([]);
    const poll = async () => {
      if (!userId || inFlight || document.hidden) return;
      inFlight = true;
      try {
        const rows = await apiRequest<Reminder[]>({
          section: "projects",
          path: "/calendar/reminders",
        });
        if (active) setItems(rows);
      } catch {
        if (active) setItems([]);
      } finally {
        inFlight = false;
      }
    };
    void poll();
    const timer = window.setInterval(poll, 30000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [userId]);
  const visible = items.filter((e) => !dismissed.includes(e.reminder_key));
  if (!visible.length) return null;
  return (
    <aside
      aria-label="Напоминания календаря"
      aria-live="polite"
      className="mx-4 my-3 space-y-2 rounded-xl border border-brand/30 bg-surface p-3"
    >
      <p className="text-sm font-semibold">Ближайшие встречи</p>
      {visible.map((e) => (
        <div
          key={e.reminder_key}
          className="flex flex-wrap items-center justify-between gap-2 text-sm"
        >
          <Link
            className="text-brand underline"
            to={`/calendar?section=mine&event=${e.id}&date=${encodeURIComponent(e.occurrence_start)}`}
          >
            {e.title} ·{" "}
            {new Date(e.occurrence_start).toLocaleString("ru-RU", {
              timeZone: e.timezone,
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            ({e.timezone})
          </Link>
          <button
            type="button"
            className="rounded px-2 py-1 hover:bg-surface-muted"
            aria-label={`Скрыть напоминание: ${e.title}`}
            onClick={() =>
              setDismissed((old) => [...old.slice(-199), e.reminder_key])
            }
          >
            Понятно
          </button>
        </div>
      ))}
    </aside>
  );
}
