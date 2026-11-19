import { useEffect, useRef, useState } from "react";
import {
  CalendarPlus,
  UsersRound,
  CheckSquare,
  LockKeyhole,
  Cake,
  ChevronDown,
  Plus,
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
export function CalendarAdd({
  choose,
}: {
  choose: (category: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return (
    <div
      className="relative"
      ref={root}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setOpen(false);
          trigger.current?.focus();
        }
        if (e.key === "Tab") setOpen(false);
        if (open && ["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          const items = Array.from(
            root.current!.querySelectorAll<HTMLButtonElement>(
              "[role=menuitem]",
            ),
          );
          const index = items.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          items[
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? items.length - 1
                : (index + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
                  items.length
          ]?.focus();
        }
      }}
    >
      <Button
        ref={trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Plus size={17} />
        Добавить
        <ChevronDown size={15} />
      </Button>
      {open && (
        <div
          role="menu"
          aria-label="Добавить запись"
          className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-border bg-surface p-1.5 shadow-xl"
        >
          {(
            [
              ["meeting", "Встреча", CalendarPlus],
              ["briefing", "Планёрка", UsersRound],
              ["work", "Задача", CheckSquare],
              ["personal", "Личное", LockKeyhole],
              ["anniversary", "Юбилеи", Cake],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              role="menuitem"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-surface-muted focus:bg-surface-muted"
              onClick={() => {
                setOpen(false);
                choose(key);
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
