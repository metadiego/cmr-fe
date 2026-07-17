"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";

import {
  anularFactura,
  devolverFactura,
  getFactura,
  getFormasPago,
  getPoliticaDevolucion,
  getPrecioBase,
  type FacturaConItems,
  type FacturaItem,
  type FormaPago,
  type DevolverPayload,
  type PoliticaDevolucion,
} from "@/lib/api/facturas";
import { toastError } from "@/lib/api/errors";
import { toast } from "sonner";
import { useCan } from "@/hooks/use-can";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const n = (v: unknown) => Number(v ?? 0);
const money = (v: unknown) => `$${n(v).toFixed(2)}`;

// Acciones por factura (handoff fe-devoluciones-lista-y-acciones, slices A–D).
//  Ver/Imprimir → detalle · Editar → detalle (borrador) · Anular → /anular (motivo) ·
//  Devolución → modal (política + cantidad/sesiones + precio editable + neto) → /devolver.
//  Guía de timing: GET /politica-devolucion resalta Anular (mismo día) vs Devolver.
//  (Email = pendiente BE: sin endpoint de email de factura. Componentes de kit = pendiente BE:
//   item.contenido[] no expone facturaItemComponenteId.)
export function FacturaRowActions({
  facturaId,
  estado,
  centroId,
  onChanged,
}: {
  facturaId: string;
  estado: string;
  centroId?: string;
  onChanged?: () => void;
}) {
  const t = useTranslations("facturacionList.actions");
  const tRoot = useTranslations();
  const router = useRouter();
  const { can } = useCan();

  const [anularOpen, setAnularOpen] = React.useState(false);
  const [devolverOpen, setDevolverOpen] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [pol, setPol] = React.useState<PoliticaDevolucion | null>(null);

  const esBorrador = estado === "borrador";
  const esEmitida = estado === "emitida";
  const puedeAnular = esEmitida && can("factura.anular");
  const puedeDevolver = (esEmitida || estado === "devuelta_parcial") && can("factura.devolver");
  const sugerido = pol?.accionSugerida; // "anular" | "devolver"

  const href = centroId ? `/facturacion/${facturaId}?centro=${centroId}` : `/facturacion/${facturaId}`;

  // Guía de timing: al abrir el menú (una vez), pedir la política si aplica.
  function onOpenChange(open: boolean) {
    if (open && !pol && (puedeAnular || puedeDevolver)) {
      getPoliticaDevolucion(facturaId, centroId).then(setPol).catch(() => {});
    }
  }

  async function anular() {
    if (!motivo.trim() || busy) return;
    setBusy(true);
    try {
      await anularFactura(facturaId, motivo.trim(), centroId);
      setAnularOpen(false);
      setMotivo("");
      onChanged?.();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  const sug = (accion: "anular" | "devolver", label: string) =>
    sugerido === accion ? `${label} · ${t("suggested")}` : label;

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label={t("menu")}>
            <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => router.push(href)}>{t("view")}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push(href)}>{t("print")}</DropdownMenuItem>
          {esBorrador && <DropdownMenuItem onSelect={() => router.push(href)}>{t("edit")}</DropdownMenuItem>}
          {puedeDevolver && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setDevolverOpen(true); }}>
                {sug("devolver", t("return"))}
              </DropdownMenuItem>
            </>
          )}
          {puedeAnular && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={(e) => { e.preventDefault(); setAnularOpen(true); }}>
                {sug("anular", t("void"))}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={anularOpen} onOpenChange={setAnularOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("voidTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("voidBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t("voidReason")} aria-label={t("voidReason")} autoFocus />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{tRoot("common.cancel")}</AlertDialogCancel>
            <Button variant="destructive" disabled={!motivo.trim() || busy} onClick={anular}>{t("void")}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {devolverOpen && (
        <DevolverDialog
          facturaId={facturaId}
          centroId={centroId}
          onClose={() => setDevolverOpen(false)}
          onDone={() => { setDevolverOpen(false); onChanged?.(); }}
        />
      )}
    </div>
  );
}

