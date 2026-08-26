"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon, InvoiceIcon, StethoscopeIcon, TestTube01Icon, Add01Icon } from "@hugeicons/core-free-icons";

import type { Paciente } from "@/lib/api/pacientes";
import { listFacturas, type Factura } from "@/lib/api/facturas";
import { listCitas, getTiposCita, type Cita, type TipoCita } from "@/lib/api/citas";
import { listSesionesRango, type Sesion } from "@/lib/api/frontdesk";
import { getServicios, type Servicio } from "@/lib/api/servicios";
import { getMedicos, type Personal } from "@/lib/api/personal";
import { listPrescripcionesPaciente, type PrescripcionPaciente } from "@/lib/api/prescripcion";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { CitaModal } from "@/components/agenda/cita-modal";

// «Acciones» del paciente: sus historiales SIN salir de la ficha — compras, servicios, citas, prescripción
// y crear cita médica. Cada sección con su permiso y su estado vacío honesto. Handoff
// acciones-del-paciente-historiales.
const money = (v: unknown) => `$${(Number(v) || 0).toFixed(2)}`;
const nombreDe = (p: Paciente) => [p.nombres, p.apellidos].filter(Boolean).join(" ").trim();
// Rango por defecto para servicios (obligan desde/hasta): el año en curso. Fecha fija (no Date.now en SSR).
const AÑO = "2026";

