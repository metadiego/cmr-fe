"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { Cita, EstadoCita } from "@/lib/api/citas";
import { CitaActions } from "@/components/citas/cita-actions";

// Flow columns (left→right). States not listed (no_show/cancelada/reprogramada)
// fall into a trailing "closed" column so nothing is silently dropped.
const FLOW: EstadoCita[] = [
  "programada",
  "confirmada",
  "presente",
  "triage",
  "en_consulta",
  "atendida",
];

const DOT: Record<EstadoCita, string> = {
  programada: "bg-slate-400",
  confirmada: "bg-blue-500",
  presente: "bg-amber-500",
  triage: "bg-violet-500",
  en_consulta: "bg-indigo-500",
  atendida: "bg-emerald-500",
  no_show: "bg-rose-500",
  cancelada: "bg-zinc-400",
  reprogramada: "bg-orange-500",
};

export function CitaBoard({
  citas,
  pacienteName,
  tipoName,
  medicoName,
  onChanged,
}: {
  citas: Cita[];
  pacienteName: (id: string) => string;
  tipoName: (id: string) => string;
  medicoName: (id: string | null) => string;
  onChanged: () => void;
}) {
  const t = useTranslations("appointments");

  const closed = citas.filter((c) => !FLOW.includes(c.estado));
  const columns: { key: string; label: string; items: Cita[]; dot?: EstadoCita }[] =
    FLOW.map((e) => ({
      key: e,
      label: t(`estados.${e}`),
      dot: e,
      items: citas.filter((c) => c.estado === e),
    }));
  if (closed.length > 0) {
    columns.push({ key: "closed", label: t("boardClosed"), items: closed });
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((col) => (
        <div key={col.key} className="flex w-64 shrink-0 flex-col">
          <div className="mb-2 flex items-center gap-2 px-1 text-sm font-medium">
            {col.dot && <span className={`size-2 rounded-full ${DOT[col.dot]}`} />}
            <span>{col.label}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {col.items.length}
            </span>
          </div>
          <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-2">
            {col.items.length === 0 && (
              <p className="px-1 py-3 text-center text-xs text-muted-foreground">
                {t("boardEmpty")}
              </p>
            )}
            {col.items
              .slice()
              .sort((a, b) => (a.hora ?? "99").localeCompare(b.hora ?? "99"))
              .map((c) => (
                <div
                  key={c.id}
                  className="rounded-md border bg-card p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {c.hora ?? "—"}
                    </span>
                    <CitaActions cita={c} onChanged={onChanged} />
                  </div>
                  <p className="mt-1 truncate text-sm font-medium">
                    {pacienteName(c.pacienteId)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {tipoName(c.tipoCitaId)}
                    {c.medicoId ? ` · ${medicoName(c.medicoId)}` : ""}
                  </p>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
