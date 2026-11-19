"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { dismissEventAbsence, linkEventAbsence, listAbsenceReview, type ReviewRow } from "@/lib/api/calendar-absences";
import { toastError } from "@/lib/api/errors";
import { acceptBody, acceptableAll, dayPart } from "@/lib/calendario/absence";
import { parseDayUTC } from "@/lib/format/fecha";
import { useCan } from "@/hooks/use-can";
import { useClinicFilter } from "@/hooks/use-clinic-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer, PageHeader } from "@/components/ui/page";

// «Ausencias por revisar» (BE #558): calendar events that read like a vacation or leave and are neither
// linked nor dismissed. Per row: Aceptar (the person is out of available staff) or «No es ausencia»;
// among namesakes, pick the person first. «Aceptar todas las de confianza alta». A resolved row leaves.
const todayPR = () => new Date(Date.now() - 4 * 3_600_000).toISOString().slice(0, 10);

export function AbsenceReview() {
  const t = useTranslations("calendar.absence");
  const tRoot = useTranslations();
  const format = useFormatter();
  const { can, ready } = useCan();
  const filter = useClinicFilter("calendario.absences");
  const [desde, setDesde] = React.useState(todayPR());
  const [rows, setRows] = React.useState<ReviewRow[] | null>(null);
  const [picked, setPicked] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (filter.loading) return;
    let alive = true;
    listAbsenceReview(desde, undefined, filter.choice)
      .then((r) => alive && setRows(r))
      .catch((e) => alive && (setRows([]), toastError(e, tRoot)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, filter.choiceKey, filter.loading]);

  const day = (iso?: string | null) => {
    const d = iso ? parseDayUTC(iso) : null;
    return d ? format.dateTime(d, "dayWeekdayShort") : (iso ?? "—");
  };
  const gone = (id: string) => setRows((rs) => (rs ?? []).filter((r) => r.id !== id));

  async function accept(r: ReviewRow, quiet = false): Promise<boolean> {
    const body = r.suggestion ? acceptBody(r.suggestion, picked[r.id] || null) : null;
    if (!body) return false;
    setBusy(r.id);
    try {
      await linkEventAbsence(r.id, body, r.clinicId);
      gone(r.id);
      if (!quiet) toast.success(t("accepted"));
      return true;
    } catch (e) {
      toastError(e, tRoot);
      return false;
    } finally {
      setBusy(null);
    }
  }
  async function dismiss(r: ReviewRow) {
    setBusy(r.id);
    try {
      await dismissEventAbsence(r.id, r.clinicId);
      gone(r.id);
      toast.success(t("dismissed"));
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setBusy(null);
    }
  }
  async function acceptAllHigh() {
    let n = 0;
    for (const r of acceptableAll(rows ?? [])) if (await accept(r, true)) n++;
    toast.success(t("acceptedMany", { n }));
  }

  if (ready && !can("calendario.absences")) return <PageContainer className="text-center text-sm text-muted-foreground">{t("noPermission")}</PageContainer>;
  const high = acceptableAll(rows ?? []).length;

  return (
    <PageContainer className="w-full px-6">
      <PageHeader
        title={tRoot("nav.calendarAbsenceReview")}
        description={t("reviewHint")}
        count={rows ? t("count", { n: rows.length }) : undefined}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t("since")}</span>
            <DatePicker value={desde} onChange={(v) => v && setDesde(v)} className="h-8 w-[150px]" />
            <Button size="sm" disabled={!high || !!busy} onClick={acceptAllHigh}>{t("acceptAllHigh", { n: high })}</Button>
          </div>
        }
      />
      {!rows ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("reviewEmpty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                <th className="px-3 py-2 font-semibold">{t("col.date")}</th>
                <th className="px-3 py-2 font-semibold">{t("col.title")}</th>
                <th className="px-3 py-2 font-semibold">{t("col.person")}</th>
                <th className="px-3 py-2 font-semibold">{t("col.kind")}</th>
                <th className="px-3 py-2 font-semibold">{t("col.hours")}</th>
                <th className="px-3 py-2 font-semibold">{t("col.confidence")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const s = r.suggestion;
                const p = s ? dayPart(s) : null;
                const needsPick = !!s && !s.staffId && s.candidates.length > 1;
                const body = s ? acceptBody(s, picked[r.id] || null) : null;
                return (
                  <tr key={r.id} className="align-top hover:bg-muted/30">
                    <td className="whitespace-nowrap px-3 py-2">
                      {day(r.day)}
                      {r.endDay && r.endDay !== r.day ? ` – ${day(r.endDay)}` : ""}
                      {r.clinicName && <div className="text-xs text-muted-foreground">{r.clinicName}</div>}
                    </td>
                    <td className="px-3 py-2 font-medium">{r.title}</td>
                    <td className="px-3 py-2">
                      {needsPick ? (
                        <select
                          value={picked[r.id] ?? ""}
                          onChange={(e) => setPicked((m) => ({ ...m, [r.id]: e.target.value }))}
                          className="h-8 rounded border bg-background px-1 text-sm"
                          aria-label={t("pick")}
                        >
                          <option value="">{t("pick")}</option>
                          {s!.candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      ) : (
                        (s?.staffName ?? <span className="text-muted-foreground">—</span>)
                      )}
                    </td>
                    <td className="px-3 py-2">{s ? (s.kind === "vacation" ? t("vacation") : t("leave")) : "—"}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {!p || p.kind === "whole" ? t("wholeDay") : p.kind === "until" ? t("until", { time: p.until! }) : p.kind === "from" ? t("from", { time: p.from! }) : t("between", { from: p.from!, until: p.until! })}
                    </td>
                    <td className="px-3 py-2">
                      {s && <Badge variant={s.confidence === "high" ? "secondary" : "warning"}>{s.confidence === "high" ? t("high") : t("low")}</Badge>}
                      {s?.reasonKey && <div className="mt-1 text-xs text-muted-foreground">{tRoot.has(s.reasonKey) ? tRoot(s.reasonKey) : s.reasonKey}</div>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <Button size="sm" disabled={!body || busy === r.id} onClick={() => accept(r)}>{t("accept")}</Button>
                      <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => dismiss(r)}>{t("notAbsence")}</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
