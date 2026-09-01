"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { Cita } from "@/lib/api/citas";
import { useEstados } from "@/hooks/use-estados";
import { CitaActions } from "@/components/citas/cita-actions";

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
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const { estados, ready } = useEstados();

  // Flow columns come from the catalog (non-terminal, ordered). Terminal states
  // (no_show/cancelada/reprogramada/atendida) fall into a trailing "closed"
  // column so nothing is silently dropped. Colors/labels are catalog-driven.
  const flow = estados
    .filter((e) => !e.esTerminal)
    .sort((a, b) => a.orden - b.orden);
  const flowClaves = new Set(flow.map((e) => e.clave));
  const closed = citas.filter((c) => !flowClaves.has(c.estado));
  const columns: { key: string; label: string; color?: string; items: Cita[] }[] =
    flow.map((e) => ({
      key: e.clave,
      label: tRoot(e.labelKey),
      color: e.color,
      items: citas.filter((c) => c.estado === e.clave),
    }));
  if (closed.length > 0) {
    columns.push({ key: "closed", label: t("boardClosed"), items: closed });
  }

  if (!ready) {
    return <p className="px-1 py-3 text-sm text-muted-foreground">{tc("loading")}</p>;
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((col) => (
        <div key={col.key} className="flex w-64 shrink-0 flex-col">
          <div className="mb-2 flex items-center gap-2 px-1 text-sm font-medium">
            {col.color && (
              <span className="size-2 rounded-full" style={{ backgroundColor: col.color }} />
            )}
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
                  className="rounded-md bg-card p-3 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]"
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
