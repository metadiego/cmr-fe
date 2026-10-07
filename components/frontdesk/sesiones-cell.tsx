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
import { toastError } from "@/lib/api/errors";
import { legendMultiplicadores } from "@/lib/frontdesk/multiplicadores";
import { CorregirDisponibilidadDialog } from "@/components/frontdesk/corregir-disponibilidad-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  const destinos = centros.filter((c) => c.id !== centro); // no transferir al mismo centro

  const [destino, setDestino] = React.useState<string>("");
  const [sesiones, setSesiones] = React.useState<string>("");
  const [modo, setModo] = React.useState<"virtual" | "fisica">("virtual");
  const [almOrigen, setAlmOrigen] = React.useState<string>("");
  const [almDestino, setAlmDestino] = React.useState<string>("");
  const [motivo, setMotivo] = React.useState<string>("");
  const [guardando, setGuardando] = React.useState(false);

  // Reset al abrir/cambiar de paquete (sin efecto).
  const pid = paquete?.id ?? null;
  const [prevPid, setPrevPid] = React.useState<string | null>(null);
  if (pid !== prevPid) {
    setPrevPid(pid);
    setDestino(""); setSesiones(String(pendientes || "")); setModo("virtual");
    setAlmOrigen(""); setAlmDestino(""); setMotivo("");
  }

  // Almacenes por centro (solo si modo física).
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

  const nSes = Number(sesiones);
  const sesInvalida = sesiones !== "" && (!Number.isFinite(nSes) || nSes <= 0 || nSes > pendientes);
  const faltaAlmacen = modo === "fisica" && (!almOrigen || !almDestino);
  const puede = !!paquete?.id && !!destino && !sesInvalida && !faltaAlmacen && pendientes > 0;

  async function guardar() {
    if (!puede || !paquete?.id) return;
    setGuardando(true);
    try {
      await transferirTratamiento(
        paquete.id,
        {
          destinationClinicId: destino,
          ...(sesiones !== "" && nSes < pendientes ? { sessions: nSes } : {}), // omitido = todas
          mode: modo,
          ...(modo === "fisica" ? { sourceWarehouseId: almOrigen, destinationWarehouseId: almDestino } : {}),
          ...(motivo.trim() ? { reason: motivo.trim() } : {}),
        },
        centro,
      );
      toast.success(t("transferir.ok"));
      onClose();
      onDone();
    } catch (e) {
      toastError(e, t);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={paquete != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("transferir.titulo")}</DialogTitle>
          <DialogDescription>{t("transferir.desc")}</DialogDescription>
        </DialogHeader>
        {paquete && (
          <div className="space-y-3">
            <div className="rounded-md bg-card px-3 py-2 text-sm ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
              <span className="font-medium">{paquete.productoNombre ?? paquete.sku ?? "—"}</span>
              <span className="ml-2 text-muted-foreground">{t("transferir.pendientes", { n: pendientes })}</span>
            </div>

            <div className="space-y-1">
              <Label>{t("transferir.destino")}</Label>
              <Select value={destino} onValueChange={setDestino}>
                <SelectTrigger><SelectValue placeholder={t("transferir.elegirCentro")} /></SelectTrigger>
                <SelectContent>
                  {destinos.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{t("transferir.sesiones")}</Label>
              <Input type="number" min={1} max={pendientes} value={sesiones} onChange={(e) => setSesiones(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">{t("transferir.sesionesAyuda", { n: pendientes })}</p>
              {sesInvalida && <p className="text-xs text-destructive">{t("transferir.sesionesInvalida", { n: pendientes })}</p>}
            </div>

            <div className="space-y-1">
              <Label>{t("transferir.modo")}</Label>
              <div className="flex gap-2">
                {(["virtual", "fisica"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModo(m)}
                    className={"flex-1 rounded-md border px-3 py-2 text-left text-sm " + (modo === m ? "border-primary bg-primary/10" : "hover:bg-muted")}
                  >
                    <span className="block font-medium">{t(`transferir.${m}`)}</span>
                    <span className="block text-[11px] text-muted-foreground">{t(`transferir.${m}Ayuda`)}</span>
                  </button>
                ))}
              </div>
            </div>

            {modo === "fisica" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>{t("transferir.almacenOrigen")}</Label>
                  <Select value={almOrigen} onValueChange={setAlmOrigen}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{almacenesOrigen.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{t("transferir.almacenDestino")}</Label>
                  <Select value={almDestino} onValueChange={setAlmDestino} disabled={!destino}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{almacenesDestino.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label>{t("transferir.motivo")}</Label>
              <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t("transferir.motivoPlaceholder")} />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose} disabled={guardando}>{t("transferir.cancelar")}</Button>
              <Button onClick={guardar} disabled={!puede || guardando}>{t("transferir.confirmar")}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ————— Fijar sesiones SIN paquete previo (PATCH .../session-count, opt-in por servicio) —————
// Gap distinto del de "Corregir disponibilidad": ese diálogo corrige un paquete que YA EXISTE; este
// cubre el paciente que no tiene NINGUNO — antes, sin ningún paquete, no había forma de tocar el
// número de sesión (handoff columna-sesiones-sin-paquete-handoff-be.md). Solo aparece si el servicio
// tiene `allowSessionFixWithoutPackage` prendido (configurable por servicio, pantalla de Servicios).
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
  // Servicio de GRUPO (varios productos, p. ej. Láser HILT+MLS) sin productId propio: el BE exige
  // indicar a cuál anclar el paquete nuevo. Sin grupo o con productId propio, no hace falta.
  const esDeGrupo = !!servicio && !servicio.productId && !!servicio.billingGroupId;

  const [sesiones, setSesiones] = React.useState("");
  const [productoId, setProductoId] = React.useState("");
  const [guardando, setGuardando] = React.useState(false);

  // Reset al abrir/cambiar de servicio (sin efecto).
  const sid = servicio?.id ?? null;
  const [prevSid, setPrevSid] = React.useState<string | null>(null);
  if (sid !== prevSid) {
    setPrevSid(sid);
    setSesiones("");
    setProductoId("");
  }

  const productosRes = useResource<Producto[]>(
    () => (esDeGrupo && servicio?.billingGroupId ? listProductosDeGrupo(servicio.billingGroupId, centro) : Promise.resolve([])),
    [esDeGrupo, servicio?.billingGroupId, centro],
  );
  const productos = productosRes.state.kind === "ok" ? productosRes.state.data : [];

  const n = Number(sesiones);
  const sesionesInvalidas = sesiones.trim() === "" || !Number.isFinite(n) || n < 0;
  const faltaProducto = esDeGrupo && !productoId;
  const puede = !!servicio?.id && !!pacienteId && !sesionesInvalidas && !faltaProducto;

  async function guardar() {
    if (!puede || !servicio || !pacienteId) return;
    setGuardando(true);
    try {
      await fijarSesionesSinPaquete(
        pacienteId,
        servicio.id,
        { sesionesTotales: n, ...(productoId ? { productoId } : {}) },
        centro,
      );
      toast.success(t("fijarSinPaqueteOk"));
      onClose();
      onDone();
    } catch (e) {
      toastError(e, t);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={servicio != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("fijarSinPaqueteTitulo")}</DialogTitle>
          <DialogDescription>{t("fijarSinPaqueteDesc")}</DialogDescription>
        </DialogHeader>
        {servicio && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{t("fijarSinPaqueteCampoSesiones")}</Label>
              <Input type="number" min={0} value={sesiones} onChange={(e) => setSesiones(e.target.value)} />
            </div>

            {esDeGrupo && (
              <div className="space-y-1">
                <Label>{t("fijarSinPaqueteCampoProducto")}</Label>
                <Select value={productoId} onValueChange={setProductoId}>
                  <SelectTrigger><SelectValue placeholder={t("fijarSinPaqueteElegirProducto")} /></SelectTrigger>
                  <SelectContent>
                    {productos.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {faltaProducto && <p className="text-xs text-destructive">{t("fijarSinPaqueteProductoRequerido")}</p>}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose} disabled={guardando}>{t("transferir.cancelar")}</Button>
              <Button onClick={guardar} disabled={!puede || guardando}>{t("fijarSinPaqueteGuardar")}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
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
