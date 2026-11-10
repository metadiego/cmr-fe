"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { listChangeLog, undoChange, type ChangeLogEntry, type ChangeLogFilter } from "@/lib/api/change-log";
import { listPersonal } from "@/lib/api/personal";
import { ApiError } from "@/lib/api/types";
import { toastError } from "@/lib/api/errors";
import { canUndo, entryPatient, fieldChanges, valueText } from "@/lib/change-log/entry";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// The change log as a timeline (BE #529): when (center time, as the BE gives it), who, what, and each
// field «before → after», with «Deshacer» on entries not yet undone (change_log.undo only). Shared by the
// session side panel, the patient's day and the full screen. Undo answers 428 first: the client's shield
// asks and repeats with X-Confirm-Action (lib/api/confirm-action.ts).

const UNDO_ERRORS: Record<string, string> = {
  CHANGE_SUPERSEDED: "changeLog.error.superseded",
  CHANGE_ALREADY_UNDONE: "changeLog.error.alreadyUndone",
  CHANGE_NOT_UNDOABLE: "changeLog.error.notUndoable",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ChangeLogList({
  filter,
  showPatient = false,
  pageSize = 50,
  onUndone,
}: {
  filter: ChangeLogFilter | null;
  showPatient?: boolean;
  pageSize?: number;
  onUndone?: () => void;
}) {
  const t = useTranslations("changeLog");
  const tRoot = useTranslations();
  const { can } = useCan();
  const mayUndo = can("change_log.undo");
  const [rows, setRows] = React.useState<ChangeLogEntry[] | null>(null);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [failed, setFailed] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [staff, setStaff] = React.useState<Map<string, string>>(new Map());
  const key = JSON.stringify(filter);

  React.useEffect(() => {
    listPersonal({ limit: 200 }).then((r) => setStaff(new Map(r.items.map((p) => [p.id, p.name ?? ""])))).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!filter) return;
    let alive = true;
    listChangeLog({ ...filter, page, limit: pageSize })
      .then((r) => {
        if (!alive) return;
        setRows((prev) => (page === 1 ? r.items : [...(prev ?? []), ...r.items]));
        setTotal(r.pagination.total);
        setFailed(null);
      })
      .catch((e) => alive && setFailed(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, page, tick, pageSize]);

  const label = (ns: string, k: string) => (tRoot.has(`changeLog.${ns}.${k}`) ? tRoot(`changeLog.${ns}.${k}`) : k);
  const value = (field: string, v: unknown) =>
    field === "estado" && typeof v === "string"
      ? label("status", v)
      : valueText(v, (id) => staff.get(id) || (UUID.test(id) ? t("changedId") : undefined));

  async function undo(e: ChangeLogEntry) {
    setBusy(e.id);
    try {
      await undoChange(e.id, undefined, e.clinicId);
      toast.success(t("undone"));
      setPage(1);
      setTick((n) => n + 1);
      onUndone?.();
    } catch (err) {
      const k = err instanceof ApiError ? UNDO_ERRORS[err.code] : undefined;
      if (k) {
        const fields = Array.isArray(err instanceof ApiError ? err.data?.fields : null) ? (err as ApiError).data!.fields as string[] : [];
        toast.error(fields.length ? `${tRoot(k)} (${fields.map((f) => label("field", f)).join(", ")})` : tRoot(k));
      } else toastError(err, tRoot);
    } finally {
      setBusy(null);
    }
  }

  if (failed) return <p className="text-sm text-destructive">{t("loadError")} — {failed}</p>;
  if (!rows) return <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>;

  return (
    <div className="space-y-2">
      <ol className="space-y-2">
        {rows.map((e) => {
          const p = entryPatient(e);
          const changes = fieldChanges(e);
          return (
            <li key={e.id} className={"rounded-md border px-3 py-2 text-sm " + (e.undoneAt ? "opacity-60" : "")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{e.localTime}</span>
                  <Badge variant={e.action === "delete" ? "destructive" : "secondary"}>{label("action", e.action)}</Badge>
                  <span className="font-medium">{e.actorKind === "system" ? t("system") : (e.actorName ?? "—")}</span>
                  {showPatient && p.name && (
                    <span className="text-muted-foreground">
                      · {p.name}
                      {p.record ? ` #${p.record}` : ""}
                    </span>
                  )}
                  {e.clinicName && showPatient && <span className="text-xs text-muted-foreground">· {e.clinicName}</span>}
                </div>
                {canUndo(e, mayUndo) && (
                  <Button size="sm" variant="outline" disabled={busy === e.id} onClick={() => undo(e)}>
                    {busy === e.id ? t("undoing") : t("undo")}
                  </Button>
                )}
              </div>
              {changes.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs">
                  {changes.map((c) => (
                    <li key={c.field}>
                      <span className="text-muted-foreground">{label("field", c.field)}:</span> {value(c.field, c.before)} → <b>{value(c.field, c.after)}</b>
                    </li>
                  ))}
                </ul>
              )}
              {e.reason && <p className="mt-1 text-xs italic text-muted-foreground">{e.reason}</p>}
              {e.undoneAt && <p className="mt-1 text-xs text-muted-foreground">{t("undoneBy", { name: e.undoneByName ?? "—" })}</p>}
            </li>
          );
        })}
      </ol>
      {rows.length < total && (
        <div className="text-center">
          <Button size="sm" variant="ghost" onClick={() => setPage((n) => n + 1)}>{t("more", { n: total - rows.length })}</Button>
        </div>
      )}
    </div>
  );
}
