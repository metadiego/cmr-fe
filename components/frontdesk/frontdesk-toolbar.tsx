"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";

import type { AccionTablero } from "@/lib/api/tablero";
import type { Centro } from "@/lib/api/centers";
import { ACCION_ICON } from "@/components/frontdesk/frontdesk-board.helpers";
import { NurseStatusButton } from "@/components/frontdesk/nurse-status-button";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// The single toolbar row of the Patient Center board (layout by view hierarchy, same shape as
// ListToolbar): LEFT = search, then the filters that narrow the view (date / range, center,
// "hide cancelled"); RIGHT (ml-auto) = actions, with the primary create action ("Citar") last.
// Purely presentational: the board owns every piece of state and every handler.
export function FrontdeskToolbar({
  search,
  fecha,
  onFecha,
  hasta,
  onHasta,
  puedeRango,
  centro,
  centros,
  puedeCambiarCentro,
  onCentro,
  ocultarCanceladas,
  onOcultarCanceladas,
  acciones,
  onAccion,
  onCitar,
  status,
}: {
  /** Search box (null while the center gate is not resolved; then "hide cancelled" is hidden too). */
  search: React.ReactNode;
  fecha: string;
  onFecha: (v: string) => void;
  hasta: string;
  onHasta: (v: string) => void;
  puedeRango: boolean;
  centro: string | undefined;
  centros: Centro[];
  puedeCambiarCentro: boolean;
  onCentro: (id: string) => void;
  ocultarCanceladas: boolean;
  onOcultarCanceladas: (v: boolean) => void;
  /** Pluggable toolbar action rail (tableros.acciones), already filtered and sorted. */
  acciones: AccionTablero[];
  onAccion: (a: AccionTablero) => void;
  /** Primary create action; undefined when the user cannot create appointments. */
  onCitar?: () => void;
  /** Live status widgets shown first in the action group (e.g. where each patient is right now). */
  status?: React.ReactNode;
}) {
  const t = useTranslations("frontdesk");
  const tRoot = useTranslations();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {search}
      <DatePicker className="w-40" value={fecha} onChange={onFecha} aria-label={t("fecha")} />
      {puedeRango && (
        <DatePicker
          className="w-40"
          value={hasta}
          min={fecha}
          onChange={onHasta}
          clearable
          aria-label={t("hasta")}
          title={t("rangoHint")}
        />
      )}
      {puedeCambiarCentro && centro && (
        <Select value={centro} onValueChange={onCentro}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {centros.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {/* Hide cancelled: ON by default. Turning it off brings back the day's cancelled rows with «Reactivar». */}
      {search && (
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={ocultarCanceladas} onCheckedChange={onOcultarCanceladas} aria-label={t("ocultarCanceladas")} />
          {t("ocultarCanceladas")}
        </label>
      )}

      <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
        {status}
        <NurseStatusButton fecha={fecha} centro={centro} />
        {/* Pluggable action RAIL (hooks): buttons are declared as data (tableros.acciones) and laid out by
            `orden`. The FE only paints those with a known handler (HANDLERS_FE). Plug/unplug = edit the
            registry (PUT /tableros). */}
        {acciones.map((a) => {
          const icon = ACCION_ICON[a.icon ?? ""];
          return (
            <Button key={a.clave} variant="outline" className="shrink-0" onClick={() => onAccion(a)}>
              {icon && <HugeiconsIcon icon={icon} data-icon="inline-start" />}
              {tRoot.has(a.labelKey) ? tRoot(a.labelKey) : a.clave}
            </Button>
          );
        })}
        {onCitar && <Button onClick={onCitar}>{t("citar")}</Button>}
      </div>
    </div>
  );
}
