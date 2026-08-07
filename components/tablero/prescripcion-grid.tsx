"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import {
  getRecetables,
  getPrescripcionCita,
  setPrescripcionCelda,
  setNoPrescripcion,
  type Recetable,
} from "@/lib/api/prescripcion";
import { toastError } from "@/lib/api/errors";
import { useCan } from "@/hooks/use-can";
import { Input } from "@/components/ui/input";

// Sección de PRESCRIPCIÓN del modal Nueva cita. Se auto-fetchea y se OCULTA si el
// catálogo viene vacío/404 (plug-and-play, BE PR #36). Escribe por celda (upsert
// debounced); el BE deriva `checked` de la cantidad y sella paciente/médico/día/usuario.
// `onValidity` reporta al modal si está RESUELTA (algún grupo>0 o "sin prescripción")
// para que el modal bloquee la finalización cuando es obligatoria.
export function PrescripcionGrid({
  citaId,
  centroId,
  onValidity,
}: {
  citaId: string;
  centroId?: string;
  onValidity?: (ok: boolean) => void;
}) {
  const t = useTranslations("prescripcion");
  const tRoot = useTranslations();
  const { can } = useCan();
  const canWrite = can("prescripcion.write");

  // Filas RECETABLES del catálogo vivo (BE #275). Se pintan en el orden que vienen (ya ordenadas por
  // nombre); nada de reordenar ni de lista de respaldo — esa lista paralela era justo el problema.
  const [grupos, setGrupos] = React.useState<Recetable[]>([]);
  const [cant, setCant] = React.useState<Record<string, number>>({});
  const [none, setNone] = React.useState(false);
  const [resuelto, setResuelto] = React.useState(false); // autoridad del BE
  const [ready, setReady] = React.useState(false);
  const timers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  React.useEffect(() => {
    let active = true;
    Promise.all([getRecetables(centroId), getPrescripcionCita(citaId, centroId)])
      .then(([recetables, pc]) => {
        if (!active) return;
        setGrupos(recetables ?? []);
        setCant(pc.registros ?? {});
        setNone(!!pc.noPrescripcion);
        setResuelto(!!pc.resuelto);
        setReady(true);
      })
      .catch(() => active && setReady(true)); // error → ready sin filas → oculto
    return () => {
      active = false;
    };
  }, [citaId, centroId]);

  // Re-sincroniza con el BE tras escribir: el servidor dueña la exclusión mutua
  // (marcar cantidad apaga NO_PRESCRIPCION; marcar "sin prescripción" limpia grupos)
  // y el `resuelto`. Consumimos esa verdad en vez de re-derivarla.
  const resync = React.useCallback(() => {
    getPrescripcionCita(citaId, centroId)
      .then((pc) => {
        setCant(pc.registros ?? {});
        setNone(!!pc.noPrescripcion);
        setResuelto(!!pc.resuelto);
      })
      .catch(() => {});
  }, [citaId, centroId]);

  // Reporta al modal la validez (autoridad = `resuelto`). Oculta/sin catálogo = no aplica.
  React.useEffect(() => {
    if (!onValidity) return;
    onValidity(!ready || grupos.length === 0 ? true : resuelto);
  }, [ready, grupos, resuelto, onValidity]);

  function change(clave: string, raw: string) {
    const val = Math.max(0, Math.floor(Number(raw) || 0));
    setCant((c) => {
      const next = { ...c, [clave]: val };
      // optimista: cantidad>0 apaga "sin prescripción" (como hará el BE).
      setResuelto(none && val <= 0 ? true : val > 0 || Object.values(next).some((x) => x > 0) || none);
      return next;
    });
    if (val > 0) setNone(false);
    clearTimeout(timers.current[clave]);
    timers.current[clave] = setTimeout(() => {
      setPrescripcionCelda(citaId, clave, val, centroId).then(resync).catch((err) => toastError(err, tRoot));
    }, 500);
  }

  function toggleNone(on: boolean) {
    setNone(on);
    if (on) setCant({}); // optimista: el BE limpia los grupos
    setResuelto(on || Object.values(cant).some((v) => v > 0));
    setNoPrescripcion(citaId, on, centroId).then(resync).catch((err) => toastError(err, tRoot));
  }

  if (!ready || grupos.length === 0) return null; // plug-and-play

  const resuelta = resuelto;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("title")}</span>
        <button
          type="button"
          onClick={() => toggleNone(!none)}
          disabled={!canWrite}
          aria-pressed={none}
          className={
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 " +
            (none
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input text-muted-foreground hover:border-primary/50 hover:text-foreground")
          }
        >
          {t("none")}
        </button>
      </div>
      <div
        className={
          "grid grid-cols-2 gap-1.5 rounded-lg border bg-muted/20 p-2 " +
          (none ? "pointer-events-none opacity-40" : "")
        }
      >
        {grupos.map((g) => {
          const v = cant[g.servicioClave] ?? 0;
          const on = v > 0;
          return (
            <div
              key={g.servicioClave}
              className={
                "flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 transition-colors " +
                (on ? "border-primary/50 bg-primary/5" : "border-transparent")
              }
            >
              {/* Nombre TAL CUAL del catálogo (acentos correctos): no se traduce ni se recorta. */}
              <span className={"truncate text-xs font-medium " + (on ? "text-foreground" : "text-muted-foreground")} title={g.nombre}>
                {g.nombre}
              </span>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={v === 0 ? "" : String(v)}
                onChange={(e) => change(g.servicioClave, e.target.value)}
                disabled={!canWrite}
                className="h-7 w-14 shrink-0 px-1.5 text-center tabular-nums"
              />
            </div>
          );
        })}
      </div>
      {!resuelta && (
        <p className="text-xs text-amber-600 dark:text-amber-400">{t("required")}</p>
      )}
    </div>
  );
}
