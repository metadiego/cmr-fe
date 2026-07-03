"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import {
  getTableros,
  getDefinicion,
  getFilas,
  type TableroRegistro,
  type TableroDefinicion,
  type Tablero,
} from "@/lib/api/tablero";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { getActiveCentro } from "@/lib/tenant";
import { useResource } from "@/hooks/use-resource";
import { useCitaStream } from "@/hooks/use-cita-stream";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableroDinamico } from "@/components/agenda/tablero-dinamico";
import { TableroAcciones } from "@/components/tablero/tablero-acciones";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function defaultCentro(centros: Centro[]): string {
  if (centros.length === 0) return "";
  const active = getActiveCentro();
  return active && centros.some((c) => c.id === active) ? active : centros[0].id;
}

// Fully generic board (any registered vertical). Driven by the registry +
// definicion (columns/estados/transiciones/subTipos) + filas. Live via the
// single bus, filtered by the vertical's `entidad`. Adding a vertical = config.
export function GenericBoard({ tablero }: { tablero: string }) {
  const t = useTranslations("tableroBoard");
  const tc = useTranslations("common");
  const tRoot = useTranslations();

  const regRes = useResource<TableroRegistro[]>(() => getTableros());
  const registro = (regRes.state.kind === "ok" ? regRes.state.data : []).find((r) => r.clave === tablero);
  const defRes = useResource<TableroDefinicion>(() => getDefinicion(tablero), [tablero]);
  const def = defRes.state.kind === "ok" ? defRes.state.data : null;

  const centrosRes = useResource<Centro[]>(() => getMyCentros());
  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data : [];
  const [picked, setPicked] = React.useState<string | null>(null);
  const centroId = picked ?? defaultCentro(centros);

  const [fecha, setFecha] = React.useState(todayISO());
  const [subTipo, setSubTipo] = React.useState<string>("");

  const filasRes = useResource<Tablero>(
    () => (centroId ? getFilas(tablero, fecha, { centroId, subTipo: subTipo || undefined }) : Promise.resolve({ columnas: [], filas: [] })),
    [tablero, fecha, centroId, subTipo],
  );
  const data = filasRes.state.kind === "ok" ? filasRes.state.data : null;

  const { live } = useCitaStream({
    centroId,
    entidad: registro?.entidad,
    enabled: !!centroId,
    onInvalidate: filasRes.refresh,
  });

  const subTipos = def?.subTipos ?? [];

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">
          {registro ? tRoot(registro.labelKey) : tablero}
        </h1>
        {live && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            {t("live")}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Input type="date" className="h-9 w-40" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          {centros.length > 1 && (
            <Select value={centroId} onValueChange={setPicked}>
              <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {centros.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {subTipos.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          <SubChip active={subTipo === ""} onClick={() => setSubTipo("")}>{t("all")}</SubChip>
          {subTipos.map((s) => (
            <SubChip key={s.clave} active={subTipo === s.clave} onClick={() => setSubTipo(s.clave)}>
              {tRoot(s.labelKey)}
            </SubChip>
          ))}
        </div>
      )}

      {(defRes.state.kind === "loading" || filasRes.state.kind === "loading") && (
        <p className="text-sm text-muted-foreground">{tc("loading")}</p>
      )}
      {filasRes.state.kind === "fail" && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {filasRes.state.message}
        </p>
      )}

      {data && def && (
        <TableroDinamico
          columnas={data.columnas}
          filas={data.filas}
          emptyLabel={t("empty")}
          renderAccion={(fila) => (
            <TableroAcciones
              tablero={tablero}
              entidadId={fila.id}
              estado={String(fila.estado ?? fila["estado"] ?? "")}
              estados={def.estados}
              transiciones={def.transiciones}
              centroId={centroId}
              onDone={filasRes.refresh}
            />
          )}
        />
      )}
    </div>
  );
}

function SubChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-md border px-3 py-1 text-sm transition-colors " +
        (active ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}
