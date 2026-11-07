"use client";

import { useTranslations } from "next-intl";

import { listSesionesRango, type Sesion } from "@/lib/api/frontdesk";
import { getHistorialSesion } from "@/lib/api/frontdesk-eventos";
import { listPersonal } from "@/lib/api/personal";
import { inDaysPR } from "@/lib/format/fecha";
import { useResource } from "@/hooks/use-resource";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon } from "@hugeicons/core-free-icons";

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

export function EnTerapiaSinAsistirBanner({ centro }: { centro?: string }) {
  const t = useTranslations("frontdesk");
  const res = useResource(
    async () => {
      if (!centro) return null;
      const [sesiones, personal] = await Promise.all([
        listSesionesRango({ desde: inDaysPR(-30), hasta: inDaysPR(-1), centroId: centro }),
        listPersonal({ limit: 100 }, centro),
      ]);
      const atrasadas = sesiones.filter((s) => s.status === "en_terapia");
      const actores = await Promise.all(atrasadas.map((s) => quienLaDejoAsi(s, centro)));
      return { actores, personal: personal.items };
    },
    [centro],
  );
  if (res.state.kind !== "ok" || !res.state.data) return null;
  const { actores, personal } = res.state.data;

  const nombreDe = (id: string) => personal.find((p) => p.id === id)?.name ?? id;
  const conteos = new Map<string, number>();
  for (const actorId of actores) if (actorId) conteos.set(actorId, (conteos.get(actorId) ?? 0) + 1);
  if (conteos.size === 0) return null;
  const filas = [...conteos.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
      <HugeiconsIcon icon={Alert02Icon} className="size-4 shrink-0" />
      {filas.map(([id, n]) => (
        <span key={id} className="font-medium">{t("enTerapiaSinAsistir", { nombre: nombreDe(id), n })}</span>
      ))}
    </div>
  );
}
