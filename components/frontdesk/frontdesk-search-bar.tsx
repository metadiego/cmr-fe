"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, Cancel01Icon, Mic01Icon, MicOff01Icon } from "@hugeicons/core-free-icons";

import type { PacienteBusqueda } from "@/lib/api/facturas";
import type { ResourceState } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

// Barra de búsqueda ÚNICA del frontdesk (presentacional; el board conserva el estado porque `q`/`pacienteIds`
// también filtran las FILAS). Una sola caja nombre/record/teléfono con dictado → desplegable de pacientes;
// elegir uno deja las pestañas con SUS servicios del día (banner + «Volver al día»). Antes había DOS cajas
// casi iguales y confundían. El desplegable SIEMPRE da señal (buscando / error / sin resultados EN EL CENTRO
// / lista) porque la búsqueda es por el centro activo (X-Tenant-ID); por eso se nombra el centro.
export function FrontdeskSearchBar({
  pacienteFiltro,
  nombre,
  q,
  onQ,
  mostrarLista,
  estado,
  resultados,
  centroNombre,
  dictado,
  ocultarCanceladas,
  onOcultarCanceladas,
  onPick,
  onClear,
}: {
  pacienteFiltro: PacienteBusqueda | null;
  nombre: string;
  q: string;
  onQ: (v: string) => void;
  mostrarLista: boolean;
  estado: ResourceState<PacienteBusqueda[]>;
  resultados: PacienteBusqueda[];
  centroNombre: string;
  dictado: { soportado: boolean; escuchando: boolean; toggle: () => void };
  ocultarCanceladas: boolean;
  onOcultarCanceladas: (v: boolean) => void;
  onPick: (p: PacienteBusqueda) => void;
  onClear: () => void;
}) {
  const t = useTranslations("frontdesk");
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {pacienteFiltro ? (
        <div className="flex flex-1 flex-wrap items-center gap-2 rounded-md bg-primary/5 px-3 py-2 ring-1 ring-primary/30">
          <HugeiconsIcon icon={Search01Icon} className="size-4 shrink-0 text-primary" />
          <span className="text-sm">
            {t("viendoPaciente")} <span className="font-semibold">{nombre}</span>
          </span>
          <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={onClear}>
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
            {t("volverAlDia")}
          </Button>
        </div>
      ) : (
        <div className="relative w-full max-w-md">
          <HugeiconsIcon icon={Search01Icon} className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => onQ(e.target.value)}
            placeholder={t("filtrarPacientePh")}
            className="h-9 pl-8 pr-9"
            aria-label={t("filtrarPacientePh")}
          />
          {dictado.soportado && (
            <button
              type="button"
              onClick={dictado.toggle}
              aria-label={t("dictado")}
              className={
                "absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 transition-colors " +
                (dictado.escuchando
                  ? "bg-destructive/15 text-destructive animate-pulse"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground")
              }
            >
              <HugeiconsIcon icon={dictado.escuchando ? MicOff01Icon : Mic01Icon} className="size-4" />
            </button>
          )}
          {mostrarLista && (
            <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-lg">
              {estado.kind === "loading" ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">{t("buscando")}</p>
              ) : estado.kind === "fail" ? (
                <p className="px-3 py-2 text-sm text-destructive">{estado.message}</p>
              ) : resultados.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  {t("sinResultadosEnCentro", { centro: centroNombre || "—" })}
                </p>
              ) : (
                resultados.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onPick(p)}
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-accent/50"
                  >
                    <span className="font-medium">{(p.displayName || `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim()) || "—"}</span>
                    {(p.medicalRecordNumber || p.phone) && (
                      <span className="text-[11px] text-muted-foreground">{[p.medicalRecordNumber, p.phone].filter(Boolean).join(" · ")}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
      {/* Ocultar canceladas: encendido por defecto. Apagarlo trae las del día con su «Reactivar». */}
      <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <Switch checked={ocultarCanceladas} onCheckedChange={onOcultarCanceladas} aria-label={t("ocultarCanceladas")} />
        {t("ocultarCanceladas")}
      </label>
    </div>
  );
}
