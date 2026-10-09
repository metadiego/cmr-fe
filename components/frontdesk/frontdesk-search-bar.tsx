"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, Cancel01Icon, Mic01Icon, MicOff01Icon } from "@hugeicons/core-free-icons";

import type { PacienteBusqueda } from "@/lib/api/facturas";
import type { ResourceState } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  onPick: (p: PacienteBusqueda) => void;
  onClear: () => void;
}) {
  const t = useTranslations("frontdesk");
  // Rendered as the first item of FrontdeskToolbar's single row (no row wrapper of its own).
  return pacienteFiltro ? (
    <div className="flex min-h-9 min-w-0 flex-1 flex-wrap items-center gap-2 rounded-md bg-primary/5 px-3 py-0.5 ring-1 ring-primary/30">
      <HugeiconsIcon icon={Search01Icon} className="size-4 shrink-0 text-primary" />
      <span className="text-sm">
        {t("viendoPaciente")} <span className="font-semibold">{nombre}</span>
      </span>
      <Button variant="outline" size="sm" className="ml-auto" onClick={onClear}>
        <HugeiconsIcon icon={Cancel01Icon} data-icon="inline-start" />
        {t("volverAlDia")}
      </Button>
    </div>
  ) : (
    <div className="relative w-full sm:max-w-sm">
      <HugeiconsIcon icon={Search01Icon} className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => onQ(e.target.value)}
        placeholder={t("filtrarPacientePh")}
        className={"pl-8 " + (dictado.soportado ? "pr-16" : "pr-9")}
        aria-label={t("filtrarPacientePh")}
      />
      {/* Restablecer el filtro en vivo (handoff HANDOFF-filtro-en-vivo-reciproco-consulta-servicios):
          un clic rápido para volver a ver TODAS las filas sin recargar la página. */}
      {q && (
        <button
          type="button"
          onClick={() => onQ("")}
          aria-label={t("limpiarBusqueda")}
          title={t("limpiarBusqueda")}
          className={
            "absolute top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground " +
            (dictado.soportado ? "right-8" : "right-1.5")
          }
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
        </button>
      )}
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
  );
}
