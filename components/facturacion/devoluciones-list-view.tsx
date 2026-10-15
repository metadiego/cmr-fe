"use client";

import * as React from "react";
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
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { DataTable, TableEmpty, TableError } from "@/components/ui/data-table";
import { TableRowsSkeleton, type CellShape } from "@/components/kit/skeletons";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
// devolución, fecha, tipo, monto, estado, motivo, acciones — one loading bar per column.
const LOADING_SHAPES: CellShape[] = ["short", "short", "text", "short", "badge", "long", "button"];

function EstadoBadge({ estado }: { estado: string }) {
  const t = useTranslations("devoluciones.estado");
  const variant = estado === "anulada" ? "destructive" : "success";
  return <Badge variant={variant}>{t.has(estado) ? t(estado) : estado || "—"}</Badge>;
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
  const { state, refresh } = useResource<Paginated<Devolucion>>(
    () =>
      gate.centro
        ? listDevoluciones({ q, status: estado, from: desde, to: hasta, context: contexto }, gate.centro)
        : Promise.resolve({ items: [], pagination: { total: 0, page: 1, limit: 20 } }),
    [q, estado, desde, hasta, gate.centro, contexto],
  );
  const rows = state.kind === "ok" ? state.data.items : [];
  // The centre gate resolving counts as loading too: until then the placeholder fetch reads as empty.
  const loading = gate.cargando || state.kind === "loading";
  const detalleHref = (fid: string) => `/billing/invoices/${fid}${gate.centro ? `?centro=${gate.centro}` : ""}`;

  const [anular, setAnular] = React.useState<Devolucion | null>(null);
  const [motivo, setMotivo] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function confirmarAnular() {
    if (!anular || !motivo.trim() || busy) return;
    setBusy(true);
    try {
      await anularDevolucion(anular.invoiceId, anular.id, motivo.trim(), gate.centro);
      toast.success(t("anuladaOk"));
      setAnular(null);
      setMotivo("");
      refresh();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader title={esConsulta ? t("titleConsulta") : t("title")} />

      {gate.sinCentro ? (
        <p className="text-sm text-muted-foreground">{tRoot("facturacion.general.sinCentro")}</p>
      ) : gate.necesitaPicker ? (
        <div className="max-w-xl"><CentroPicker centros={gate.centros} onPick={gate.pick} /></div>
      ) : (
        <>
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
            <DatePicker value={desde} onChange={setDesde} aria-label={t("from")} className="h-8 w-[150px]" clearable />
            <DatePicker value={hasta} onChange={setHasta} aria-label={t("to")} className="h-8 w-[150px]" clearable />
          </ListToolbar>

          <DataTable>
            <TableHeader>
              <TableRow>
                <TableHead>{t("col.devolucion")}</TableHead>
                <TableHead>{t("col.fecha")}</TableHead>
                <TableHead>{t("col.tipo")}</TableHead>
                <TableHead className="text-right">{t("col.monto")}</TableHead>
                <TableHead>{t("col.estado")}</TableHead>
                <TableHead>{t("col.motivo")}</TableHead>
                <TableHead className="text-right">{t("col.acciones")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRowsSkeleton columns={LOADING_SHAPES} />}
              {!loading && state.kind === "fail" && <TableError colSpan={7}>{tRoot("common.error")}</TableError>}
              {!loading && state.kind === "ok" && rows.length === 0 && <TableEmpty colSpan={7}>{t("empty")}</TableEmpty>}
              {!loading && rows.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <span className="block font-mono font-medium tabular-nums">{d.displayNumber ?? "—"}</span>
                    {d.invoiceNumber && (
                      <span className="block text-xs text-muted-foreground">{t("fromInvoice", { n: d.invoiceNumber })}</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatFechaSolo(d.date ?? d.createdAt) || "—"}</TableCell>
                  <TableCell>{t.has(`tipo.${d.type}`) ? t(`tipo.${d.type}`) : d.type}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{money(d.refundedAmount)}</TableCell>
                  <TableCell><EstadoBadge estado={String(d.status ?? "")} /></TableCell>
                  <TableCell className="max-w-[16rem] truncate text-muted-foreground" title={d.reason ?? ""}>{d.reason ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8" aria-label={t("col.acciones")}>
                            <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => router.push(`/billing/invoices/${d.invoiceId}/returns/${d.id}/receipt${gate.centro ? `?centro=${gate.centro}` : ""}`)}>{t("imprimir")}</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => router.push(detalleHref(d.invoiceId))}>{t("verFactura")}</DropdownMenuItem>
                          {d.status === "activa" && can("factura.devolver") && (
                            <DropdownMenuItem variant="destructive" onSelect={(e) => { e.preventDefault(); setAnular(d); }}>{t("anular")}</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        </>
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
    </PageContainer>
  );
}
