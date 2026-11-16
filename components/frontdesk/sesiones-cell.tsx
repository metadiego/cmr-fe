"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { PencilEdit01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

import {
  getDisponibilidadServicio,
  paqueteTotales,
  transferirTratamiento,
  type DisponibilidadServicio,
  type PaqueteDisponibilidad,
} from "@/lib/api/frontdesk";
import { fijarSesionesSinPaquete } from "@/lib/api/frontdesk-fijar-sesiones";
import type { Servicio } from "@/lib/api/servicios";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { listAlmacenes, type Almacen, type Producto } from "@/lib/api/inventario";
import { listProductosDeGrupo } from "@/lib/api/inventario-grupos";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { legendMultiplicadores } from "@/lib/frontdesk/multiplicadores";
import {
  transferTreatmentInvalid,
  transferTreatmentMissing,
  type TransferTreatmentField,
} from "@/lib/frontdesk/transfer-treatment-missing";
import {
  fixSessionsWithoutPackageInvalid,
  fixSessionsWithoutPackageMissing,
  type FixSessionsWithoutPackageField,
} from "@/lib/frontdesk/fix-sessions-without-package-missing";
import { CorregirDisponibilidadDialog } from "@/components/frontdesk/corregir-disponibilidad-dialog";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { RequiredLegend } from "@/components/kit/required-mark";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import { useSubmit } from "@/components/kit/use-submit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Celda "X/Y" (sesiones entregadas/compradas) con su desplegable de disponibilidad, más el diálogo
// de transferir tratamiento a otro centro que cuelga de ella. Extraído de fila-sesion.tsx.
// ————— Transferir tratamiento a OTRO centro (POST /facturas/paquetes/:id/transferir) —————
// Mueve las sesiones pendientes del paquete a otra oficina para que el paciente continúe allí. Modo
// "virtual" (solo el tratamiento; el destino usa su stock) o "física" (además mueve el material entre
// almacenes). Total o parcial. Handoff transferir-tratamiento-entre-centros.
export function TransferirTratamientoDialog({
  paquete,
  centro,
  onClose,
  onDone,
}: {
  paquete: PaqueteDisponibilidad | null;
  centro?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("frontdesk");
  const { entregadas, totales } = paquete ? paqueteTotales(paquete) : { entregadas: 0, totales: 0 };
  const pendientes = Math.max(0, totales - entregadas);
  const centrosRes = useResource<Centro[]>(() => getMyCentros(), []);
  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data : [];
  const destinos = centros.filter((c) => c.id !== centro); // never transfer to the same center

  const [form, setForm] = useDialogForm(
    () => ({
      destino: "",
      sesiones: String(pendientes || ""),
      modo: "virtual" as "virtual" | "fisica",
      almOrigen: "",
      almDestino: "",
      motivo: "",
    }),
    paquete != null,
    paquete?.id ?? null,
  );
  const { destino, sesiones, modo, almOrigen, almDestino, motivo } = form;

  // Warehouses per center (physical mode only).
  const almOrigenRes = useResource<Almacen[]>(
    () => (modo === "fisica" && centro ? listAlmacenes(centro) : Promise.resolve([])),
    [modo, centro],
  );
  const almDestinoRes = useResource<Almacen[]>(
    () => (modo === "fisica" && destino ? listAlmacenes(destino) : Promise.resolve([])),
    [modo, destino],
  );
  const almacenesOrigen = almOrigenRes.state.kind === "ok" ? almOrigenRes.state.data : [];
  const almacenesDestino = almDestinoRes.state.kind === "ok" ? almDestinoRes.state.data : [];

  const state = { destination: destino, mode: modo, sourceWarehouse: almOrigen, destinationWarehouse: almDestino, sessions: sesiones, pending: pendientes };
  const label: Record<TransferTreatmentField, string> = {
    destination: t("transferir.destino"),
    sourceWarehouse: t("transferir.almacenOrigen"),
    destinationWarehouse: t("transferir.almacenDestino"),
  };
  const missing = transferTreatmentMissing(state).map((f) => label[f]);
  const problem = transferTreatmentInvalid(state);
  const reason =
    problem === "nothingPending"
      ? t("transferir.nothingPending")
      : problem === "sessionsOutOfRange"
        ? t("transferir.sesionesInvalida", { n: pendientes })
        : null;

  const nSes = Number(sesiones);
  const { submitting, submit } = useSubmit(
    async () => {
      if (!paquete?.id) return false; // the cell only opens this dialog for a package with an id
      await transferirTratamiento(
        paquete.id,
        {
          destinationClinicId: destino,
          ...(sesiones !== "" && nSes < pendientes ? { sessions: nSes } : {}), // omitted = all
          mode: modo,
          ...(modo === "fisica" ? { sourceWarehouseId: almOrigen, destinationWarehouseId: almDestino } : {}),
          ...(motivo.trim() ? { reason: motivo.trim() } : {}),
        },
        centro,
      );
      return true;
    },
    {
      onSuccess: (done) => {
        if (!done) return;
        toast.success(t("transferir.ok"));
        onClose();
        onDone();
      },
    },
  );

  return (
    <FormDialog
      open={paquete != null}
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={t("transferir.titulo")}
      description={t("transferir.desc")}
      onSubmit={() => submit()}
      submitLabel={t("transferir.confirmar")}
      cancelLabel={t("transferir.cancelar")}
      submitting={submitting}
      missing={missing}
      reason={reason}
      // Nothing pending, or sessions out of range, kept the button disabled before too.
      blocked={problem != null}
    >
      {paquete && (
        <>
          <div className="rounded-md bg-card px-3 py-2 text-sm ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
            <span className="font-medium">{paquete.productoNombre ?? paquete.sku ?? "—"}</span>
            <span className="ml-2 text-muted-foreground">{t("transferir.pendientes", { n: pendientes })}</span>
          </div>

          <Field label={label.destination} htmlFor="transfer-destination" required className="space-y-1">
            <Select value={destino} onValueChange={(v) => setForm({ destino: v })}>
              <SelectTrigger id="transfer-destination"><SelectValue placeholder={t("transferir.elegirCentro")} /></SelectTrigger>
              <SelectContent>
                {destinos.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t("transferir.sesiones")} htmlFor="transfer-sessions" hint={t("transferir.sesionesAyuda", { n: pendientes })} className="space-y-1">
            <Input
              id="transfer-sessions"
              type="number"
              min={1}
              max={pendientes}
              value={sesiones}
              aria-invalid={problem === "sessionsOutOfRange"}
              aria-describedby="transfer-sessions-hint"
              onChange={(e) => setForm({ sesiones: e.target.value })}
            />
          </Field>

          <Field label={t("transferir.modo")} className="space-y-1">
            <div className="flex gap-2">
              {(["virtual", "fisica"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm({ modo: m })}
                  className={"flex-1 rounded-md border px-3 py-2 text-left text-sm " + (modo === m ? "border-primary bg-primary/10" : "hover:bg-muted")}
                >
                  <span className="block font-medium">{t(`transferir.${m}`)}</span>
                  <span className="block text-[11px] text-muted-foreground">{t(`transferir.${m}Ayuda`)}</span>
                </button>
              ))}
            </div>
          </Field>

          {modo === "fisica" && (
            <div className="grid grid-cols-2 gap-2">
              <Field label={label.sourceWarehouse} htmlFor="transfer-source-warehouse" required className="space-y-1">
                <Select value={almOrigen} onValueChange={(v) => setForm({ almOrigen: v })}>
                  <SelectTrigger id="transfer-source-warehouse"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{almacenesOrigen.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label={label.destinationWarehouse} htmlFor="transfer-destination-warehouse" required className="space-y-1">
                <Select value={almDestino} onValueChange={(v) => setForm({ almDestino: v })} disabled={!destino}>
                  <SelectTrigger id="transfer-destination-warehouse"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{almacenesDestino.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
          )}

          <Field label={t("transferir.motivo")} htmlFor="transfer-reason" className="space-y-1">
            <Input id="transfer-reason" value={motivo} onChange={(e) => setForm({ motivo: e.target.value })} placeholder={t("transferir.motivoPlaceholder")} />
          </Field>
          {modo === "fisica" && <RequiredLegend className="text-xs text-muted-foreground" />}
        </>
      )}
    </FormDialog>
  );
}

// ————— Fix sessions WITHOUT a prior package (PATCH .../session-count, opt-in per service) —————
// A different gap from "Fix availability": that dialog fixes a package that ALREADY EXISTS; this one
// covers the patient who has NONE — before, with no package at all, there was no way to touch the
// session number (handoff columna-sesiones-sin-paquete-handoff-be.md). Shown only when the service has
// `allowSessionFixWithoutPackage` on (configurable per service, Services screen).
function FijarSesionesSinPaqueteDialog({
  servicio,
  pacienteId,
  centro,
  onClose,
  onDone,
}: {
  servicio: Servicio | null;
  pacienteId?: string;
  centro?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("frontdesk");
  // GROUP service (several products, e.g. HILT+MLS laser) without its own productId: the BE requires
  // saying which one the new package anchors to. Without a group, or with its own productId, not needed.
  const esDeGrupo = !!servicio && !servicio.productId && !!servicio.billingGroupId;

  const [form, setForm] = useDialogForm(() => ({ sesiones: "", productoId: "" }), servicio != null, servicio?.id ?? null);
  const { sesiones, productoId } = form;

  const productosRes = useResource<Producto[]>(
    () => (esDeGrupo && servicio?.billingGroupId ? listProductosDeGrupo(servicio.billingGroupId, centro) : Promise.resolve([])),
    [esDeGrupo, servicio?.billingGroupId, centro],
  );
  const productos = productosRes.state.kind === "ok" ? productosRes.state.data : [];

  const state = { sessions: sesiones, needsProduct: esDeGrupo, productId: productoId };
  const label: Record<FixSessionsWithoutPackageField, string> = {
    sessions: t("fijarSinPaqueteCampoSesiones"),
    product: t("fijarSinPaqueteCampoProducto"),
  };
  const missing = fixSessionsWithoutPackageMissing(state).map((f) => label[f]);
  const problem = fixSessionsWithoutPackageInvalid(state);

  const { submitting, submit } = useSubmit(
    async () => {
      if (!servicio || !pacienteId) return false; // the cell only renders this with both
      await fijarSesionesSinPaquete(
        pacienteId,
        servicio.id,
        { sesionesTotales: Number(sesiones), ...(productoId ? { productoId } : {}) },
        centro,
      );
      return true;
    },
    {
      onSuccess: (done) => {
        if (!done) return;
        toast.success(t("fijarSinPaqueteOk"));
        onClose();
        onDone();
      },
    },
  );

  return (
    <FormDialog
      open={servicio != null}
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={t("fijarSinPaqueteTitulo")}
      description={t("fijarSinPaqueteDesc")}
      onSubmit={() => submit()}
      submitLabel={t("fijarSinPaqueteGuardar")}
      cancelLabel={t("transferir.cancelar")}
      submitting={submitting}
      missing={missing}
      reason={problem ? t("fixSessionsNegative") : null}
      // A negative total kept the button disabled before too.
      blocked={problem != null}
    >
      {servicio && (
        <>
          <Field label={label.sessions} htmlFor="fix-sessions-total" required className="space-y-1">
            <Input
              id="fix-sessions-total"
              type="number"
              min={0}
              value={sesiones}
              aria-invalid={problem != null}
              onChange={(e) => setForm({ sesiones: e.target.value })}
            />
          </Field>

          {esDeGrupo && (
            <Field label={label.product} htmlFor="fix-sessions-product" required className="space-y-1">
              <Select value={productoId} onValueChange={(v) => setForm({ productoId: v })}>
                <SelectTrigger id="fix-sessions-product"><SelectValue placeholder={t("fijarSinPaqueteElegirProducto")} /></SelectTrigger>
                <SelectContent>
                  {productos.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}
        </>
      )}
    </FormDialog>
  );
}

// ————— X/Y + disponibilidad del paciente (lazy, al abrir) —————
export function SesionesCell({
  display,
  servicio,
  pacienteId,
  centro,
}: {
  display: string;
  servicio?: Servicio;
  pacienteId?: string;
  centro?: string;
}) {
  const t = useTranslations("frontdesk");
  const { can } = useCan();
  const puedeCorregir = can("frontdesk.disponibilidad.editar");
  const servicioId = servicio?.id;
  const [open, setOpen] = React.useState(false);
  const [disp, setDisp] = React.useState<DisponibilidadServicio | null>(null);
  const [fallo, setFallo] = React.useState(false);
  const [corrigiendo, setCorrigiendo] = React.useState<PaqueteDisponibilidad | null>(null);
  const [transfiriendo, setTransfiriendo] = React.useState<PaqueteDisponibilidad | null>(null);
  const [fijando, setFijando] = React.useState(false);

  React.useEffect(() => {
    if (!open || disp || fallo || !servicioId || !pacienteId) return;
    getDisponibilidadServicio(servicioId, pacienteId, centro)
      .then(setDisp)
      .catch(() => setFallo(true));
  }, [open, disp, fallo, servicioId, pacienteId, centro]);

  if (!servicioId || !pacienteId) return <span className="tabular-nums">{display}</span>;
  const agotado = disp != null && Number(disp.pendienteTotal ?? 0) <= 0;
  const recargar = () => setDisp(null); // dispara el refetch (el efecto corre con disp=null)

  return (
    <>
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button type="button" className="cursor-pointer rounded px-1 tabular-nums underline decoration-dotted underline-offset-4 hover:bg-muted">
          {display}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("saldoTitle")}</p>
        {!disp && !fallo && <p className="text-sm text-muted-foreground">…</p>}
        {fallo && <p className="text-sm text-destructive">{t("saldoError")}</p>}
        {disp && (
          <div className="space-y-1.5">
            {(disp.paquetes ?? []).length === 0 && (
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">{t("sinPaquetes")}</p>
                {puedeCorregir && servicio?.allowSessionFixWithoutPackage && (
                  <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" onClick={() => setFijando(true)}>
                    {t("fijarSinPaquete")}
                  </Button>
                )}
              </div>
            )}
            {(disp.paquetes ?? []).map((p, i) => {
              const { entregadas, totales } = paqueteTotales(p);
              const leyenda = legendMultiplicadores(p.multiplicadores, (k) => (t.has(`mult.${k}`) ? t(`mult.${k}`) : k));
              return (
                <div key={p.id ?? p.invoiceItemId ?? i} className="flex items-start justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.productoNombre ?? p.sku ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {t("sesionXdeN", { x: Math.min(entregadas + 1, Math.max(totales, 1)), n: totales })}
                      {leyenda && <span className="ml-1">({leyenda})</span>}
                    </div>
                  </div>
                  {puedeCorregir && p.id && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => setCorrigiendo(p)}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={t("corregirDisponibilidad")}
                        title={t("corregirDisponibilidad")}
                      >
                        <HugeiconsIcon icon={PencilEdit01Icon} className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setTransfiriendo(p)}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={t("transferir.abrir")}
                        title={t("transferir.abrir")}
                      >
                        <HugeiconsIcon icon={ArrowRight01Icon} className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="mt-1 flex items-center justify-between border-t pt-1.5 text-sm font-semibold">
              <span>{t("pendienteTotal")}</span>
              <span className={"tabular-nums " + (agotado ? "text-destructive" : "text-success-foreground")}>
                {Number(disp.pendienteTotal ?? 0)}
              </span>
            </div>
            {agotado && <Badge variant="destructive" className="mt-1">{t("sinSaldo")}</Badge>}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
    {puedeCorregir && (
      <CorregirDisponibilidadDialog
        paquete={corrigiendo}
        centro={centro}
        onClose={() => setCorrigiendo(null)}
        onDone={recargar}
      />
    )}
    {puedeCorregir && (
      <TransferirTratamientoDialog
        paquete={transfiriendo}
        centro={centro}
        onClose={() => setTransfiriendo(null)}
        onDone={recargar}
      />
    )}
    {puedeCorregir && servicio?.allowSessionFixWithoutPackage && (
      <FijarSesionesSinPaqueteDialog
        servicio={fijando ? (servicio ?? null) : null}
        pacienteId={pacienteId}
        centro={centro}
        onClose={() => setFijando(false)}
        onDone={recargar}
      />
    )}
    </>
  );
}
