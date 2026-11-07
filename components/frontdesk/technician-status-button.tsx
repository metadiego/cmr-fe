"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserSquareIcon } from "@hugeicons/core-free-icons";

import { getFrontdeskQueue, type FrontdeskQueue } from "@/lib/api/frontdesk-queue";
import {
  getNurseStatusTipos,
  getNurseStatusActuales,
  setNurseStatus,
  type NurseStatusTipo,
  type NurseStatusActual,
} from "@/lib/api/frontdesk";
import { toastError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip } from "@/components/ui/tooltip";

const MINUTOS_RAPIDOS = [10, 15, 30] as const;
const horaDe = (iso: string) => new Date(iso).toLocaleTimeString("es-PR", { hour: "2-digit", minute: "2-digit" });

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
  const tRoot = useTranslations();
  const [open, setOpen] = React.useState(false);
  const [queue, setQueue] = React.useState<FrontdeskQueue | null>(null);
  const [tipos, setTipos] = React.useState<NurseStatusTipo[]>([]);
  const [actuales, setActuales] = React.useState<NurseStatusActual[]>([]);
  const [sel, setSel] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [gen, setGen] = React.useState(0);

  React.useEffect(() => {
    if (!centro) return;
    let active = true;
    getFrontdeskQueue(fecha, undefined, centro).then((q) => active && setQueue(q)).catch(() => active && setQueue(null));
    return () => { active = false; };
  }, [centro, fecha, open]);

  React.useEffect(() => {
    if (!open || !centro) return;
    getNurseStatusTipos(centro).then(setTipos).catch(() => setTipos([]));
    getNurseStatusActuales(fecha, centro).then(setActuales).catch(() => setActuales([]));
  }, [open, centro, fecha, gen]);

  const { libres, ocupados, activosHoy } = React.useMemo(() => {
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
    return { libres, ocupados: [...ocupadosMap.entries()].map(([id, v]) => ({ id, ...v })), activosHoy };
  }, [queue]);

  // "Descanso" (BE PR #498, 06-nov-2026, desplegado): un estatus más del mismo catálogo de
  // nurse-status, ahora con caducidad — el tipo `break` ya cuenta como "no disponible". Se ofrece
  // solo a quien está activo hoy (mismo roster que libres/ocupados), nunca a todo el personal.
  const breakTipo = tipos.find((x) => x.slug === "break");
  const enDescanso = breakTipo ? actuales.filter((a) => a.statusTypeId === breakTipo.id) : [];
  const nombreDe = (id: string) => activosHoy.get(id) ?? id.slice(0, 8);

  async function ponerDescanso(minutos: number) {
    if (!sel || !breakTipo) return;
    setBusy(true);
    try {
      await setNurseStatus({ staffId: sel, statusTypeId: breakTipo.id, durationMinutes: minutos }, centro);
      setSel("");
      setGen((g) => g + 1);
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  async function quitarDescanso(staffId: string) {
    setBusy(true);
    try {
      await setNurseStatus({ staffId, statusTypeId: null }, centro);
      setGen((g) => g + 1);
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  const descansoIds = new Set(enDescanso.map((a) => a.staffId));
  const libresDisponibles = libres.filter((p) => !descansoIds.has(p.id));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Tooltip content={t("tecnicosTitle")}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="relative" aria-label={t("tecnicosTitle")}>
            <HugeiconsIcon icon={UserSquareIcon} className="size-4" />
            {libresDisponibles.length > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold leading-4 text-white">
                {libresDisponibles.length}
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
          {breakTipo && (
            <div className="space-y-2 rounded-md border p-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("tecnicosDescanso")}</p>
              <select value={sel} onChange={(e) => setSel(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm">
                <option value="">{t("tecnicosElegir")}</option>
                {[...activosHoy.entries()].filter(([id]) => !descansoIds.has(id)).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
              <div className="flex gap-1.5">
                {MINUTOS_RAPIDOS.map((m) => (
                  <button key={m} type="button" disabled={!sel || busy} onClick={() => ponerDescanso(m)} className="flex-1 rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-40">
                    {t("tecnicosMinutos", { n: m })}
                  </button>
                ))}
              </div>
              {enDescanso.length > 0 && (
                <ul className="space-y-1 pt-1">
                  {enDescanso.map((a) => (
                    <li key={a.staffId} className="flex items-center justify-between gap-2 rounded-md bg-card px-2 py-1 text-sm ring-1 ring-foreground/10">
                      <span className="truncate">{a.personalNombre ?? nombreDe(a.staffId)}</span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                        {a.expiresAt ? t("tecnicosHasta", { hora: horaDe(a.expiresAt) }) : ""}
                        <button type="button" disabled={busy} onClick={() => quitarDescanso(a.staffId)} className="text-muted-foreground hover:text-foreground">✕</button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("tecnicosLibres")}</p>
            {libresDisponibles.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("tecnicosEmpty")}</p>
            ) : (
              <ul className="space-y-1">
                {libresDisponibles.map((p) => (
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
