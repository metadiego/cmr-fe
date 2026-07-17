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
  type FacturaConItems,
  type FacturaItem,
  type FormaPago,
  type DevolverPayload,
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

const money = (v: unknown) => `$${Number(v ?? 0).toFixed(2)}`;

// Acciones por factura (lista): mapeo del handoff fe-devoluciones-lista-y-acciones.
//  - Ver / Imprimir → detalle (la impresión vive ahí). Editar → detalle (solo borrador).
//  - Anular → POST /facturas/:id/anular (emitida, RBAC factura.anular, motivo) — mismo día.
//  - Devolución → modal de selección de ítems → POST /facturas/:id/devolver (emitida, RBAC factura.devolver).
//  (Email = pendiente BE: no hay endpoint de email de factura; ver handoff.)
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

  const esBorrador = estado === "borrador";
  const esEmitida = estado === "emitida";
  const puedeAnular = esEmitida && can("factura.anular");
  const puedeDevolver = (esEmitida || estado === "devuelta_parcial") && can("factura.devolver");

  const href = centroId ? `/facturacion/${facturaId}?centro=${centroId}` : `/facturacion/${facturaId}`;

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

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
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
                {t("return")}
              </DropdownMenuItem>
            </>
          )}
          {puedeAnular && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={(e) => { e.preventDefault(); setAnularOpen(true); }}>
                {t("void")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Anular (motivo) */}
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

      {/* Devolución (selección de ítems) */}
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

// Modal de devolución: trae los ítems de la factura y deja elegir cantidad/sesiones a devolver por
// línea + motivo + forma de reembolso. El BE recalcula montos (slices B–D: monto editable, luego).
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
  const items = facRes.state.kind === "ok" ? (facRes.state.data.items ?? []) : [];
  const formas = (formasRes.state.kind === "ok" ? formasRes.state.data : []).filter((f) => f.activo !== false);

  const [cant, setCant] = React.useState<Record<string, string>>({}); // itemId → cantidad a devolver
  const [motivo, setMotivo] = React.useState("");
  const [formaId, setFormaId] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const n = (v: unknown) => Number(v ?? 0);
  const disponible = (it: FacturaItem) => n(it.cantidad) - n((it as { cantidadDevuelta?: number }).cantidadDevuelta);
  const seleccion = items
    .map((it) => ({ it, c: Math.min(Number(cant[it.id] || 0), disponible(it)) }))
    .filter((x) => x.c > 0);

  async function confirmar() {
    if (!motivo.trim() || seleccion.length === 0 || busy) return;
    setBusy(true);
    try {
      const payload: DevolverPayload = {
        items: seleccion.map((x) => ({ facturaItemId: x.it.id, cantidad: x.c })),
        motivo: motivo.trim(),
        ...(formaId ? { formaReembolsoId: formaId } : {}),
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
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t("returnTitle")}</DialogTitle></DialogHeader>
        {facRes.state.kind === "loading" ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{tc("loading")}</p>
        ) : (
          <div className="space-y-4">
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {items.map((it) => {
                const disp = disponible(it);
                return (
                  <div key={it.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{it.descripcion ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">{t("returnAvail", { n: disp })} · {money(it.precioUnitario)}</span>
                    </span>
                    <Input
                      type="number" min={0} max={disp} disabled={disp <= 0}
                      value={cant[it.id] ?? ""}
                      onChange={(e) => setCant((m) => ({ ...m, [it.id]: e.target.value }))}
                      className="h-8 w-20 text-right tabular-nums"
                    />
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
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>{tc("cancel")}</Button>
              <Button size="sm" onClick={confirmar} disabled={busy || !motivo.trim() || seleccion.length === 0}>
                {t("return")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