// Modal de devolución (slices B–D): política (como_facturada|precio_base) + por línea cantidad
// (a_la_venta) / sesiones (a_la_entrega, solo lo NO entregado) + precio devuelto EDITABLE + neto
// (verde=reembolso, rojo=debe). Componentes de kit: pendiente BE (falta facturaItemComponenteId).
function DevolverDialog({
  facturaId,
  centroId,
  onClose,
  onDone,
}: {
  facturaId: string;
  centroId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("facturacionList.actions");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const facRes = useResource<FacturaConItems>(() => getFactura(facturaId, centroId), [facturaId, centroId]);
  const formasRes = useResource<FormaPago[]>(() => getFormasPago(centroId), [centroId]);
  const items = React.useMemo<FacturaItem[]>(
    () => (facRes.state.kind === "ok" ? (facRes.state.data.items ?? []) : []),
    [facRes.state],
  );
  const formas = (formasRes.state.kind === "ok" ? formasRes.state.data : []).filter((f) => f.activo !== false);

  const [politica, setPolitica] = React.useState<"como_facturada" | "precio_base">("como_facturada");
  const [cant, setCant] = React.useState<Record<string, string>>({});
  const [ses, setSes] = React.useState<Record<string, string>>({});
  const [precio, setPrecio] = React.useState<Record<string, string>>({}); // precioDevuelto editado
  const [bases, setBases] = React.useState<Record<string, number>>({}); // productoId → precioBase
  const [motivo, setMotivo] = React.useState("");
  const [formaId, setFormaId] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const esEntrega = (it: FacturaItem) => String(it.modoDescarga) === "a_la_entrega";
  const dispCant = (it: FacturaItem) => n(it.cantidad) - n((it as { cantidadDevuelta?: number }).cantidadDevuelta);
  const dispSes = (it: FacturaItem) => n(it.sesiones) - n((it as { sesionesDevueltas?: number }).sesionesDevueltas);
  // Reembolso "como facturada" por defecto = proporcional a lo devuelto (aritmética simple, no política).
  const defaultRefund = (it: FacturaItem) => {
    const base = esEntrega(it) ? dispSes(it) : dispCant(it);
    const q = esEntrega(it) ? Number(ses[it.id] || 0) : Number(cant[it.id] || 0);
    if (base <= 0 || q <= 0) return 0;
    return (q / base) * (n(it.total) || n(it.cantidad) * n(it.precioUnitario));
  };
  const refundDe = (it: FacturaItem) => (precio[it.id] != null && precio[it.id] !== "" ? Number(precio[it.id]) : defaultRefund(it));

  const seleccion = items.filter((it) => (esEntrega(it) ? Number(ses[it.id] || 0) > 0 : Number(cant[it.id] || 0) > 0));
  const neto = seleccion.reduce((s, it) => s + refundDe(it), 0);

  // Al activar precio_base, traer los precios base de los productos de la factura (referencia).
  React.useEffect(() => {
    if (politica !== "precio_base") return;
    const faltan = Array.from(new Set(items.map((it) => String(it.productoId)))).filter((p) => p && bases[p] == null);
    if (!faltan.length) return;
    Promise.all(faltan.map((p) => getPrecioBase(p, centroId).then((r) => [p, r.precioBase] as const).catch(() => null)))
      .then((rs) => setBases((m) => ({ ...m, ...Object.fromEntries(rs.filter(Boolean) as [string, number][]) })));
  }, [politica, items, centroId, bases]);

  async function confirmar() {
    if (!motivo.trim() || seleccion.length === 0 || busy) return;
    setBusy(true);
    try {
      const payload: DevolverPayload = {
        motivo: motivo.trim(),
        politica,
        ...(formaId ? { formaReembolsoId: formaId } : {}),
        items: seleccion.map((it) => ({
          facturaItemId: it.id,
          ...(esEntrega(it) ? { sesiones: Number(ses[it.id]) } : { cantidad: Number(cant[it.id]) }),
          ...(precio[it.id] != null && precio[it.id] !== "" ? { precioDevuelto: Number(precio[it.id]) } : {}),
        })),
      };
      await devolverFactura(facturaId, payload, centroId);
      toast.success(t("returnDone"));
      onDone();
    } catch (err) {
      toastError(err, tRoot);
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{t("returnTitle")}</DialogTitle></DialogHeader>
        {facRes.state.kind === "loading" ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{tc("loading")}</p>
        ) : (
          <div className="space-y-4">
            {/* Política */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t("policy")}</span>
              <Select value={politica} onValueChange={(v) => setPolitica(v as "como_facturada" | "precio_base")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="como_facturada">{t("policyAsBilled")}</SelectItem>
                  <SelectItem value="precio_base">{t("policyBasePrice")}</SelectItem>
                </SelectContent>
              </Select>
            </label>

            <div className="max-h-72 space-y-2 overflow-y-auto">
              {items.map((it) => {
                const entrega = esEntrega(it);
                const disp = entrega ? dispSes(it) : dispCant(it);
                const base = bases[String(it.productoId)];
                return (
                  <div key={it.id} className="rounded-lg border px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{it.descripcion ?? "—"}</span>
                        <span className="text-xs text-muted-foreground">
                          {t(entrega ? "returnAvailSes" : "returnAvail", { n: disp })} · {money(it.precioUnitario)}
                          {politica === "precio_base" && base != null ? ` · ${t("basePriceRef", { v: money(base) })}` : ""}
                        </span>
                      </span>
                      <Input
                        type="number" min={0} max={disp} disabled={disp <= 0}
                        value={(entrega ? ses[it.id] : cant[it.id]) ?? ""}
                        onChange={(e) => (entrega ? setSes : setCant)((m) => ({ ...m, [it.id]: e.target.value }))}
                        className="h-8 w-20 text-right tabular-nums"
                        aria-label={t(entrega ? "returnSes" : "returnQty")}
                      />
                    </div>
                    {/* Precio devuelto editable (por línea) */}
                    <label className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      {t("returnLineRefund")}
                      <Input
                        type="number"
                        placeholder={defaultRefund(it) ? defaultRefund(it).toFixed(2) : "0.00"}
                        value={precio[it.id] ?? ""}
                        onChange={(e) => setPrecio((m) => ({ ...m, [it.id]: e.target.value }))}
                        className="h-7 w-24 text-right tabular-nums"
                      />
                    </label>
                  </div>
                );
              })}
            </div>

            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t("returnReason")} />
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t("returnRefund")}</span>
              <Select value={formaId} onValueChange={setFormaId}>
                <SelectTrigger><SelectValue placeholder={t("returnRefundNone")} /></SelectTrigger>
                <SelectContent>
                  {formas.map((f) => <SelectItem key={f.id} value={f.id}>{f.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>

            {/* Neto: verde=reembolso, rojo=debe */}
            {seleccion.length > 0 && (
              <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span className="text-muted-foreground">{neto >= 0 ? t("netRefund") : t("netOwed")}</span>
                <span className={"text-base font-bold tabular-nums " + (neto >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                  {money(Math.abs(neto))}
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>{tc("cancel")}</Button>
              <Button size="sm" onClick={confirmar} disabled={busy || !motivo.trim() || seleccion.length === 0}>{t("return")}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
