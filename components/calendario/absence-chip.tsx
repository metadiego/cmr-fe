"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  dismissEventAbsence,
  linkEventAbsence,
  type AbsenceSuggestion,
  type LinkedAbsence,
} from "@/lib/api/calendar-absences";
import { toastError } from "@/lib/api/errors";
import { acceptBody, dayPart } from "@/lib/calendario/absence";
import { parseDayUTC } from "@/lib/format/fecha";
import { cn } from "@/lib/utils";

// The absence chip under a calendar event (BE #558). Linked: «Ausencia · Irvin Santana · 12 nov · llega
// 11:00» with ✕. Suggested: «¿Ausencia de …?» with Aceptar / No es ausencia; among namesakes, pick one.
// Never blocks saving the event. Without calendario.absences the chip only informs.
export function AbsenceChip({
  eventId,
  centerId,
  absence,
  suggestion,
  canManage,
  onChanged,
}: {
  /** null = the event is not saved yet: the suggestion shows, accepting waits for the save. */
  eventId: string | null;
  centerId?: string | null;
  absence: LinkedAbsence | null | undefined;
  suggestion: AbsenceSuggestion | null | undefined;
  canManage: boolean;
  onChanged: (linked: LinkedAbsence | null) => void;
}) {
  const t = useTranslations("calendar.absence");
  const tRoot = useTranslations();
  const format = useFormatter();
  const [busy, setBusy] = React.useState(false);
  const [picked, setPicked] = React.useState("");
  const day = (iso: string) => {
    const d = parseDayUTC(iso);
    return d ? format.dateTime(d, "dayMonth") : iso;
  };
  const range = (a: { startDate: string; endDate: string }) => (a.endDate && a.endDate !== a.startDate ? `${day(a.startDate)} – ${day(a.endDate)}` : day(a.startDate));
  const part = (a: { startTime: string | null; endTime: string | null }) => {
    const p = dayPart(a);
    return p.kind === "until" ? t("until", { time: p.until! }) : p.kind === "from" ? t("from", { time: p.from! }) : p.kind === "between" ? t("between", { from: p.from!, until: p.until! }) : "";
  };
  const kind = (k: string) => (k === "vacation" ? t("vacation") : t("leave"));

  async function run(fn: () => Promise<LinkedAbsence | null>, ok: string) {
    setBusy(true);
    try {
      const linked = await fn();
      toast.success(ok);
      onChanged(linked);
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setBusy(false);
    }
  }

  if (absence) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-info/40 bg-info/10 px-2.5 py-1.5 text-xs">
        <span className="font-semibold">{t("linked")}</span>
        <span className="min-w-0 flex-1 truncate">
          {kind(absence.kind)} · {absence.staffName ?? "—"} · {range(absence)}
          {part(absence) ? ` · ${part(absence)}` : ""}
        </span>
        {canManage && eventId && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(async () => (await dismissEventAbsence(eventId, centerId), null), t("removed"))}
            className="shrink-0 rounded px-1 text-muted-foreground hover:text-destructive"
            aria-label={t("remove")}
          >
            ✕
          </button>
        )}
      </div>
    );
  }
  if (!suggestion) return null;

  const needsPick = !suggestion.staffId && suggestion.candidates.length > 1;
  const body = acceptBody(suggestion, picked || null);
  return (
    <div className={cn("space-y-1.5 rounded-md border border-dashed px-2.5 py-1.5 text-xs", suggestion.confidence === "high" ? "border-primary/40 bg-primary/5" : "border-warning/50 bg-warning/10")}>
      <div>
        {suggestion.staffName
          ? t("question", { name: suggestion.staffName, when: range(suggestion) })
          : t("questionNoName", { when: range(suggestion) })}
        {part(suggestion) ? ` · ${part(suggestion)}` : ""} · {kind(suggestion.kind)}
      </div>
      {suggestion.reasonKey && <div className="text-muted-foreground">{tRoot.has(suggestion.reasonKey) ? tRoot(suggestion.reasonKey) : suggestion.reasonKey}</div>}
      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          {needsPick && (
            <select value={picked} onChange={(e) => setPicked(e.target.value)} className="h-7 rounded border bg-background px-1 text-xs" aria-label={t("pick")}>
              <option value="">{t("pick")}</option>
              {suggestion.candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {eventId ? (
            <>
              <button
                type="button"
                disabled={busy || !body}
                onClick={() => body && run(async () => (await linkEventAbsence(eventId, body, centerId)).absence ?? null, t("accepted"))}
                className="rounded bg-primary px-2 py-0.5 font-medium text-primary-foreground disabled:opacity-50"
              >
                {t("accept")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(async () => (await dismissEventAbsence(eventId, centerId), null), t("dismissed"))}
                className="rounded px-2 py-0.5 text-muted-foreground hover:bg-muted"
              >
                {t("notAbsence")}
              </button>
            </>
          ) : (
            <span className="text-muted-foreground">{t("afterSave")}</span>
          )}
        </div>
      )}
    </div>
  );
}
