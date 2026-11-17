import { useEffect, useRef, useState } from "react";
import {
  FileText,
  FileSpreadsheet,
  FileArchive,
  Paperclip,
  X,
} from "lucide-react";
import { apiRequest, downloadFile, fetchMedia } from "@/shared/lib/httpClient";
import { Button } from "@/shared/ui/Button";

export type CalendarFile = {
  id: string;
  filename: string;
  size: number;
  media_type: string;
  sha256: string;
};
export const discardCalendarFile = (id: string) =>
  apiRequest<void>({
    section: "projects",
    path: `/calendar/files/${id}`,
    method: "DELETE",
  });

function FilePreview({ file }: { file: CalendarFile }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file.media_type.startsWith("image/")) return;
    const abort = new AbortController();
    let objectUrl = "";
    fetchMedia("projects", `/calendar/files/${file.id}`, abort.signal)
      .then((blob) => {
        if (!abort.signal.aborted) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch(() => {});
    return () => {
      abort.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id, file.media_type]);
  if (url)
    return <img src={url} alt="" className="h-10 w-10 rounded object-cover" />;
  const Icon = /xlsx?$/.test(file.filename)
    ? FileSpreadsheet
    : file.filename.endsWith(".zip")
      ? FileArchive
      : FileText;
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-surface text-accent">
      <Icon size={22} />
    </span>
  );
}

export function CalendarAttachments({
  files,
  onChange,
  disabled,
  uploading,
  setUploading,
  staged,
}: {
  files: CalendarFile[];
  onChange: (files: CalendarFile[]) => void;
  disabled: boolean;
  uploading: boolean;
  setUploading: (value: boolean) => void;
  staged: React.MutableRefObject<Set<string>>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<CalendarFile[]>([]);
  useEffect(() => {
    let active = true;
    if (!disabled)
      apiRequest<CalendarFile[]>({
        section: "projects",
        path: "/calendar/files/drafts",
      })
        .then((rows) => {
          if (active) setDrafts(rows);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [disabled]);
  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    const selected = Array.from(list);
    if (files.length + selected.length > 10) {
      setError("Не больше 10 файлов на запись");
      return;
    }
    if (selected.some((f) => f.size > 50 * 1024 * 1024 || !f.size)) {
      setError("Каждый файл должен быть от 1 байта до 50 МБ");
      return;
    }
    if (
      selected.some((f) => !/\.(pdf|docx?|xlsx?|jpe?g|png|zip)$/i.test(f.name))
    ) {
      setError("Поддерживаются PDF, DOC/DOCX, XLS/XLSX, JPG, PNG, ZIP");
      return;
    }
    setUploading(true);
    setError("");
    const next = [...files];
    try {
      for (const file of selected) {
        const body = new FormData();
        body.append("file", file);
        body.append("request_id", crypto.randomUUID());
        const saved = await apiRequest<CalendarFile>({
          section: "projects",
          path: "/calendar/files",
          method: "POST",
          form: body,
        });
        staged.current.add(saved.id);
        next.push(saved);
        onChange([...next]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <section
      aria-label="Вложения"
      className="space-y-3 rounded-xl border border-border bg-surface-muted p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">
          Прикрепить файлы{" "}
          <span className="text-sm text-muted">{files.length}/10</span>
        </h3>
        {!disabled && (
          <Button
            variant="secondary"
            disabled={uploading || files.length >= 10}
            onClick={() => input.current?.click()}
          >
            <Paperclip size={16} />
            {uploading ? "Загружаем…" : "Прикрепить файл"}
          </Button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
        onChange={(e) => void upload(e.target.files)}
      />
      <p className="text-xs text-muted">
        PDF, Word, Excel, JPG, PNG, ZIP · до 50 МБ каждый. Файлы доступны
        участникам записи после сохранения.
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {!disabled && drafts.some((d) => !files.some((f) => f.id === d.id)) && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">
            Файлы из незавершённых записей
          </summary>
          <ul className="mt-2 space-y-2">
            {drafts
              .filter((d) => !files.some((f) => f.id === d.id))
              .map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">{d.filename}</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={uploading || files.length >= 10}
                    onClick={() => {
                      staged.current.add(d.id);
                      onChange([...files, d]);
                      setDrafts((old) => old.filter((f) => f.id !== d.id));
                    }}
                  >
                    Прикрепить
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={uploading}
                    onClick={async () => {
                      try {
                        await discardCalendarFile(d.id);
                        setDrafts((old) => old.filter((f) => f.id !== d.id));
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Удалить файл
                  </Button>
                </li>
              ))}
          </ul>
        </details>
      )}
      <ul className="grid gap-2 sm:grid-cols-2">
        {files.map((file) => (
          <li
            key={file.id}
            className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-surface p-2"
          >
            <FilePreview file={file} />
            <button
              type="button"
              className="min-w-0 flex-1 text-left text-sm"
              onClick={() =>
                void downloadFile(
                  "projects",
                  `/calendar/files/${file.id}`,
                  file.filename,
                ).catch((e) => setError(e.message))
              }
            >
              <span
                className="block truncate text-accent"
                title={file.filename}
              >
                {file.filename}
              </span>
              <span className="text-xs text-muted">
                {file.filename.split(".").pop()?.toUpperCase()} ·{" "}
                {file.size < 1024
                  ? `${file.size} Б`
                  : file.size < 1024 * 1024
                    ? `${Math.ceil(file.size / 1024)} КБ`
                    : `${(file.size / 1024 / 1024).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} МБ`}
              </span>
            </button>
            {!disabled && (
              <button
                type="button"
                disabled={uploading}
                aria-label={`Убрать ${file.filename}`}
                className="p-2 text-muted hover:text-danger"
                onClick={async () => {
                  try {
                    if (staged.current.has(file.id)) {
                      await discardCalendarFile(file.id);
                      staged.current.delete(file.id);
                    }
                    onChange(files.filter((f) => f.id !== file.id));
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <X size={16} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
