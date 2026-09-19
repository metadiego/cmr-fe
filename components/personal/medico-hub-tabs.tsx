"use client";

import * as React from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";

import { listCitas, listCitasRango, getTiposCita, type Cita, type TipoCita } from "@/lib/api/citas";
import { listPacientes, type Paciente } from "@/lib/api/pacientes";
import { useResource } from "@/hooks/use-resource";
import { parseDayUTC } from "@/lib/format/fecha";
import { Badge } from "@/components/ui/badge";

// Pestañas del hub del médico: Agenda (sus citas), Pacientes (los suyos + conteo) y Producción
// (estadísticas compuestas de endpoints reales: nº de pacientes + citas del año). Cada una llama SOLO
// a su endpoint. Handoff ficha-del-medico-hub.
function anio(): { from: string; to: string } {
  const y = new Date().getFullYear();
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}
function useDia() {
  const format = useFormatter();
  return (iso?: string | null) => {
    if (!iso) return "—";
    const d = parseDayUTC(iso);
    return d ? format.dateTime(d, "dayMonthYear") : String(iso);
  };
}
function Vacio({ t }: { t: string }) {
  return <p className="rounded-md bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">{t}</p>;
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
function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md bg-card px-4 py-3 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function MedicoAgenda({ doctorId, centro }: { doctorId: string; centro?: string }) {
  const t = useTranslations("medicoHub");
  const dia = useDia();
  const citasRes = useResource<{ items: Cita[] }>(() => listCitas({ doctorId, limit: 100 }, centro), [doctorId, centro]);
  const tiposRes = useResource<TipoCita[]>(() => getTiposCita());
  const citas = citasRes.state.kind === "ok" ? citasRes.state.data.items : [];
  const tipos = tiposRes.state.kind === "ok" ? tiposRes.state.data : [];
  const tipoNombre = (id?: string | null) => tipos.find((x) => x.id === id)?.name ?? "—";
  if (citasRes.state.kind === "loading") return <Vacio t={t("loading")} />;
  if (citasRes.state.kind === "fail") return <p className="text-sm text-destructive">{citasRes.state.message}</p>;
  if (citas.length === 0) return <Vacio t={t("noCitas")} />;
  return (
    <Tabla head={<tr><Th>{t("date")}</Th><Th>{t("type")}</Th><Th>{t("status")}</Th></tr>}>
      {citas.map((c) => (
        <tr key={c.id} className="border-t">
          <Td>{dia(c.date)}{c.time ? ` · ${c.time}` : ""}</Td>
          <Td>{tipoNombre(c.appointmentTypeId)}</Td>
          <Td><Badge variant="secondary">{c.status}</Badge></Td>
        </tr>
      ))}
    </Tabla>
  );
}

export function MedicoPacientes({ doctorId, centro }: { doctorId: string; centro?: string }) {
  const t = useTranslations("medicoHub");
  const res = useResource<{ items: Paciente[]; pagination: { total: number } }>(
    () => listPacientes({ doctorId, limit: 50 }, centro),
    [doctorId, centro],
  );
  const items = res.state.kind === "ok" ? res.state.data.items : [];
  const total = res.state.kind === "ok" ? res.state.data.pagination.total : 0;
  if (res.state.kind === "loading") return <Vacio t={t("loading")} />;
  if (res.state.kind === "fail") return <p className="text-sm text-destructive">{res.state.message}</p>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Kpi label={t("patients")} value={total} /></div>
      {items.length === 0 ? (
        <Vacio t={t("noPatients")} />
      ) : (
        <Tabla head={<tr><Th>{t("record")}</Th><Th>{t("name")}</Th><Th>{t("phone")}</Th></tr>}>
          {items.map((p) => (
            <tr key={p.id} className="border-t">
              <Td className="tabular-nums">{p.medicalRecordNumber ?? "—"}</Td>
              <Td><Link href={`/patients/${p.id}`} className="text-primary hover:underline">{p.displayName || [p.firstName, p.lastName].filter(Boolean).join(" ")}</Link></Td>
              <Td className="text-muted-foreground">{p.phone ?? "—"}</Td>
            </tr>
          ))}
        </Tabla>
      )}
      {total > items.length && <p className="text-xs text-muted-foreground">{t("showingFirst", { n: items.length, total })}</p>}
    </div>
  );
}

export function MedicoProduccion({ doctorId, centro }: { doctorId: string; centro?: string }) {
  const t = useTranslations("medicoHub");
  const { from, to } = React.useMemo(() => anio(), []);
  const pacRes = useResource<{ pagination: { total: number } }>(() => listPacientes({ doctorId, limit: 1 }, centro), [doctorId, centro]);
  const citasRes = useResource<Cita[]>(() => listCitasRango({ doctorId, from, to, centroId: centro }), [doctorId, from, to, centro]);
  const totalPac = pacRes.state.kind === "ok" ? pacRes.state.data.pagination.total : 0;
  const citas = citasRes.state.kind === "ok" ? citasRes.state.data : [];
  const atendidas = citas.filter((c) => c.status === "atendida").length;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("productionYear", { year: new Date().getFullYear() })}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label={t("patients")} value={totalPac} />
        <Kpi label={t("apptsYear")} value={citasRes.state.kind === "ok" ? citas.length : "…"} />
        <Kpi label={t("attended")} value={citasRes.state.kind === "ok" ? atendidas : "…"} />
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-medium">{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={"px-3 py-2 " + (className ?? "")}>{children}</td>;
}
