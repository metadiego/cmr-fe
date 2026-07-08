"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import {
  getCatalogoPrescripcion,
  getPrescripcionCita,
  setPrescripcionCelda,
  setNoPrescripcion,
  type GrupoPrescripcion,
} from "@/lib/api/prescripcion";
import { toastError } from "@/lib/api/errors";
import { useCan } from "@/hooks/use-can";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

// Sección de PRESCRIPCIÓN del modal Nueva cita. Se auto-fetchea y se OCULTA si el
// catálogo viene vacío/404 (plug-and-play, BE PR #36). Escribe por celda (upsert
// debounced); el BE deriva `checked` de la cantidad y sella paciente/médico/día/usuario.
export function PrescripcionGrid({ citaId, centroId }: { citaId: string; centroId?: string }) {
  const t = useTranslations("prescripcion");
  const tRoot = useTranslations();
  const { can } = useCan();
  const canWrite = can("prescripcion.write");

  const [grupos, setGrupos] = React.useState<GrupoPrescripcion[]>([]);
  const [cant, setCant] = React.useState<Record<string, number>>({});
  const [none, setNone] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const timers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  React.useEffect(() => {
    let active = true;
    Promise.all([getCatalogoPrescripcion(centroId), getPrescripcionCita(citaId, centroId)])
      .then(([cat, pc]) => {
        if (!active) return;
        setGrupos([...(cat.grupos ?? [])].sort((a, b) => a.orden - b.orden));
        setCant(pc.registros ?? {});
        setNone(!!pc.noPrescripcion);
        setReady(true);
      })
      .catch(() => active && setReady(true)); // error → ready sin grupos → oculto
    return () => {
      active = false;
    };
  }, [citaId, centroId]);

  function change(clave: string, raw: string) {
    const val = Math.max(0, Math.floor(Number(raw) || 0));
    setCant((c) => ({ ...c, [clave]: val }));
    clearTimeout(timers.current[clave]);
    timers.current[clave] = setTimeout(() => {
      setPrescripcionCelda(citaId, clave, val, centroId).catch((err) => toastError(err, tRoot));
    }, 500);
  }

  function toggleNone(on: boolean) {
    setNone(on);
    setNoPrescripcion(citaId, on, centroId).catch((err) => toastError(err, tRoot));
  }

  if (!ready || grupos.length === 0) return null; // plug-and-play

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("title")}</span>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Checkbox checked={none} onCheckedChange={(v) => toggleNone(v === true)} disabled={!canWrite} />
          {t("none")}
        </label>
      </div>
      <div
        className={
          "grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto rounded-lg border bg-muted/20 p-2 " +
          (none ? "pointer-events-none opacity-40" : "")
        }
      >
        {grupos.map((g) => {
          const v = cant[g.clave] ?? 0;
          const on = v > 0;
          return (
            <div
              key={g.clave}
              className={
                "flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 transition-colors " +
                (on ? "border-primary/50 bg-primary/5" : "border-transparent")
              }
            >
              <span className={"truncate text-xs font-medium " + (on ? "text-foreground" : "text-muted-foreground")} title={tRoot(g.labelKey)}>
                {tRoot(g.labelKey)}
              </span>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={v === 0 ? "" : String(v)}
                onChange={(e) => change(g.clave, e.target.value)}
                disabled={!canWrite}
                className="h-7 w-14 shrink-0 px-1.5 text-center tabular-nums"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
