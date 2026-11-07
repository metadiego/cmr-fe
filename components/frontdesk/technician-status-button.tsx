"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserSquareIcon } from "@hugeicons/core-free-icons";

import { getFrontdeskQueue, type FrontdeskQueue } from "@/lib/api/frontdesk-queue";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip } from "@/components/ui/tooltip";

// Ícono "Técnicos": libre/en terapia AHORA, derivado de la misma cola que ya alimenta
// therapy-queue-strip.tsx (GET /frontdesk/queue) — sin estado propio, sin pedir nada nuevo al BE.
// A PROPÓSITO no se usa `onShift` (el roster por CAPACIDAD configurada): trae relleno de catálogo
// (p. ej. "noaplica", un registro legado activo pero sin ser una persona real) y personal que puede
// hacer el servicio pero no está trabajando hoy. El dueño pidió (06-nov-2026) contar SOLO a quien
// realmente tiene un paciente hoy: ocupado = tiene algo en `inTherapy`; libre = ya le asignaron
// alguien (`waiting[].technicianId`, llamado) pero no está en terapia ahora mismo. El roster completo
// (todo el personal con la capacidad, esté o no activo hoy) queda para una iteración aparte.
// "Descanso" (manual, con auto-expiración por minutos) queda pendiente de BE — ver
// docs/specs/estatus-tecnicos-libre-ocupado-descanso-handoff-be.md.
export function TechnicianStatusButton({ centro, fecha }: { centro?: string; fecha: string }) {
  const t = useTranslations("frontdesk");
  const [open, setOpen] = React.useState(false);
  const [queue, setQueue] = React.useState<FrontdeskQueue | null>(null);

  React.useEffect(() => {
    if (!centro) return;
    let active = true;
    getFrontdeskQueue(fecha, undefined, centro).then((q) => active && setQueue(q)).catch(() => active && setQueue(null));
    return () => { active = false; };
  }, [centro, fecha, open]);

  const { libres, ocupados } = React.useMemo(() => {
    const ocupadosMap = new Map<string, { name: string; servicio: string }>();
    const activosHoy = new Map<string, string>();
    for (const s of queue?.services ?? []) {
      for (const p of s.inTherapy) {
        if (!p.technicianId) continue;
        activosHoy.set(p.technicianId, p.technicianName ?? p.technicianId.slice(0, 8));
        if (!ocupadosMap.has(p.technicianId)) {
          ocupadosMap.set(p.technicianId, { name: p.technicianName ?? p.technicianId.slice(0, 8), servicio: s.name });
        }
      }
      for (const w of s.waiting) {
        if (w.technicianId) activosHoy.set(w.technicianId, w.technicianName ?? w.technicianId.slice(0, 8));
      }
    }
    const libres = [...activosHoy.entries()].filter(([id]) => !ocupadosMap.has(id)).map(([id, name]) => ({ id, name }));
    return { libres, ocupados: [...ocupadosMap.entries()].map(([id, v]) => ({ id, ...v })) };
  }, [queue]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Tooltip content={t("tecnicosTitle")}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="relative" aria-label={t("tecnicosTitle")}>
            <HugeiconsIcon icon={UserSquareIcon} className="size-4" />
            {libres.length > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold leading-4 text-white">
                {libres.length}
              </span>
            )}
          </Button>
        </SheetTrigger>
      </Tooltip>
      <SheetContent side="right" className="w-96 p-4">
        <SheetHeader className="p-0">
          <SheetTitle>{t("tecnicosTitle")}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("tecnicosLibres")}</p>
            {libres.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("tecnicosEmpty")}</p>
            ) : (
              <ul className="space-y-1">
                {libres.map((p) => (
                  <li key={p.id} className="rounded-md bg-card px-2 py-1.5 text-sm ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">{p.name}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("tecnicosEnTerapia")}</p>
            {ocupados.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("tecnicosEmpty")}</p>
            ) : (
              <ul className="space-y-1">
                {ocupados.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 rounded-md bg-card px-2 py-1.5 text-sm ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
                    <span>{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.servicio}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
