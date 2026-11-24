"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";

import { listSesionesRango, type Sesion } from "@/lib/api/frontdesk";
import { getHistorialSesion } from "@/lib/api/frontdesk-eventos";
import { listCitasEnConsultaSinCerrar } from "@/lib/api/citas";
import { listPersonal } from "@/lib/api/personal";
import { inDaysPR, parseDayUTC } from "@/lib/format/fecha";
import { groupOverdue, type OverdueVisit } from "@/lib/frontdesk/overdue-visits";
import { useResource } from "@/hooks/use-resource";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";

// Pedido explícito del dueño (06-nov-2026): sesiones que quedaron "En terapia" de un día YA CERRADO
// (nunca pasaron a Asistido ni se cancelaron) nombran, en un banner del tablero, a quien las dejó así.
// El responsable NO es el enfermero/técnico asignado en el select de la fila: es el usuario LOGUEADO
// que hizo la transición — por eso se busca el `actorId` del evento "en_terapia" en el historial de
// cada sesión (`frontdesk_eventos`), no `nurseId`/`technicianId`. Corte: cualquier día ANTES de hoy.
async function quienLaDejoAsi(s: Sesion, centro?: string): Promise<string | null> {
  const eventos = await getHistorialSesion(s.id, centro);
  const enTerapia = eventos.filter((e) => e.type === "en_terapia");
  return enTerapia.length ? enTerapia[enTerapia.length - 1].actorId : null;
}

// 17-nov-2026: extendido a citas de Consulta dejadas "en_consulta" sin cerrar, mismo corte y misma
// ventana (BE #616) — un solo conteo combinado por persona responsable, misma pinta de banner.
// 24-nov-2026 (owner): each name is a button that lists that person's visits; a visit opens the desk
// on its own day with that patient selected, so it can be closed there with the desk's own cells.
export function EnTerapiaSinAsistirBanner({ centro, onOpenVisit }: { centro?: string; onOpenVisit?: (v: OverdueVisit) => void }) {
  const t = useTranslations("frontdesk");
  const format = useFormatter();
  const [openActor, setOpenActor] = React.useState<string | null>(null);
  const res = useResource(
    async () => {
      if (!centro) return null;
      const [sesiones, personal, consultaSinCerrar] = await Promise.all([
        listSesionesRango({ desde: inDaysPR(-30), hasta: inDaysPR(-1), centroId: centro }),
        listPersonal({ limit: 100 }, centro),
        listCitasEnConsultaSinCerrar({ days: 30, centroId: centro }),
      ]);
      const atrasadas = sesiones.filter((s) => s.status === "en_terapia");
      const actoresTerapia = await Promise.all(atrasadas.map((s) => quienLaDejoAsi(s, centro)));
      return { atrasadas, actoresTerapia, personal: personal.items, consultaSinCerrar };
    },
    [centro],
  );
  if (res.state.kind !== "ok" || !res.state.data) return null;
  const { atrasadas, actoresTerapia, personal, consultaSinCerrar } = res.state.data;

  const nombreDe = (id: string) => personal.find((p) => p.id === id)?.name ?? id;
  const grupos = groupOverdue(
    [
      ...atrasadas.map((s, i) => ({
        actorId: actoresTerapia[i],
        visit: { key: `s-${s.id}`, kind: "services" as const, date: s.date.slice(0, 10), patientId: s.patientId, patientName: s.patient?.name ?? null, serviceId: s.serviceId },
      })),
      ...consultaSinCerrar.map((c) => ({
        actorId: c.actorId,
        actorName: c.actorName,
        visit: { key: `c-${c.appointmentId}`, kind: "consultation" as const, date: c.date.slice(0, 10), patientId: c.patientId, patientName: c.patientName },
      })),
    ],
    nombreDe,
  );
  if (grupos.length === 0) return null;
  const abierto = grupos.find((g) => g.actorId === openActor) ?? null;

  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <HugeiconsIcon icon={Alert02Icon} className="size-4 shrink-0" />
        {grupos.map((g) => (
          <button
            key={g.actorId}
            type="button"
            aria-expanded={openActor === g.actorId}
            onClick={() => setOpenActor((a) => (a === g.actorId ? null : g.actorId))}
            className="inline-flex items-center gap-1 rounded text-left font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
          >
            {t("enTerapiaSinAsistir", { nombre: g.name, n: g.visits.length })}
            <HugeiconsIcon icon={openActor === g.actorId ? ArrowUp01Icon : ArrowDown01Icon} className="size-3.5 shrink-0" />
          </button>
        ))}
      </div>
      {abierto && (
        <ul className="mt-2 divide-y divide-destructive/20 border-t border-destructive/20">
          {abierto.visits.map((v) => (
            <li key={v.key}>
              <button
                type="button"
                disabled={!onOpenVisit}
                onClick={() => onOpenVisit?.(v)}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 rounded px-1 py-1.5 text-left text-foreground hover:bg-destructive/10 disabled:cursor-default"
              >
                <span className="w-32 shrink-0 text-xs text-muted-foreground tabular-nums">{format.dateTime(parseDayUTC(v.date) ?? new Date(v.date), "dayWeekdayShort")}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{v.patientName ?? "—"}</span>
                <span className="text-xs text-muted-foreground">{t(v.kind === "services" ? "sinAsistirTerapia" : "sinAsistirConsulta")}</span>
                {onOpenVisit && <span className="text-xs font-medium text-destructive">{t("sinAsistirAbrir")}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
