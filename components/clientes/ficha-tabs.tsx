"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { listCitas, getTiposCita, type Cita, type TipoCita } from "@/lib/api/citas";
import { getMedicos, type Personal } from "@/lib/api/personal";
import { getHistorialPaciente, type HistorialSesion } from "@/lib/api/frontdesk";
import { getResumenPaciente, type ResumenPaciente } from "@/lib/api/facturas";
import { useResource } from "@/hooks/use-resource";
import { parseDayUTC } from "@/lib/format/fecha";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HistorialDialog } from "@/components/citas/cita-actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Pestañas de la ficha (hub): listas simples FECHA · TIPO/CONCEPTO · ESTADO, cada una llamando SOLO a
// su endpoint (nada de recomponer lo que el BE ya suma). Extraídas de la página para mantenerla bajo el
// techo. Handoff ficha-del-paciente-hub-y-certificacion-de-gastos.
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// Fecha con el MES PRIMERO (negocio USA/PR), igual en es y en: MM/DD/YYYY. Locale EXPLÍCITO en-US a
// propósito (permitido por la norma 3b) porque los formatos con nombre siguen el orden del locale y en
// español pondrían el día primero. UTC + parseDayUTC: un día del BE es un día, no un instante.
const fechaMesPrimero = new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", year: "numeric", timeZone: "UTC" });

function useDia() {
  return (iso?: string | null) => {
    if (!iso) return "—";
    const d = parseDayUTC(iso);
    return d ? fechaMesPrimero.format(d) : String(iso);
  };
}

function Estado({ value }: { value?: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return <Badge variant="secondary">{value}</Badge>;
}

function Vacio({ texto }: { texto: string }) {
  return <p className="rounded-md bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">{texto}</p>;
}

function Tabla({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">{head}</thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function FichaCitas({ pacienteId, centro }: { pacienteId: string; centro?: string }) {
  const t = useTranslations("patients.hub");
  const dia = useDia();
  const [histOpen, setHistOpen] = React.useState(false);
  const citasRes = useResource<{ items: Cita[] }>(() => listCitas({ patientId: pacienteId, limit: 100 }, centro), [pacienteId, centro]);
  const tiposRes = useResource<TipoCita[]>(() => getTiposCita());
  // La cita solo trae `doctorId` (CitaEntity no incluye el nombre); se resuelve con el roster de médicos
  // del centro. Un médico de otro centro no estará en la lista → cae a guion (no se inventa nada).
  const medicosRes = useResource<Personal[]>(() => getMedicos(centro), [centro]);
  const citas = citasRes.state.kind === "ok" ? citasRes.state.data.items : [];
  const tipos = tiposRes.state.kind === "ok" ? tiposRes.state.data : [];
  const medicos = medicosRes.state.kind === "ok" ? medicosRes.state.data : [];
  const tipoNombre = (id?: string | null) => tipos.find((x) => x.id === id)?.name ?? "—";
  const medicoNombre = (id?: string | null) => {
    const m = medicos.find((x) => x.id === id);
    return m ? [m.name, m.lastName].filter(Boolean).join(" ").trim() || "—" : "—";
  };
  // Más reciente primero: por fecha y, a igualdad, por hora (ambas descendentes).
  const citasOrdenadas = [...citas].sort((a, b) =>
    `${b.date ?? ""} ${b.time ?? ""}`.localeCompare(`${a.date ?? ""} ${a.time ?? ""}`),
  );
  if (citasRes.state.kind === "loading") return <Vacio texto={t("loading")} />;
  if (citasRes.state.kind === "fail") return <p className="text-sm text-destructive">{citasRes.state.message}</p>;
  if (citas.length === 0) return <Vacio texto={t("noCitas")} />;
  return (
    <div className="space-y-3">
      {/* El rastro de reagendamientos NO se lista aquí (el BE ya no devuelve las `reprogramada`): va detrás
          de este botón. Handoff be-citas-el-rastro-va-detras-de-un-boton. */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setHistOpen(true)}>{t("historialReagendamientos")}</Button>
      </div>
      <Tabla head={<tr><Th>{t("date")}</Th><Th>{t("type")}</Th><Th>{t("doctor")}</Th><Th>{t("status")}</Th></tr>}>
        {citasOrdenadas.map((c) => (
          <tr key={c.id} className="border-t">
            <Td>{dia(c.date)}{c.time ? ` · ${c.time}` : ""}</Td>
            <Td>{tipoNombre(c.appointmentTypeId)}</Td>
            <Td>{medicoNombre(c.doctorId)}</Td>
            <Td><Estado value={c.status} /></Td>
          </tr>
        ))}
      </Tabla>
      {histOpen && <ReagendamientosDialog pacienteId={pacienteId} centro={centro} onClose={() => setHistOpen(false)} />}
    </div>
  );
}

// Modal con las citas REPROGRAMADAS del paciente (fecha, hora, motivo). Cada una abre su traza completa
// antes→después reusando HistorialDialog. GET /appointments?patientId&status=reprogramada.
function ReagendamientosDialog({ pacienteId, centro, onClose }: { pacienteId: string; centro?: string; onClose: () => void }) {
  const t = useTranslations("patients.hub");
  const tc = useTranslations("common");
  const dia = useDia();
  const res = useResource<{ items: Cita[] }>(
    () => listCitas({ patientId: pacienteId, status: "reprogramada", limit: 100 }, centro),
    [pacienteId, centro],
  );
  const [trace, setTrace] = React.useState<Cita | null>(null);
  const items = res.state.kind === "ok" ? res.state.data.items : [];
  const ordenadas = [...items].sort((a, b) => `${b.date ?? ""} ${b.time ?? ""}`.localeCompare(`${a.date ?? ""} ${a.time ?? ""}`));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("historialReagendamientos")}</DialogTitle>
        </DialogHeader>
        {res.state.kind === "loading" && <p className="text-sm text-muted-foreground">{tc("loading")}</p>}
        {res.state.kind === "fail" && <p className="text-sm text-destructive">{res.state.message}</p>}
        {res.state.kind === "ok" && ordenadas.length === 0 && (
          <p className="rounded-md bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">{t("noReagendamientos")}</p>
        )}
        <ol className="space-y-2">
          {ordenadas.map((c) => (
            <li key={c.id} className="rounded-md bg-card p-3 text-sm ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium tabular-nums">{dia(c.date)}{c.time ? ` · ${c.time}` : ""}</span>
                <button type="button" onClick={() => setTrace(c)} className="text-xs font-medium text-primary hover:underline">{t("verRastro")}</button>
              </div>
              {c.reason && <p className="mt-1 text-xs text-muted-foreground">{c.reason}</p>}
            </li>
          ))}
        </ol>
        {trace && <HistorialDialog cita={trace} onClose={() => setTrace(null)} />}
      </DialogContent>
    </Dialog>
  );
}

