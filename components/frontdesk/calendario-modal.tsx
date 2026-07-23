"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import {
  getAgendaPaciente,
  getAgendaHoras,
  type AgendaItem,
  type AgendaHora,
} from "@/lib/api/frontdesk";
import { buscarPaciente, type PacienteBusqueda } from "@/lib/api/facturas";
import { formatFechaSolo } from "@/lib/format/fecha";
import { useResource } from "@/hooks/use-resource";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";

// Calendario del tablero, en dos modos (handler abrir_calendario, params.modo):
//  - "paciente": agenda del paciente (sus citas coloreadas por servicio; GET /frontdesk/pacientes/:id/agenda).
//  - "dia": vista del día por hora con cupos del servicio activo (GET /frontdesk/agenda?servicio&fecha).
// Data-driven; ambos endpoints en prod. Sin hardcode.
export function CalendarioModal({
  open,
  onOpenChange,
  modo,
  centro,
  servicioClave,
  fecha,
  rangoDias = 90,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  modo: string;
  centro?: string;
  servicioClave?: string;
  fecha: string;
  rangoDias?: number;
}) {
  const t = useTranslations("frontdesk");
  const tc = useTranslations("common");
  const esDia = modo === "dia";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{esDia ? t("calDiaTitle") : t("calPacienteTitle")}</DialogTitle>
          <DialogDescription>{esDia ? formatFechaSolo(fecha) : t("calElegirPaciente")}</DialogDescription>
        </DialogHeader>
        {esDia ? (
          <DiaView centro={centro} servicioClave={servicioClave} fecha={fecha} t={t} tc={tc} />
        ) : (
          <PacienteView centro={centro} rangoDias={rangoDias} t={t} tc={tc} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DiaView({
  centro,
  servicioClave,
  fecha,
  t,
  tc,
}: {
  centro?: string;
  servicioClave?: string;
  fecha: string;
  t: ReturnType<typeof useTranslations>;
  tc: ReturnType<typeof useTranslations>;
}) {
  const res = useResource<AgendaHora[]>(
    () => (servicioClave ? getAgendaHoras(servicioClave, fecha, centro).then((r) => r.horas ?? []) : Promise.resolve([])),
    [servicioClave, fecha, centro],
  );
  const horas = res.state.kind === "ok" ? res.state.data : [];
  if (res.state.kind === "loading") return <p className="py-8 text-center text-sm text-muted-foreground">{tc("loading")}</p>;
  if (horas.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">{t("calSinHoras")}</p>;
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {horas.map((h) => {
        const lleno = h.vacios <= 0;
        return (
          <div
            key={h.hora}
            className={"rounded-lg border px-2 py-1.5 text-center " + (lleno ? "border-destructive/30 bg-destructive/5" : "border-emerald-500/30 bg-emerald-500/5")}
          >
            <div className="text-sm font-semibold tabular-nums">{h.hora}</div>
            <div className={"text-[11px] tabular-nums " + (lleno ? "text-destructive" : "text-emerald-700 dark:text-emerald-400")}>
              {t("calVacios", { vacios: h.vacios, cupo: h.cupo })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PacienteView({
  centro,
  rangoDias,
  t,
  tc,
}: {
  centro?: string;
  rangoDias: number;
  t: ReturnType<typeof useTranslations>;
  tc: ReturnType<typeof useTranslations>;
}) {
  const [sel, setSel] = React.useState<PacienteBusqueda | null>(null);
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => {
    const h = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(h);
  }, [q]);
  const term = debounced.trim();
  const busq = useResource<PacienteBusqueda[]>(
    () => (!sel && term.length >= 2 ? buscarPaciente(term, centro) : Promise.resolve([])),
    [sel, term, centro],
  );
  const resultados = busq.state.kind === "ok" ? busq.state.data : [];

  const hoy = React.useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const hasta = React.useMemo(() => {
    const [y, m, d] = hoy.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + rangoDias);
    return dt.toISOString().slice(0, 10);
  }, [hoy, rangoDias]);
  const agRes = useResource<AgendaItem[]>(
    () => (sel ? getAgendaPaciente(sel.id, hoy, hasta, centro) : Promise.resolve([])),
    [sel, hoy, hasta, centro],
  );
  const agenda = agRes.state.kind === "ok" ? agRes.state.data : [];

  if (!sel) {
    return (
      <div>
        <div className="flex items-center gap-2 rounded-md border px-3">
          <HugeiconsIcon icon={Search01Icon} className="size-4 opacity-60" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("buscarPh")} className="border-0 px-0 shadow-none focus-visible:ring-0" />
        </div>
        {term.length >= 2 && (
          <div className="mt-2 max-h-64 overflow-y-auto rounded-md border">
            {resultados.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("sinResultados")}</p>
            ) : (
              resultados.map((p) => (
                <button key={p.id} type="button" onClick={() => setSel(p)} className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-accent/50">
                  <span className="font-medium">{`${p.nombres ?? ""} ${p.apellidos ?? ""}`.trim() || "—"}</span>
                  {(p.record || p.telefono) && <span className="text-[11px] text-muted-foreground">{[p.record, p.telefono].filter(Boolean).join(" · ")}</span>}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{`${sel.nombres ?? ""} ${sel.apellidos ?? ""}`.trim()}</span>
        <button type="button" onClick={() => setSel(null)} className="text-xs font-medium text-primary hover:underline">{t("cambiar")}</button>
      </div>
      {agRes.state.kind === "loading" ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{tc("loading")}</p>
      ) : agenda.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("calSinCitas")}</p>
      ) : (
        <ul className="max-h-72 space-y-1.5 overflow-y-auto">
          {agenda.map((a, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
              <span className="tabular-nums">{formatFechaSolo(a.fecha)}</span>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
                style={a.color ? { backgroundColor: `${a.color}22`, color: a.color } : undefined}
              >
                {a.servicioNombre ?? "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
