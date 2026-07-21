"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { listDevoluciones, anularDevolucion, type Devolucion } from "@/lib/api/facturas";
import type { Paginated } from "@/lib/api/types";
import { useResource } from "@/hooks/use-resource";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { useCan } from "@/hooks/use-can";
import { CentroPicker } from "@/components/facturacion/centro-picker";
import { toastError } from "@/lib/api/errors";
import { formatFechaSolo } from "@/lib/format/fecha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListToolbar } from "@/components/kit/list-toolbar";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ALL = "__all__";
const ESTADOS = ["activa", "anulada"];
const money = (v: unknown) => `$${Number(v ?? 0).toFixed(2)}`;

function EstadoBadge({ estado }: { estado: string }) {
  const t = useTranslations("devoluciones.estado");
  const tone = estado === "anulada" ? "bg-destructive/15 text-destructive" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  return <span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + tone}>{t.has(estado) ? t(estado) : estado || "—"}</span>;
}

// Lista de devoluciones UNIFORME para General y Consultas. Solo cambia el `contexto` (filtro del BE) y el
// enlace "Ver facturas". Reuso — sin lógica nueva. Handoff fe-facturacion-consultas-uniforme.
export function DevolucionesListView({ contexto }: { contexto: "general" | "consulta" }) {
  const esConsulta = contexto === "consulta";
  const t = useTranslations("devoluciones");
  const tRoot = useTranslations();
  const router = useRouter();
  const { can } = useCan();

  const [q, setQ] = React.useState("");
  const [estado, setEstado] = React.useState("");
  const [desde, setDesde] = React.useState("");
  const [hasta, setHasta] = React.useState("");

  const gate = useCentroGate();
  const { state, reload } = useResource<Paginated<Devolucion>>(
    () =>
      gate.centro
        ? listDevoluciones({ q, estado, desde, hasta, contexto }, gate.centro)
        : Promise.resolve({ items: [], pagination: { total: 0, page: 1, limit: 20 } }),
    [q, estado, desde, hasta, gate.centro, contexto],
  );
  const rows = state.kind === "ok" ? state.data.items : [];
  const facturasHref = esConsulta ? "/consultas" : "/facturacion";
  const detalleHref = (fid: string) => `/facturacion/${fid}${gate.centro ? `?centro=${gate.centro}` : ""}`;

  const [anular, setAnular] = React.useState<Devolucion | null>(null);
  const [motivo, setMotivo] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function confirmarAnular() {
    if (!anular || !motivo.trim() || busy) return;
    setBusy(true);
    try {
      await anularDevolucion(anular.facturaId, anular.id, motivo.trim(), gate.centro);
      toast.success(t("anuladaOk"));
      setAnular(null);
      setMotivo("");
      reload();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{esConsulta ? t("titleConsulta") : t("title")}</h1>
        <Button variant="outline" size="sm" asChild><Link href={facturasHref}>{t("verFacturas")}</Link></Button>
      </div>

      {gate.cargando ? (
        <p className="mt-8 text-sm text-muted-foreground">{tRoot("common.loading")}</p>
      ) : gate.sinCentro ? (
        <p className="mt-8 text-sm text-muted-foreground">{tRoot("facturacion.general.sinCentro")}</p>
      ) : gate.necesitaPicker ? (
        <div className="mt-8 max-w-xl"><CentroPicker centros={gate.centros} onPick={gate.pick} /></div>
      ) : (
        <div className="mt-6 space-y-4">
          {gate.puedeCambiar && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">{tRoot("facturacion.general.centroLabel")} <span className="font-medium text-foreground">{gate.centroNombre}</span></span>
              <button type="button" onClick={gate.cambiarCentro} className="text-xs font-medium text-primary hover:underline">{tRoot("facturacion.general.cambiarCentro")}</button>
            </div>
          )}

          <ListToolbar search={q} onSearchChange={setQ} searchPlaceholder={t("searchPlaceholder")}>
            <Select value={estado || ALL} onValueChange={(v) => setEstado(v === ALL ? "" : v)}>
              <SelectTrigger size="sm" className="w-[160px]"><SelectValue placeholder={t("allStates")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("allStates")}</SelectItem>
                {ESTADOS.map((e) => <SelectItem key={e} value={e}>{t(`estado.${e}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label={t("from")} className="h-8 w-[150px]" />
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label={t("to")} className="h-8 w-[150px]" />
          </ListToolbar>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">{t("col.devolucion")}</th>
                  <th className="px-3 py-2 font-semibold">{t("col.fecha")}</th>
                  <th className="px-3 py-2 font-semibold">{t("col.tipo")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("col.monto")}</th>
                  <th className="px-3 py-2 font-semibold">{t("col.estado")}</th>
                  <th className="px-3 py-2 font-semibold">{t("col.motivo")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("col.acciones")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {state.kind === "loading" && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">{tRoot("common.loading")}</td></tr>}
                {state.kind === "fail" && <tr><td colSpan={7} className="px-3 py-8 text-center text-destructive">{tRoot("common.error")}</td></tr>}
                {state.kind === "ok" && rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">{t("empty")}</td></tr>}
                {rows.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <span className="block font-mono font-medium tabular-nums">{d.numeroDisplay ?? "—"}</span>
                      {d.facturaNumero && (
                        <span className="block text-xs text-muted-foreground">{t("fromInvoice", { n: d.facturaNumero })}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{formatFechaSolo(d.fecha ?? d.createdAt) || "—"}</td>
                    <td className="px-3 py-2">{t.has(`tipo.${d.tipo}`) ? t(`tipo.${d.tipo}`) : d.tipo}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{money(d.montoDevuelto)}</td>
                    <td className="px-3 py-2"><EstadoBadge estado={String(d.estado ?? "")} /></td>
                    <td className="px-3 py-2 max-w-[16rem] truncate text-muted-foreground" title={d.motivo ?? ""}>{d.motivo ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8" aria-label={t("col.acciones")}>
                              <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => router.push(`/facturacion/${d.facturaId}/devoluciones/${d.id}/recibo${gate.centro ? `?centro=${gate.centro}` : ""}`)}>{t("imprimir")}</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => router.push(detalleHref(d.facturaId))}>{t("verFactura")}</DropdownMenuItem>
                            {d.estado === "activa" && can("factura.devolver") && (
                              <DropdownMenuItem variant="destructive" onSelect={(e) => { e.preventDefault(); setAnular(d); }}>{t("anular")}</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AlertDialog open={!!anular} onOpenChange={(o) => !o && setAnular(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("anularTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("anularBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t("anularReason")} autoFocus />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{tRoot("common.cancel")}</AlertDialogCancel>
            <Button variant="destructive" disabled={!motivo.trim() || busy} onClick={confirmarAnular}>{t("anular")}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