export function FichaTerapias({ pacienteId, centro }: { pacienteId: string; centro?: string }) {
  const t = useTranslations("patients.hub");
  const dia = useDia();
  const [filtro, setFiltro] = React.useState<string>(""); // "" = todos; si no, serviceId/nombre
  const res = useResource<HistorialSesion[]>(() => getHistorialPaciente(pacienteId, undefined, centro), [pacienteId, centro]);
  const hist = res.state.kind === "ok" ? res.state.data : [];
  // Más reciente primero.
  const ordenado = [...hist].sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
  // El filtro SOLO ofrece los servicios que el paciente YA tiene (nada de listar los que no filtrarían).
  const claveServicio = (s: HistorialSesion) => s.serviceId ?? s.serviceName ?? "";
  const servicios = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const s of hist) {
      const k = claveServicio(s);
      if (k) m.set(k, s.serviceName ?? k);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [hist]);
  const filtrado = filtro ? ordenado.filter((s) => claveServicio(s) === filtro) : ordenado;

  if (res.state.kind === "loading") return <Vacio texto={t("loading")} />;
  if (res.state.kind === "fail") return <p className="text-sm text-destructive">{res.state.message}</p>;
  if (hist.length === 0) return <Vacio texto={t("noTerapias")} />;
  return (
    <div className="space-y-3">
      {/* Filtro por servicio: solo aparece si hay más de uno (con uno solo no filtra nada). */}
      {servicios.length > 1 && (
        <div className="flex justify-end">
          <Select value={filtro || "__all__"} onValueChange={(v) => setFiltro(v === "__all__" ? "" : v)}>
            <SelectTrigger className="h-9 w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("allServices")}</SelectItem>
              {servicios.map(([k, nombre]) => (
                <SelectItem key={k} value={k}>{nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Tabla head={<tr><Th>{t("date")}</Th><Th>{t("service")}</Th><Th>{t("session")}</Th><Th>{t("technician")}</Th><Th>{t("status")}</Th></tr>}>
        {filtrado.map((s) => (
          <tr key={s.id} className="border-t">
            <Td>{dia(s.date)}</Td>
            <Td>{s.serviceName ?? "—"}</Td>
            <Td className="tabular-nums text-muted-foreground">{s.sesionNumero != null && s.totalSessions != null ? `${s.sesionNumero}/${s.totalSessions}` : "—"}</Td>
            <Td>{s.staffNombre ?? "—"}</Td>
            <Td><Estado value={s.status} /></Td>
          </tr>
        ))}
      </Tabla>
    </div>
  );
}

export function FichaFacturacion({ pacienteId, centro }: { pacienteId: string; centro?: string }) {
  const t = useTranslations("patients.hub");
  const tRoot = useTranslations();
  const res = useResource<ResumenPaciente>(() => getResumenPaciente(pacienteId, undefined, centro), [pacienteId, centro]);
  const data = res.state.kind === "ok" ? res.state.data : null;
  const invoices = data?.invoices ?? [];
  const concepto = (keys?: string[]) =>
    (keys ?? []).map((k) => (tRoot.has(k) ? tRoot(k) : k)).join(", ") || "—";
  if (res.state.kind === "loading") return <Vacio texto={t("loading")} />;
  if (res.state.kind === "fail") return <p className="text-sm text-destructive">{res.state.message}</p>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label={t("total")} value={money.format(data?.totalGeneral ?? 0)} />
        <Kpi label={t("collected")} value={money.format(data?.totalCobrado ?? 0)} />
        <Kpi label={t("pending")} value={money.format(data?.totalPendiente ?? 0)} />
        <Kpi label={t("refunded")} value={money.format(data?.totalDevuelto ?? 0)} />
      </div>
      {invoices.length === 0 ? (
        <Vacio texto={t("noFacturas")} />
      ) : (
        <Tabla head={<tr><Th>{t("invoice")}</Th><Th>{t("concept")}</Th><Th>{t("status")}</Th><Th right>{t("net")}</Th></tr>}>
          {invoices.map((f) => (
            <tr key={f.id} className={"border-t " + (f.cuenta ? "" : "opacity-60")}>
              <Td className="font-mono">{f.reference}</Td>
              <Td>{concepto(f.conceptoLabelKeys)}</Td>
              <Td><Estado value={f.status} /></Td>
              <Td className="text-right font-medium tabular-nums">{money.format(f.neto ?? 0)}</Td>
            </tr>
          ))}
        </Tabla>
      )}
    </div>
  );
}

// Tarjeta «Última visita» del Resumen: la cita más reciente del paciente (por fecha). Reusa listCitas.
export function FichaUltimaVisita({ pacienteId, centro }: { pacienteId: string; centro?: string }) {
  const t = useTranslations("patients.hub");
  const dia = useDia();
  const citasRes = useResource<{ items: Cita[] }>(() => listCitas({ patientId: pacienteId, limit: 100 }, centro), [pacienteId, centro]);
  const tiposRes = useResource<TipoCita[]>(() => getTiposCita());
  const citas = citasRes.state.kind === "ok" ? citasRes.state.data.items : [];
  const tipos = tiposRes.state.kind === "ok" ? tiposRes.state.data : [];
  const ultima = [...citas]
    .filter((c) => c.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  const tipoNombre = (id?: string | null) => tipos.find((x) => x.id === id)?.name ?? "—";
  return (
    <div className="rounded-md bg-card px-4 py-3 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("lastVisit")}</div>
      {ultima ? (
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3">
          <span className="font-medium">{tipoNombre(ultima.appointmentTypeId)}</span>
          <span className="text-sm text-muted-foreground">{dia(ultima.date)}{ultima.time ? ` · ${ultima.time}` : ""}</span>
          <Estado value={ultima.status} />
        </div>
      ) : (
        <div className="mt-0.5 text-sm text-muted-foreground">{t("noLastVisit")}</div>
      )}
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={"px-3 py-2 font-medium " + (right ? "text-right" : "text-left")}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={"px-3 py-2 " + (className ?? "")}>{children}</td>;
}
function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-card px-3 py-2 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
