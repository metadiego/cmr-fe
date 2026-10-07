"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { getHistorialPaciente, type HistorialSesion } from "@/lib/api/frontdesk";
import { formatFechaSolo } from "@/lib/format/fecha";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Modal "historial del paciente" (extraído de fila-sesion.tsx): sesiones anteriores en ESTE
// servicio, con fecha/estado/quién la hizo. Disparado desde el menú de acciones de la fila.
export function HistorialModal({
  open,
  onOpenChange,
  pacienteId,
  pacienteNombre,
  servicioId,
  servicioNombre,
  centro,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pacienteId: string;
  pacienteNombre: string;
  servicioId?: string;
  servicioNombre?: string;
  centro?: string;
}) {
  const t = useTranslations("frontdesk");
  const tc = useTranslations("common");
  // Estado atado a la petición (key): evita setState síncrono en el efecto (solo se setea en el async).
  const key = open ? `${pacienteId}|${servicioId ?? ""}|${centro ?? ""}` : "";
  const [data, setData] = React.useState<{ key: string; rows: HistorialSesion[] } | null>(null);
  const [failKey, setFailKey] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    let cancel = false;
    getHistorialPaciente(pacienteId, servicioId, centro)
      .then((r) => {
        if (!cancel) setData({ key, rows: r.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))) });
      })
      .catch(() => {
        if (!cancel) setFailKey(key);
      });
    return () => {
      cancel = true;
    };
  }, [open, pacienteId, servicioId, centro, key]);

  const rows = data && data.key === key ? data.rows : null;
  const fallo = failKey === key && key !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b bg-muted/40 px-5 py-4">
          <DialogTitle>{t("histTitle")}</DialogTitle>
          <DialogDescription>
            {pacienteNombre}{servicioNombre ? ` · ${servicioNombre}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto">
          {rows == null && !fallo && <p className="px-5 py-10 text-center text-sm text-muted-foreground">{tc("loading")}</p>}
          {fallo && <p className="px-5 py-10 text-center text-sm text-destructive">{tc("error")}</p>}
          {rows != null && rows.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted-foreground">{t("histEmpty")}</p>}
          {rows != null && rows.length > 0 && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60">
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2 font-semibold">{t("histFecha")}</th>
                  <th className="px-3 py-2 font-semibold">{t("histEstado")}</th>
                  <th className="px-3 py-2 font-semibold">{t("histDetalle")}</th>
                  <th className="px-5 py-2 font-semibold">{t("histStaff")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="whitespace-nowrap px-5 py-2.5 tabular-nums">{formatFechaSolo(r.date) || "—"}</td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant="secondary"
                        className={r.status === "asistido" ? "bg-success text-success-foreground" : undefined}
                      >
                        {t.has(`histEstadoVal.${r.status}`) ? t(`histEstadoVal.${r.status}`) : (r.status || "—")}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-medium">{r.serviceName ?? "—"}</span>
                      <span className="block text-xs text-muted-foreground">
                        {t("histSesion")}: {r.sesionNumero != null && r.totalSessions != null ? `${r.sesionNumero}/${r.totalSessions}` : "—"}
                        {r.areas != null ? ` · ${t("histAreas")}: ${r.areas}` : ""}
                      </span>
                    </td>
                    <td className="px-5 py-2.5">
                      {r.staffNombre ? (
                        <Badge variant="secondary" className="bg-sky-500/15 text-sky-700 dark:text-sky-300">{r.staffNombre}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ————— Modal "Compras" del paciente (columna fd_compras, BE PR #205/#206, paridad legacy) —————
// Dos bloques hermanos del "Historial de terapias": arriba lo COMPRADO el día del tablero, abajo el
// historial completo con entregadas/pendientes (cuánto le queda), y una tira de totales. `null` en la
// celda = sin compras ese día, pero el historial existe igual. Contrato: HANDOFF-columna-carrito-compras.
