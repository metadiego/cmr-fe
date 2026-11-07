"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";

import { listUnlinkedMeasurements } from "@/lib/api/body-measurements";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { parseDayUTC } from "@/lib/format/fecha";
import { valueEntries, type UnlinkedReading } from "@/lib/body-measurements/unlinked";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DatePicker } from "@/components/ui/date-picker";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { LinkVisitDialog } from "@/components/body-measurements/link-visit-dialog";

// «Medidas sin vincular» (BE #509): scale / tape readings that found no GLP-1 visit on their own —
// a wrong record, or a patient never put on the frontdesk. The BE retries the automatic link before
// listing, so what shows here really needs a person. Every readable center at once.
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

export function UnlinkedMeasurements() {
  const t = useTranslations("bodyMeasurements");
  const format = useFormatter();
  const { can } = useCan();
  const [from, setFrom] = React.useState(daysAgo(14));
  const [linking, setLinking] = React.useState<UnlinkedReading | null>(null);
  const { state, reload } = useResource(() => listUnlinkedMeasurements({ from }), [from]);
  const canWrite = can("body_measurements.write");

  const dayOf = (iso: string) => {
    const d = parseDayUTC(iso);
    return d ? format.dateTime(d, "dayShort") : iso;
  };
  const label = (k: string) => (t.has(`field.${k}`) ? t(`field.${k}`) : k);
  const rows = state.kind === "ok" ? state.data : [];

  return (
    <PageContainer className="w-full px-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        count={state.kind === "ok" ? t("count", { n: rows.length }) : undefined}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t("from")}</span>
            <DatePicker value={from} onChange={(v) => v && setFrom(v)} aria-label={t("from")} />
          </div>
        }
      />
      {state.kind === "fail" ? (
        <EmptyState title={t("loadError")} description={state.message} action={<Button variant="outline" onClick={reload}>{t("retry")}</Button>} />
      ) : state.kind === "loading" ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState title={t("empty")} description={t("emptyHint")} />
      ) : (
        <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                <th className="px-3 py-2 font-semibold">{t("col.date")}</th>
                <th className="px-3 py-2 font-semibold">{t("col.center")}</th>
                <th className="px-3 py-2 font-semibold">{t("col.kind")}</th>
                <th className="px-3 py-2 font-semibold">{t("col.patient")}</th>
                <th className="px-3 py-2 font-semibold">{t("col.values")}</th>
                <th className="px-3 py-2 font-semibold">{t("col.source")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={`${r.kind}:${r.id}`} className="align-top hover:bg-muted/30">
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{dayOf(r.date)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.clinicName ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant={r.kind === "scale" ? "secondary" : "outline"}>{t(`kind.${r.kind}`)}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    {r.patient ? (
                      <>
                        <div className="font-medium">{r.patient.name ?? "—"}</div>
                        {r.patient.record && <div className="text-xs text-muted-foreground">#{r.patient.record}</div>}
                      </>
                    ) : (
                      <span className="text-muted-foreground">{t("noPatient")}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {valueEntries(r).map(([k, v]) => (
                        <span key={k} className="whitespace-nowrap">
                          <span className="text-xs text-muted-foreground">{label(k)}</span>{" "}
                          <span className="font-mono tabular-nums">{format.number(v, { maximumFractionDigits: 2 })}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.source ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    {canWrite && (
                      <Button size="sm" onClick={() => setLinking(r)}>
                        {t("link")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {linking && (
        <LinkVisitDialog
          key={`${linking.kind}:${linking.id}`}
          reading={linking}
          onClose={() => setLinking(null)}
          onLinked={() => {
            setLinking(null);
            reload();
          }}
        />
      )}
    </PageContainer>
  );
}
