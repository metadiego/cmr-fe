"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";

import { listCitas, getTiposCita, type Cita, type TipoCita } from "@/lib/api/citas";
import { getHistorialPaciente, type HistorialSesion } from "@/lib/api/frontdesk";
import { getResumenPaciente, type ResumenPaciente } from "@/lib/api/facturas";
import { useResource } from "@/hooks/use-resource";
import { parseDayUTC } from "@/lib/format/fecha";
import { Badge } from "@/components/ui/badge";

// Pestañas de la ficha (hub): listas simples FECHA · TIPO/CONCEPTO · ESTADO, cada una llamando SOLO a
// su endpoint (nada de recomponer lo que el BE ya suma). Extraídas de la página para mantenerla bajo el
// techo. Handoff ficha-del-paciente-hub-y-certificacion-de-gastos.
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function useDia() {
  const format = useFormatter();
  return (iso?: string | null) => {
    if (!iso) return "—";
    const d = parseDayUTC(iso);
    return d ? format.dateTime(d, "dayMonthYear") : String(iso);
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
  const citasRes = useResource<{ items: Cita[] }>(() => listCitas({ patientId: pacienteId, limit: 100 }, centro), [pacienteId, centro]);
  const tiposRes = useResource<TipoCita[]>(() => getTiposCita());
  const citas = citasRes.state.kind === "ok" ? citasRes.state.data.items : [];
  const tipos = tiposRes.state.kind === "ok" ? tiposRes.state.data : [];
  const tipoNombre = (id?: string | null) => tipos.find((x) => x.id === id)?.name ?? "—";
  if (citasRes.state.kind === "loading") return <Vacio texto={t("loading")} />;
  if (citasRes.state.kind === "fail") return <p className="text-sm text-destructive">{citasRes.state.message}</p>;
  if (citas.length === 0) return <Vacio texto={t("noCitas")} />;
  return (
    <Tabla head={<tr><Th>{t("date")}</Th><Th>{t("type")}</Th><Th>{t("status")}</Th></tr>}>
      {citas.map((c) => (
        <tr key={c.id} className="border-t">
          <Td>{dia(c.date)}{c.time ? ` · ${c.time}` : ""}</Td>
          <Td>{tipoNombre(c.appointmentTypeId)}</Td>
          <Td><Estado value={c.status} /></Td>
        </tr>
      ))}
    </Tabla>
  );
}

export function FichaTerapias({ pacienteId, centro }: { pacienteId: string; centro?: string }) {
  const t = useTranslations("patients.hub");
  const dia = useDia();
  const res = useResource<HistorialSesion[]>(() => getHistorialPaciente(pacienteId, undefined, centro), [pacienteId, centro]);
  const hist = res.state.kind === "ok" ? res.state.data : [];
  if (res.state.kind === "loading") return <Vacio texto={t("loading")} />;
  if (res.state.kind === "fail") return <p className="text-sm text-destructive">{res.state.message}</p>;
  if (hist.length === 0) return <Vacio texto={t("noTerapias")} />;
  return (
    <Tabla head={<tr><Th>{t("date")}</Th><Th>{t("service")}</Th><Th>{t("session")}</Th><Th>{t("status")}</Th></tr>}>
      {hist.map((s) => (
        <tr key={s.id} className="border-t">
          <Td>{dia(s.date)}</Td>
          <Td>{s.servicioNombre ?? "—"}</Td>
          <Td className="tabular-nums text-muted-foreground">{s.sesionNumero != null && s.totalSessions != null ? `${s.sesionNumero}/${s.totalSessions}` : "—"}</Td>
          <Td><Estado value={s.status} /></Td>
        </tr>
      ))}
    </Tabla>
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
