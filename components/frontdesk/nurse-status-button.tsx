"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { StethoscopeIcon, Cancel01Icon } from "@hugeicons/core-free-icons";

import {
  getNurseStatusTipos,
  getNurseStatusActuales,
  setNurseStatus,
  type NurseStatusTipo,
  type NurseStatusActual,
} from "@/lib/api/frontdesk";
import { listPersonalPorCapacidad } from "@/lib/api/personal";
import { toastError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Botón "Estatus de enfermera" COMPARTIDO (frontdesk + panel de enfermería): trigger con burbuja roja =
// cuántas enfermeras tienen estatus AHORA, y un modal para ponerlo/quitarlo. La parrilla recorre el
// CATÁLOGO `nurse_status_tipos` (GET /frontdesk/nurse-status/tipos) con el color de cada uno — NO sale de
// los servicios ni de una lista escrita a mano; un estatus nuevo aparece solo. El desplegable de enfermera
// usa el roster por capacidad (agnóstico al tablero). Escribe por POST /frontdesk/nurse-status (append-only,
// null = reset/disponible). Handoff HANDOFF-estatus-de-enfermera.
export function NurseStatusButton({
  centro,
  fecha,
  onChanged,
}: {
  centro?: string;
  fecha?: string;
  onChanged?: () => void;
}) {
  const t = useTranslations("frontdesk");
  const tRoot = useTranslations();
  const fechaEf = fecha ?? isoDay(new Date());
  const [open, setOpen] = React.useState(false);
  const [tipos, setTipos] = React.useState<NurseStatusTipo[] | null>(null);
  const [roster, setRoster] = React.useState<{ id: string; nombre: string }[]>([]);
  const [actuales, setActuales] = React.useState<NurseStatusActual[]>([]);
  const [sel, setSel] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [gen, setGen] = React.useState(0);

  // El estatus VIVO se pide siempre (para la burbuja), aunque el modal esté cerrado; refresca tras poner/quitar.
  React.useEffect(() => {
    if (!centro) return;
    let active = true;
    getNurseStatusActuales(fechaEf, centro).then((a) => active && setActuales(a)).catch(() => active && setActuales([]));
    return () => { active = false; };
  }, [centro, fechaEf, gen]);

  // Catálogo + roster: solo al abrir (no se necesitan para la burbuja).
  React.useEffect(() => {
    if (!open || !centro) return;
    getNurseStatusTipos(centro).then(setTipos).catch(() => setTipos([]));
    listPersonalPorCapacidad("enfermera", centro)
      .then((list) => setRoster(list.map((p) => ({ id: p.id, nombre: `${p.name} ${p.lastName ?? ""}`.trim() }))))
      .catch(() => setRoster([]));
  }, [open, centro, gen]);

  const conStatus = actuales.filter((a) => a.statusTypeId);
  const count = conStatus.length;
  const tipoById = React.useMemo(() => new Map((tipos ?? []).map((x) => [x.id, x])), [tipos]);
  const tipoLabel = (x: NurseStatusTipo) => (tRoot.has(x.labelKey) ? tRoot(x.labelKey) : x.name);
  const nombreDe = (a: NurseStatusActual) => a.personalNombre ?? roster.find((r) => r.id === a.staffId)?.nombre ?? a.staffId.slice(0, 8);

  async function aplicar(personalId: string, statusTipoId: string | null) {
    if (!personalId) return;
    setBusy(true);
    try {
      await setNurseStatus({ staffId: personalId, statusTypeId: statusTipoId ?? undefined }, centro);
      setGen((g) => g + 1);
      onChanged?.();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative gap-1.5">
          <HugeiconsIcon icon={StethoscopeIcon} className="size-4" />
          {t("nurseTitle")}
          {count > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-4 text-white">
              {count}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-96 p-4">
        <SheetHeader className="p-0">
          <SheetTitle>{t("nurseTitle")}</SheetTitle>
        </SheetHeader>

        {/* Elegir enfermera + parrilla de estatus del catálogo (color del catálogo, data-driven). */}
        <div className="mt-4 space-y-3">
          <select
            value={sel}
            onChange={(e) => setSel(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">{t("nurseElegir")}</option>
            {roster.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[...(tipos ?? [])]
              .filter((x) => x.active !== false)
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((x) => (
                <button
                  key={x.id}
                  type="button"
                  disabled={!sel || busy}
                  onClick={() => aplicar(sel, x.id)}
                  className="rounded-md border px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
                  style={x.color ? { borderColor: x.color, color: x.color } : undefined}
                >
                  {tipoLabel(x)}
                </button>
              ))}
          </div>
          <button
            type="button"
            disabled={!sel || busy}
            onClick={() => aplicar(sel, null)}
            className="w-full rounded-md border px-2 py-1.5 text-sm font-medium disabled:opacity-40"
          >
            {t("nurseReset")}
          </button>
        </div>

        {/* Estatus actuales: cada uno con su color y una equis para quitarlo de un toque. */}
        <p className="mb-1 mt-5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("nurseActuales")}</p>
        {conStatus.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("nurseEmpty")}</p>
        ) : (
          <ul className="space-y-1">
            {conStatus.map((a) => {
              const tipo = a.statusTypeId ? tipoById.get(a.statusTypeId) : undefined;
              const color = tipo?.color ?? null;
              const label = tipo ? tipoLabel(tipo) : a.statusTypeId ?? "";
              return (
                <li key={a.staffId} className="flex items-center justify-between gap-2 rounded-md bg-card px-2 py-1.5 text-sm ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
                  <span className="min-w-0 truncate">{nombreDe(a)}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={color ? { backgroundColor: `${color}22`, color } : undefined}>
                      {label}
                    </span>
                    <button type="button" disabled={busy} onClick={() => aplicar(a.staffId, null)} aria-label={tRoot("common.remove")} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                      <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
