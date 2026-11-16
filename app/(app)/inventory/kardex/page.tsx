"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { listProductos, type Producto } from "@/lib/api/inventario";
import {
  getKardexDia,
  getKardexDiario,
  getKardexResumen,
  type KardexDaily,
  type KardexDayMovement,
  type KardexSummary,
} from "@/lib/api/inventario-kardex";
import { useResource } from "@/hooks/use-resource";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// DAILY KARDEX of one product, in sealed units (vials): per day, one day's detail (Acciones) and the
// management summary of the period. Same pattern for every product; the BE decides which reason counts
// in each column. See cmr-be docs/specs/kardex-diario-de-inventario.md.

const n = (v: number | null | undefined, d = 0) =>
  v == null ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: 2 });

function primeroDelMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function KardexPage() {
  const t = useTranslations("inventarioKardex");
  const gate = useCentroGate();
  const centro = gate.centro || gate.centros[0]?.id || "";
  const tenant = centro || undefined;

  const [productoId, setProductoId] = React.useState("");
  const [desde, setDesde] = React.useState(primeroDelMes());
  const [hasta, setHasta] = React.useState(hoy());
  const [dia, setDia] = React.useState<string | null>(null);

  const productosRes = useResource<Producto[]>(() => (tenant ? listProductos({}) : Promise.resolve([])), [tenant]);
  const productos = (productosRes.state.kind === "ok" ? productosRes.state.data : [])
    .filter((p) => p.isInventoryItem !== false)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const listo = !!(tenant && productoId && desde && hasta);
  const diarioRes = useResource<KardexDaily | null>(
    () => (listo ? getKardexDiario({ productId: productoId, from: desde, to: hasta }, tenant) : Promise.resolve(null)),
    [productoId, desde, hasta, tenant],
  );
  const resumenRes = useResource<KardexSummary | null>(
    () => (listo ? getKardexResumen({ productId: productoId, from: desde, to: hasta }, tenant) : Promise.resolve(null)),
    [productoId, desde, hasta, tenant],
  );
  const detalleRes = useResource<KardexDayMovement[] | null>(
    () => (dia && productoId && tenant ? getKardexDia({ productId: productoId, date: dia }, tenant) : Promise.resolve(null)),
    [dia, productoId, tenant],
  );

  const diario = diarioRes.state.kind === "ok" ? diarioRes.state.data : null;
  const resumen = resumenRes.state.kind === "ok" ? resumenRes.state.data : null;
  const detalle = detalleRes.state.kind === "ok" ? detalleRes.state.data : null;
  const conProporcion = diario?.product.capacity != null;

  return (
    <PageContainer>
      <PageHeader title={t("titulo")} />

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-64 flex-col gap-1">
          <Label>{t("producto")}</Label>
          <Select value={productoId} onValueChange={setProductoId}>
            <SelectTrigger>
              <SelectValue placeholder={t("elegirProducto")} />
            </SelectTrigger>
            <SelectContent>
              {productos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} {p.sku ? `· ${p.sku}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="k-desde">{t("desde")}</Label>
          <DatePicker id="k-desde" value={desde} onChange={setDesde} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="k-hasta">{t("hasta")}</Label>
          <DatePicker id="k-hasta" value={hasta} onChange={setHasta} />
        </div>
      </div>

      {!productoId && <p className="text-sm text-muted-foreground">{t("elegirProducto")}</p>}
      {diarioRes.state.kind === "fail" && <p className="text-sm text-destructive">{diarioRes.state.message}</p>}

      {diario && (
        <Tabs defaultValue="diario">
          <TabsList>
            <TabsTrigger value="diario">{t("tabDiario")}</TabsTrigger>
            <TabsTrigger value="resumen">{t("tabResumen")}</TabsTrigger>
          </TabsList>

          <TabsContent value="diario">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("col.fecha")}</TableHead>
                  <TableHead className="text-right">{t("col.inicio")}</TableHead>
                  <TableHead className="text-right">{t("col.entradas")}</TableHead>
                  <TableHead className="text-right">{t("col.aplicadas")}</TableHead>
                  {conProporcion && <TableHead className="text-right">{t("col.proporcion")}</TableHead>}
                  <TableHead className="text-right">{t("col.ajustes")}</TableHead>
                  <TableHead className="text-right">{t("col.total")}</TableHead>
                  <TableHead className="text-right">{t("col.acciones")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diario.days.map((d) => (
                  <TableRow key={d.date}>
                    <TableCell className="tabular-nums">{d.date}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(d.opening)}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(d.inbound)}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(d.applied)}</TableCell>
                    {conProporcion && (
                      <TableCell className="text-right text-xs text-muted-foreground tabular-nums">{n(d.appliedProportion, 2)}</TableCell>
                    )}
                    <TableCell className="text-right tabular-nums">{n(d.adjustments)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{n(d.closing)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setDia(d.date)}>
                        {t("verDia")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="resumen">
            {resumen && (
              <Table className="max-w-3xl">
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">{t("res.inicial", { fecha: resumen.from })}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{n(resumen.opening)}</TableCell>
                  </TableRow>
                  {resumen.lines.map((l, i) => (
                    <TableRow key={`${l.date}-${i}`}>
                      <TableCell>
                        <div>
                          {l.kind === "inbound" ? t("res.entrada") : t("res.ajuste")} · {l.date} · {l.reason ?? "—"}
                        </div>
                        {l.notes && <div className="text-xs text-muted-foreground">{l.notes}</div>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{n(l.quantity)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell>
                      {t("res.aplicadas", { fecha: resumen.to })}
                      {resumen.appliedProportion != null && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({t("col.proporcion")}: {n(resumen.appliedProportion, 2)})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">−{n(resumen.applied)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-semibold">{t("res.final", { fecha: resumen.to })}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{n(resumen.closing)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={!!dia} onOpenChange={(o) => !o && setDia(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {t("detalleTitulo", { fecha: dia ?? "" })} {diario ? `· ${diario.product.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          {detalleRes.state.kind === "loading" && <p className="text-sm text-muted-foreground">…</p>}
          {detalle && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("det.paciente")}</TableHead>
                  <TableHead>{t("det.record")}</TableHead>
                  <TableHead>{t("det.motivo")}</TableHead>
                  <TableHead className="text-right">{t("det.cantidad")}</TableHead>
                  <TableHead>{t("det.sesion")}</TableHead>
                  <TableHead>{t("det.nota")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detalle.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.patient || "—"}</TableCell>
                    <TableCell className="tabular-nums">{m.record || "—"}</TableCell>
                    <TableCell>{m.reason ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {n(m.signedQuantity, 0)}
                      {m.openVial && <span className="ml-1 text-xs text-muted-foreground">{t("det.contenido")}</span>}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {m.sessionNumber != null && m.sessionsTotal != null ? `${m.sessionNumber}/${m.sessionsTotal}` : "—"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={m.notes ?? ""}>
                      {m.notes ?? ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
