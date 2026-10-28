"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowRight01Icon, Clock01Icon, RefreshIcon } from "@hugeicons/core-free-icons";

import { getLiveStock, type LivePad, type LiveProduct, type LiveStock } from "@/lib/api/scale-live-stock";
import { groupPadsByDevice, isStale, latestReading, matchesQuery } from "@/lib/inventory/live-stock";
import { useResource } from "@/hooks/use-resource";
import { useCentroPantalla } from "@/hooks/use-centro-pantalla";
import { useCan } from "@/hooks/use-can";
import { cn } from "@/lib/utils";
import { CentroPantallaSelector } from "@/components/centro-pantalla-selector";
import { RetireScaleButton } from "@/components/inventario/retire-scale-button";
import { LiveStockHistorySheet, type HistoryTarget } from "@/components/inventario/live-stock-history-sheet";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// The scales send events when a pad changes, so a poll every minute is enough (handoff).
const POLL_MS = 60_000;

// Inventario → Stock live (balanzas): what the scales count on each pad, next to book stock. Never a
// difference — book stock includes the displays outside the warehouse. Handoff stock-live-balanzas.md.
export function LiveStockView() {
  const t = useTranslations("liveStock");
  const format = useFormatter();
  const estado = useCentroPantalla("inventario.read", "inventario.ajustar");
  const centroId = estado.centroActivo || undefined;
  const [warehouseId, setWarehouseId] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [history, setHistory] = React.useState<HistoryTarget | null>(null);
  const [now, setNow] = React.useState(() => Date.now());
  const { can } = useCan();
  const canRetire = estado.puedeEscribir && can("inventario.ajustar");

  const { state, reload, refresh: poll } = useResource<LiveStock>(
    () => (centroId ? getLiveStock({ centroId }) : Promise.resolve({ generatedAt: "", warehouses: [] })),
    [centroId],
  );

  React.useEffect(() => {
    // Silent refresh: the data stays on screen while the next poll is in flight.
    const id = setInterval(() => {
      poll();
      setNow(Date.now());
    }, POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  const refresh = () => {
    reload();
    setNow(Date.now());
  };

  const warehouses = state.kind === "ok" ? state.data.warehouses : [];
  // The selection survives a center switch only if that warehouse is still there.
  const wh = warehouses.find((w) => w.warehouseId === warehouseId) ?? warehouses[0];
  const products = (wh?.products ?? []).filter((p) => matchesQuery(p, query));
  const pads = (wh?.pads ?? []).filter((p) => matchesQuery(p, query));
  const generatedAt = state.kind === "ok" && state.data.generatedAt ? new Date(state.data.generatedAt) : null;

  return (
    <PageContainer className="w-full">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
            <CentroPantallaSelector estado={estado} />
            {warehouses.length > 1 && (
              <Select value={wh?.warehouseId ?? ""} onValueChange={setWarehouseId}>
                <SelectTrigger className="w-56" aria-label={t("warehouse")}>
                  <SelectValue placeholder={t("warehouse")} />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.warehouseId} value={w.warehouseId}>
                      {w.warehouseName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {generatedAt && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground" title={format.dateTime(generatedAt, "dateAndTime")}>
                <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
                {t("updated", { when: format.relativeTime(generatedAt, Math.max(now, generatedAt.getTime())) })}
              </span>
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={refresh} disabled={state.kind === "loading"}>
              <HugeiconsIcon icon={RefreshIcon} className="size-4" />
              {t("refresh")}
            </Button>
          </>
        }
      />

      {state.kind === "loading" && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}

      {state.kind === "fail" && (
        <div className="flex flex-col items-center gap-3 rounded-lg bg-card px-4 py-10 text-center ring-1 ring-foreground/10">
          <p className="text-sm text-destructive">{state.message}</p>
          <Button variant="outline" size="sm" onClick={refresh}>
            {t("retry")}
          </Button>
        </div>
      )}

      {state.kind === "ok" && !wh && (
        <div className="rounded-lg bg-card px-4 py-12 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          {t("empty")}
        </div>
      )}

      {state.kind === "ok" && wh && (
        <Tabs defaultValue="products" className="gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <TabsList>
              <TabsTrigger value="products">{t("byProduct")}</TabsTrigger>
              <TabsTrigger value="pads">{t("byScale")}</TabsTrigger>
            </TabsList>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchPh")} className="w-64" />
            <p className="ml-auto text-xs text-muted-foreground">{t("bookNote")}</p>
          </div>
          <TabsContent value="products">
            <ProductsTable products={products} now={now} onHistory={(p) => setHistory({ kind: "product", ...p })} />
          </TabsContent>
          <TabsContent value="pads">
            <PadsBoard
              pads={pads}
              now={now}
              onHistory={(p) => setHistory({ kind: "pad", ...p })}
              renderRetire={canRetire ? (deviceId) => <RetireScaleButton deviceId={deviceId} centroId={centroId} onDone={refresh} /> : undefined}
            />
          </TabsContent>
        </Tabs>
      )}

      {history && wh && (
        <LiveStockHistorySheet target={history} centroId={centroId} warehouseId={wh.warehouseId} onClose={() => setHistory(null)} />
      )}
    </PageContainer>
  );
}

function DoubtfulChip() {
  const t = useTranslations("liveStock");
  return (
    <Badge variant="outline" className="border-warning-foreground/30 bg-warning text-warning-foreground">
      {t("doubtful")}
    </Badge>
  );
}

function ProductsTable({
  products,
  now,
  onHistory,
}: {
  products: LiveProduct[];
  now: number;
  onHistory: (p: { supplierPresentationId: string; title: string }) => void;
}) {
  const t = useTranslations("liveStock");
  const format = useFormatter();
  const [open, setOpen] = React.useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="overflow-x-auto rounded-lg bg-card ring-1 ring-foreground/10">
      <table className="w-full text-sm">
        <thead className="bg-muted/30">
          <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="w-8 px-2 py-2" />
            <th className="px-3 py-2 font-semibold">{t("col.sku")}</th>
            <th className="px-3 py-2 font-semibold">{t("col.product")}</th>
            <th className="px-3 py-2 text-right font-semibold">{t("col.live")}</th>
            <th className="px-3 py-2 text-right font-semibold">{t("col.book")}</th>
            <th className="px-3 py-2 text-right font-semibold">{t("col.scales")}</th>
            <th className="px-3 py-2 font-semibold">{t("col.lastReading")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {products.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                {t("noMatches")}
              </td>
            </tr>
          )}
          {products.map((p) => {
            const last = latestReading(p.byPad);
            const expanded = open.has(p.productId);
            return (
              <React.Fragment key={p.productId}>
                <tr className="cursor-pointer hover:bg-muted/20" onClick={() => toggle(p.productId)}>
                  <td className="px-2 py-2 text-muted-foreground">
                    <HugeiconsIcon icon={expanded ? ArrowDown01Icon : ArrowRight01Icon} className="size-4" />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{p.sku ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{p.productName ?? "—"}</span>
                    {p.doubtful && <span className="ml-2"><DoubtfulChip /></span>}
                  </td>
                  <td className="px-3 py-2 text-right text-base font-semibold tabular-nums">{p.liveUnits}</td>
                  {/* A negative book figure is real accounting data: shown as-is, flagged, never clamped. */}
                  <td
                    className={cn(
                      "px-3 py-2 text-right tabular-nums",
                      p.bookUnits != null && p.bookUnits < 0 ? "font-semibold text-destructive" : "text-muted-foreground",
                    )}
                    title={p.bookUnits != null && p.bookUnits < 0 ? t("negativeBook") : undefined}
                  >
                    {p.bookUnits ?? "—"}
                    {p.bookUnit && <span className="ml-1 text-xs">{p.bookUnit}</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.byPad.length}</td>
                  <td className={cn("px-3 py-2 whitespace-nowrap tabular-nums", last && isStale(last, now) && "text-muted-foreground/60")}>
                    {last ? format.dateTime(new Date(last), "dateAndTime") : "—"}
                  </td>
                </tr>
                {expanded &&
                  p.byPad.map((b) => (
                    <tr key={`${b.deviceId}-${b.pad}`} className={cn("bg-muted/10 text-xs", isStale(b.measuredAt, now) && "opacity-60")}>
                      <td />
                      <td className="px-3 py-1.5 font-mono">{b.deviceId}</td>
                      <td className="px-3 py-1.5">
                        <span className="mr-2 text-muted-foreground">{t("padN", { n: b.pad })}</span>
                        {b.presentationName ?? "—"}
                        {b.doubtful && <span className="ml-2"><DoubtfulChip /></span>}
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{b.units}</td>
                      <td />
                      <td className="px-3 py-1.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onHistory({ supplierPresentationId: b.supplierPresentationId, title: b.presentationName ?? p.productName ?? "" });
                          }}
                        >
                          {t("history")}
                        </Button>
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">{format.dateTime(new Date(b.measuredAt), "dateAndTime")}</td>
                    </tr>
                  ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PadsBoard({
  pads,
  now,
  onHistory,
  renderRetire,
}: {
  pads: LivePad[];
  now: number;
  onHistory: (p: { deviceId: string; pad: number; title: string }) => void;
  // Only for users who can adjust inventory in this center.
  renderRetire?: (deviceId: string) => React.ReactNode;
}) {
  const t = useTranslations("liveStock");
  const format = useFormatter();
  const groups = groupPadsByDevice(pads);
  if (groups.length === 0) {
    return <p className="rounded-lg bg-card px-4 py-8 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">{t("noMatches")}</p>;
  }
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.deviceId} className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="font-mono text-sm font-semibold">{g.deviceId}</h3>
            {renderRetire?.(g.deviceId)}
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
            {g.pads.map((p) => {
              const stale = isStale(p.measuredAt, now);
              return (
                <button
                  key={p.pad}
                  type="button"
                  onClick={() => onHistory({ deviceId: p.deviceId, pad: p.pad, title: `${p.deviceId} · ${t("padN", { n: p.pad })}` })}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg bg-card p-3 text-left ring-1 ring-foreground/10 transition hover:ring-primary/40",
                    stale && "opacity-60",
                  )}
                  title={t("history")}
                >
                  <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    {t("padN", { n: p.pad })}
                    {p.doubtful && <DoubtfulChip />}
                  </span>
                  <span className="truncate text-sm font-medium">{p.productName ?? p.presentationName ?? "—"}</span>
                  {p.units === 0 ? (
                    <span className="text-2xl font-semibold text-muted-foreground">{t("emptyPad")}</span>
                  ) : (
                    <span className="text-3xl font-bold tabular-nums">{p.units}</span>
                  )}
                  <span className={cn("text-xs tabular-nums text-muted-foreground", stale && "italic")}>
                    {format.dateTime(new Date(p.measuredAt), "dateAndTime")}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
