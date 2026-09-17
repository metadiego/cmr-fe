"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";

import { buscarPaciente, type PacienteBusqueda } from "@/lib/api/facturas";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Barra "Filtrar por paciente" del tablero de frontdesk. Extraída de frontdesk-board.tsx (techo de
// tamaño) y dueña de SU búsqueda: al elegir a alguien deja solo sus servicios del día (el padre cruza
// la agenda). El desplegable SIEMPRE da señal (buscando / error / sin resultados EN EL CENTRO / lista)
// — antes solo aparecía con ≥1 resultado, así que buscar a un paciente de otro centro se quedaba mudo
// y parecía roto. La búsqueda está acotada al centro activo (X-Tenant-ID); por eso se nombra el centro.
export function FiltroPacienteBar({
  pacienteFiltro,
  centro,
  centroNombre,
  onSelect,
  onClear,
}: {
  pacienteFiltro: PacienteBusqueda | null;
  centro?: string;
  centroNombre: string;
  onSelect: (p: PacienteBusqueda) => void;
  onClear: () => void;
}) {
  const t = useTranslations("frontdesk");
  const [q, setQ] = React.useState("");
  const [qDeb, setQDeb] = React.useState("");
  React.useEffect(() => {
    const h = setTimeout(() => setQDeb(q), 250);
    return () => clearTimeout(h);
  }, [q]);
  const busq = useResource<PacienteBusqueda[]>(
    () => (!pacienteFiltro && qDeb.trim().length >= 2 ? buscarPaciente(qDeb.trim(), centro) : Promise.resolve([])),
    [pacienteFiltro, qDeb, centro],
  );
  const resultados = busq.state.kind === "ok" ? busq.state.data : [];
  const nombre = pacienteFiltro
    ? pacienteFiltro.displayName || `${pacienteFiltro.firstName ?? ""} ${pacienteFiltro.lastName ?? ""}`.trim()
    : "";

  if (pacienteFiltro) {
    return (
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md bg-primary/5 px-3 py-2 ring-1 ring-primary/30">
        <HugeiconsIcon icon={Search01Icon} className="size-4 shrink-0 text-primary" />
        <span className="text-sm">
          {t("viendoPaciente")} <span className="font-semibold">{nombre}</span>
        </span>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto gap-1.5"
          onClick={() => { setQ(""); onClear(); }}
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          {t("volverAlDia")}
        </Button>
      </div>
    );
  }

  return (
    <div className="relative mb-3 w-full max-w-sm">
      <HugeiconsIcon icon={Search01Icon} className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("filtrarPacientePh")}
        className="h-9 pl-8"
        aria-label={t("filtrarPacientePh")}
      />
      {qDeb.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-lg">
          {busq.state.kind === "loading" ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">{t("buscando")}</p>
          ) : busq.state.kind === "fail" ? (
            <p className="px-3 py-2 text-sm text-destructive">{busq.state.message}</p>
          ) : resultados.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              {t("sinResultadosEnCentro", { centro: centroNombre || "—" })}
            </p>
          ) : (
            resultados.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setQ(""); onSelect(p); }}
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
