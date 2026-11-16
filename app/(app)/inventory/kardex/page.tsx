"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";

import {
  getDailyKardex,
  getKardexDay,
  getKardexSummary,
  type KardexDaily,
  type KardexDayMovement,
  type KardexSummary,
} from "@/lib/api/inventory-kardex";
import { defaultKardexRange, readableDocument, sessionLabel, validRange } from "@/lib/inventory/kardex";
import { parseDayUTC, todayPR } from "@/lib/format/fecha";
import { useResource } from "@/hooks/use-resource";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { ProductoPicker } from "@/components/inventario/producto-picker";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// DAILY KARDEX of one product in one center, in sealed units (vials): a row per day, that day's detail
// («Ver día») and the management summary of the period. One pattern for every product; the BE decides
// which reason lands in which column (cmr-be docs/specs/kardex-diario-de-inventario.md, handoff
// docs/specs/kardex-diario-handoff.md). Print = the browser's (PDF included); the filters are no-print.

export default function DailyKardexPage() {
  const t = useTranslations("inventoryKardex");
  const format = useFormatter();
  const gate = useCentroGate();

  const [centerRaw, setCenterRaw] = React.useState("");
  const centerId = centerRaw || gate.centro || gate.centros[0]?.id || "";
  const centerName = gate.centros.find((c) => c.id === centerId)?.name ?? "";

  const initial = React.useMemo(() => defaultKardexRange(todayPR()), []);
  const [productId, setProductId] = React.useState("");
  const [from, setFrom] = React.useState(initial.from);
  const [to, setTo] = React.useState(initial.to);
  const [day, setDay] = React.useState<string | null>(null);

  const ready = !!(centerId && productId && validRange(from, to));
  const dailyRes = useResource<KardexDaily | null>(
    () => (ready ? getDailyKardex({ productId, from, to }, centerId) : Promise.resolve(null)),
    [productId, from, to, centerId],
  );
  const summaryRes = useResource<KardexSummary | null>(
    () => (ready ? getKardexSummary({ productId, from, to }, centerId) : Promise.resolve(null)),
    [productId, from, to, centerId],
  );
  const dayRes = useResource<KardexDayMovement[] | null>(
    () => (day && productId && centerId ? getKardexDay({ productId, date: day }, centerId) : Promise.resolve(null)),
    [day, productId, centerId],
  );

  const daily = dailyRes.state.kind === "ok" ? dailyRes.state.data : null;
  const summary = summaryRes.state.kind === "ok" ? summaryRes.state.data : null;
  const movements = dayRes.state.kind === "ok" ? dayRes.state.data : null;
  const withProportion = daily?.product.capacity != null;

  const num = (v: number | null | undefined, decimals = 0) =>
    v == null ? "—" : format.number(v, { minimumFractionDigits: decimals, maximumFractionDigits: 2 });
  const dayText = (d: string) => {
    const date = parseDayUTC(d);
    return date ? format.dateTime(date, "dayShort") : d;
  };
  // reason = movement_reasons.slug; a new reason is a DB row, so an unknown slug shows as-is.
  const reasonText = (r: string | null | undefined) => (!r ? "—" : t.has(`reason.${r}`) ? t(`reason.${r}`) : r);
  const totals = daily?.days.reduce(
    (a, d) => ({ inbound: a.inbound + d.inbound, applied: a.applied + d.applied, adjustments: a.adjustments + d.adjustments }),
    { inbound: 0, applied: 0, adjustments: 0 },
  );

  return (
    <PageContainer className="w-full">
      <PageHeader
        title={t("title")}
        description={daily ? `${daily.product.name}${daily.product.sku ? ` · ${daily.product.sku}` : ""} · ${centerName} · ${dayText(from)} – ${dayText(to)}` : t("subtitle")}
        actions={
          daily && (
            <Button variant="outline" size="sm" className="no-print" onClick={() => window.print()}>
              {t("print")}
            </Button>
          )
        }
      />

      <div className="no-print flex flex-wrap items-end gap-3">
        {gate.puedeCambiar && gate.centros.length > 1 && (
          <div className="flex flex-col gap-1">
            <Label>{t("center")}</Label>
            <Select value={centerId} onValueChange={(v) => { setCenterRaw(v); setDay(null); }}>
              <SelectTrigger className="h-9 w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                {gate.centros.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex min-w-72 flex-col gap-1">
          <Label>{t("product")}</Label>
          <ProductoPicker value={productId} onChange={(id) => { setProductId(id); setDay(null); }} placeholder={t("pickProduct")} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="kardex-from">{t("from")}</Label>
          <DatePicker id="kardex-from" value={from} onChange={setFrom} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="kardex-to">{t("to")}</Label>
          <DatePicker id="kardex-to" value={to} onChange={setTo} />
        </div>
      </div>

      {!productId && <p className="text-sm text-muted-foreground">{t("pickProduct")}</p>}
      {productId && !validRange(from, to) && <p className="text-sm text-destructive">{t("badRange")}</p>}
      {dailyRes.state.kind === "loading" && productId && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
      {dailyRes.state.kind === "fail" && <p className="text-sm text-destructive">{dailyRes.state.message}</p>}

      {daily && (
        <Tabs defaultValue="daily">
          <TabsList className="no-print">
            <TabsTrigger value="daily">{t("tabDaily")}</TabsTrigger>
            <TabsTrigger value="summary">{t("tabSummary")}</TabsTrigger>
          </TabsList>

          <TabsContent value="daily">
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("col.date")}</TableHead>
                    <TableHead className="text-right">{t("col.opening")}</TableHead>
                    <TableHead className="text-right">{t("col.inbound")}</TableHead>
                    <TableHead className="text-right">{t("col.applied")}</TableHead>
                    {withProportion && <TableHead className="text-right">{t("col.proportion")}</TableHead>}
                    <TableHead className="text-right">{t("col.adjustments")}</TableHead>
                    <TableHead className="text-right">{t("col.closing")}</TableHead>
                    <TableHead className="no-print text-right">{t("col.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {daily.days.map((d) => {
                    const quiet = !d.inbound && !d.applied && !d.adjustments;
                    return (
                      <TableRow key={d.date} className={quiet ? "text-muted-foreground" : undefined}>
                        <TableCell className="tabular-nums">{dayText(d.date)}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(d.opening)}</TableCell>
                        <TableCell className="text-right tabular-nums">{d.inbound ? num(d.inbound) : ""}</TableCell>
                        <TableCell className="text-right tabular-nums">{d.applied ? num(d.applied) : ""}</TableCell>
                        {withProportion && (
                          <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                            {d.appliedProportion ? num(d.appliedProportion, 2) : ""}
                          </TableCell>
                        )}
                        <TableCell className="text-right tabular-nums">{d.adjustments ? num(d.adjustments) : ""}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums text-foreground">{num(d.closing)}</TableCell>
                        <TableCell className="no-print py-1 text-right">
                          <Button size="sm" variant="ghost" disabled={quiet} onClick={() => setDay(d.date)}>
                            {t("viewDay")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                {totals && (
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-semibold">{t("periodTotal")}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(daily.days[0]?.opening)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{num(totals.inbound)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{num(totals.applied)}</TableCell>
                      {withProportion && <TableCell className="text-right text-xs tabular-nums">{num(summary?.appliedProportion, 2)}</TableCell>}
                      <TableCell className="text-right font-semibold tabular-nums">{num(totals.adjustments)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{num(daily.days.at(-1)?.closing)}</TableCell>
                      <TableCell className="no-print" />
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="summary">
            {summaryRes.state.kind === "fail" && <p className="text-sm text-destructive">{summaryRes.state.message}</p>}
            {summary && (
              <div className="max-w-4xl rounded-lg border">
                <Table>
                  <TableBody>
                    <TableRow className="bg-muted/40">
                      <TableCell className="font-semibold">{t("summary.opening", { date: dayText(summary.from) })}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{num(summary.opening)}</TableCell>
                    </TableRow>
                    {summary.lines.map((l, i) => {
                      const doc = l.documentNumber ?? readableDocument(l.documentId);
                      return (
                        <TableRow key={`${l.date}-${i}`}>
                          <TableCell>
                            <div>
                              <span className="font-medium">{l.kind === "inbound" ? t("summary.inbound") : t("summary.adjustment")}</span>
                              {" · "}
                              {dayText(l.date)}
                              {doc && <span className="ml-1 font-mono text-xs">#{doc}</span>}
                              {l.reason && <span className="text-muted-foreground"> · {reasonText(l.reason)}</span>}
                            </div>
                            {l.notes && <div className="text-xs text-muted-foreground">{l.notes}</div>}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {l.quantity > 0 ? "+" : ""}
                            {num(l.quantity)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow>
                      <TableCell>
                        {t("summary.applied", { date: dayText(summary.to) })}
                        {summary.appliedProportion != null && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({t("col.proportion")}: {num(summary.appliedProportion, 2)})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">−{num(summary.applied)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/40">
                      <TableCell className="font-semibold">{t("summary.closing", { date: dayText(summary.to) })}</TableCell>
                      <TableCell className="text-right text-base font-bold tabular-nums">{num(summary.closing)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={!!day} onOpenChange={(o) => !o && setDay(null)}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {t("dayTitle", { date: day ? dayText(day) : "" })}
              {daily ? ` · ${daily.product.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          {dayRes.state.kind === "loading" && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
          {dayRes.state.kind === "fail" && <p className="text-sm text-destructive">{dayRes.state.message}</p>}
          {movements && movements.length === 0 && <p className="text-sm text-muted-foreground">{t("noMovements")}</p>}
          {movements && movements.length > 0 && (
            <div className="max-h-[70vh] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("day.patient")}</TableHead>
                    <TableHead>{t("day.record")}</TableHead>
                    <TableHead>{t("day.reason")}</TableHead>
                    <TableHead className="text-right">{t("day.quantity")}</TableHead>
                    <TableHead>{t("day.session")}</TableHead>
                    <TableHead>{t("day.notes")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.patient?.name || "—"}</TableCell>
                      <TableCell className="tabular-nums">{m.medicalRecordNumber ?? m.patient?.medicalRecordNumber ?? "—"}</TableCell>
                      <TableCell>{reasonText(m.reason)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(m.signedQuantity, 0)}
                        {m.openVial && <span className="ml-1 text-xs text-muted-foreground">{t("day.content")}</span>}
                      </TableCell>
                      <TableCell className="tabular-nums">{sessionLabel(m.sessionNumber, m.sessionsTotal) ?? "—"}</TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={m.notes ?? ""}>
                        {m.notes ?? ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