export function AccionesPacienteSheet({
  paciente, centro, onClose,
}: {
  paciente: Paciente;
  centro?: string;
  onClose: () => void;
}) {
  const t = useTranslations("acciones");
  const { can } = useCan();
  const pid = paciente.id;
  const [crearCita, setCrearCita] = React.useState(false);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{nombreDe(paciente)}</SheetTitle>
          <SheetDescription>
            {paciente.record ? `#${paciente.record}` : ""} {t("subtitle")}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-8">
          {can("factura.read") && (
            <Seccion icon={InvoiceIcon} titulo={t("compras")}>
              <Compras pid={pid} centro={centro} />
            </Seccion>
          )}
          {can("frontdesk.read") && (
            <Seccion icon={StethoscopeIcon} titulo={t("servicios")}>
              <Servicios pid={pid} centro={centro} />
            </Seccion>
          )}
          {can("citas.read") && (
            <Seccion icon={Calendar03Icon} titulo={t("citas")}>
              <Citas pid={pid} centro={centro} />
            </Seccion>
          )}
          {can("prescripcion.read") && (
            <Seccion icon={TestTube01Icon} titulo={t("prescripcion")}>
              <Prescripcion pid={pid} centro={centro} />
            </Seccion>
          )}

          {can("citas.create") && (
            <div className="border-t pt-4">
              <Button size="sm" className="w-full" onClick={() => setCrearCita(true)}>
                <HugeiconsIcon icon={Add01Icon} className="size-4" /> {t("crearCita")}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>

      {crearCita && <CrearCitaLazy paciente={paciente} centro={centro} onClose={() => setCrearCita(false)} />}
    </Sheet>
  );
}

function Seccion({ icon, titulo, children }: { icon: typeof InvoiceIcon; titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <HugeiconsIcon icon={icon} className="size-4 text-muted-foreground" /> {titulo}
      </h3>
      {children}
    </section>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">{children}</p>;
}
function Cargando() {
  const t = useTranslations("common");
  return <p className="px-1 py-2 text-xs text-muted-foreground">{t("loading")}</p>;
}

function Compras({ pid, centro }: { pid: string; centro?: string }) {
  const t = useTranslations("acciones");
  // Solo EMITIDAS (decisión del dueño): nada de borradores ni presupuestos.
  const res = useResource<Factura[]>(
    () => listFacturas({ pacienteId: pid, estado: "emitida", limit: 100 }, centro).then((r) => r.items),
    [pid, centro],
  );
  if (res.state.kind === "loading") return <Cargando />;
  if (res.state.kind === "fail") return <p className="text-xs text-destructive">{res.state.message}</p>;
  const facturas = res.state.data;
  if (facturas.length === 0) return <Vacio>{t("sinCompras")}</Vacio>;
  const numDoc = (f: Factura) => (f as { numero?: string }).numero || (f as { numeroPresupuesto?: string }).numeroPresupuesto || (f as { numeroLegacy?: string }).numeroLegacy || "—";
  return (
    <ul className="divide-y rounded-md border">
      {facturas.map((f) => (
        <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="min-w-0">
            <span className="font-mono font-medium tabular-nums">{numDoc(f)}</span>
            <span className="ml-2 text-xs text-muted-foreground">{(f as { fecha?: string }).fecha ?? ""}</span>
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <span className="tabular-nums">{money((f as { total?: number }).total)}</span>
            <Link href={centro ? `/facturacion/${f.id}?centro=${centro}` : `/facturacion/${f.id}`} className="text-xs font-medium text-primary hover:underline">
              {t("abrir")}
            </Link>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Servicios({ pid, centro }: { pid: string; centro?: string }) {
  const t = useTranslations("acciones");
  const tRoot = useTranslations();
  const res = useResource<Sesion[]>(
    () => listSesionesRango({ pacienteId: pid, desde: `${AÑO}-01-01`, hasta: `${AÑO}-12-31`, centroId: centro }),
    [pid, centro],
  );
  const servRes = useResource<Servicio[]>(() => (centro ? getServicios(centro) : Promise.resolve([])), [centro]);
  const servName = new Map((servRes.state.kind === "ok" ? servRes.state.data : []).map((s) => [s.id, s.nombre]));
  if (res.state.kind === "loading") return <Cargando />;
  if (res.state.kind === "fail") return <p className="text-xs text-destructive">{res.state.message}</p>;
  const ses = res.state.data;
  if (ses.length === 0) return <Vacio>{t("sinServicios")}</Vacio>;
  return (
    <ul className="divide-y rounded-md border">
      {ses.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="min-w-0 truncate">{servName.get(s.servicioId) ?? s.servicioId}</span>
          <span className="flex shrink-0 items-center gap-2 text-xs">
            <span className="text-muted-foreground tabular-nums">{s.fecha}</span>
            <span className="rounded-full bg-muted px-2 py-0.5">{tRoot.has(`estado.${s.estado}`) ? tRoot(`estado.${s.estado}`) : s.estado}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Citas({ pid, centro }: { pid: string; centro?: string }) {
  const t = useTranslations("acciones");
  const res = useResource<Cita[]>(() => listCitas({ pacienteId: pid, limit: 100 }, centro).then((r) => r.items), [pid, centro]);
  if (res.state.kind === "loading") return <Cargando />;
  if (res.state.kind === "fail") return <p className="text-xs text-destructive">{res.state.message}</p>;
  const citas = res.state.data;
  if (citas.length === 0) return <Vacio>{t("sinCitas")}</Vacio>;
  return (
    <ul className="divide-y rounded-md border">
      {citas.map((c) => (
        <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="tabular-nums">{c.fecha}{c.hora ? ` · ${c.hora}` : ""}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{c.estado}</span>
        </li>
      ))}
    </ul>
  );
}

function Prescripcion({ pid, centro }: { pid: string; centro?: string }) {
  const t = useTranslations("acciones");
  const tRoot = useTranslations();
  const res = useResource<PrescripcionPaciente[]>(() => listPrescripcionesPaciente(pid, centro), [pid, centro]);
  if (res.state.kind === "loading") return <Cargando />;
  if (res.state.kind === "fail") return <p className="text-xs text-destructive">{res.state.message}</p>;
  const items = res.state.data;
  if (items.length === 0) return <Vacio>{t("sinPrescripcion")}</Vacio>;
  return (
    <ul className="divide-y rounded-md border">
      {items.map((p) => (
        <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="min-w-0 truncate">
            {p.grupoNombre || (p.grupoLabelKey && tRoot.has(p.grupoLabelKey) ? tRoot(p.grupoLabelKey) : p.grupoLabelKey) || "—"}
            {p.cantidad ? ` ×${p.cantidad}` : ""}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{p.fecha ?? ""}</span>
        </li>
      ))}
    </ul>
  );
}

// Crea la cita médica reusando el CitaModal (mismo motor que la agenda). Carga tipos + médicos al abrir.
function CrearCitaLazy({ paciente, centro, onClose }: { paciente: Paciente; centro?: string; onClose: () => void }) {
  const tiposRes = useResource<TipoCita[]>(() => getTiposCita());
  const medicosRes = useResource<Personal[]>(() => getMedicos(centro), [centro]);
  const hoy = `${AÑO}-01-01`;
  const tipos = tiposRes.state.kind === "ok" ? tiposRes.state.data : [];
  const medicos = medicosRes.state.kind === "ok" ? medicosRes.state.data : [];
  return (
    <CitaModal
      open
      fecha={hoy}
      pacienteInicial={paciente}
      centroId={centro}
      tipos={tipos}
      medicos={medicos}
      onOpenChange={(o) => !o && onClose()}
      onSaved={onClose}
    />
  );
}
