"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import {
  getTableros,
  getDefinicion,
  getFilas,
  getOpciones,
  type TableroRegistro,
  type TableroDefinicion,
  type Tablero,
  type Opcion,
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
import { AccionesModal, type AccionItem } from "@/components/tablero/acciones-modal";
import { AgregarCitaModal } from "@/components/tablero/agregar-cita-modal";
import { readDensity, type Density } from "@/hooks/use-board-prefs";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";

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
  const { can } = useCan();
  const [adding, setAdding] = React.useState(false);

  const regRes = useResource<TableroRegistro[]>(() => getTableros());
  const registro = (regRes.state.kind === "ok" ? regRes.state.data : []).find((r) => r.clave === tablero);
  const defRes = useResource<TableroDefinicion>(() => getDefinicion(tablero), [tablero]);
  const def = defRes.state.kind === "ok" ? defRes.state.data : null;

  const centrosRes = useResource<Centro[]>(() => getMyCentros());
  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data : [];
  const [picked, setPicked] = React.useState<string | null>(null);
  const centroId = picked ?? defaultCentro(centros);

  // Options for editable `select` columns — TENANT-SCOPED (por centro), para que
  // solo aparezcan opciones válidas de ese centro (p.ej. médicos del centro).
  // Sin esto, el FE mostraba médicos de otros centros → al elegirlos no persistían.
  const [optionsByCol, setOptionsByCol] = React.useState<Record<string, Opcion[]>>({});
  React.useEffect(() => {
    const selects = (def?.columnas ?? []).filter((c) => c.tipo === "select" && c.editable);
    let active = true;
    Promise.all(
      selects.map((c) =>
        getOpciones(tablero, c.clave, centroId)
          .then((o) => [c.clave, o] as const)
          .catch(() => [c.clave, [] as Opcion[]] as const),
      ),
    ).then((pairs) => {
      if (active) setOptionsByCol(Object.fromEntries(pairs));
    });
    return () => {
      active = false;
    };
  }, [def, tablero, centroId]);

  // View density: read-only here (set in Settings › Tableros, persisted per user).
  // Read the persisted value AFTER mount to avoid an SSR/localStorage hydration
  // mismatch — the correct place for a one-time read from an external store.
  const [density, setDensity] = React.useState<Density>("comodo");
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of persisted pref
    setDensity(readDensity(tablero));
  }, [tablero]);
  // KPI filter: click a card to filter rows by estado.
  const [estadoFiltro, setEstadoFiltro] = React.useState<string>("");

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
    <div className="w-full px-6 py-6">
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
          {registro?.entidad === "cita" && can("citas.create") && centroId && (
            <Button size="sm" onClick={() => setAdding(true)}>{t("addCita")}</Button>
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

      {data && def && (() => {
        const counts = new Map<string, number>();
        for (const f of data.filas) {
          const e = String(f.estado ?? "");
          counts.set(e, (counts.get(e) ?? 0) + 1);
        }
        const kpiEstados = def.estados.filter((e) => (counts.get(e.clave) ?? 0) > 0);
        const filtered = estadoFiltro ? data.filas.filter((f) => String(f.estado ?? "") === estadoFiltro) : data.filas;
        return (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              <KpiCard label={t("all")} count={data.filas.length} active={estadoFiltro === ""} onClick={() => setEstadoFiltro("")} />
              {kpiEstados.map((e) => (
                <KpiCard
                  key={e.clave}
                  label={tRoot(e.labelKey)}
                  count={counts.get(e.clave) ?? 0}
                  color={e.color}
                  active={estadoFiltro === e.clave}
                  onClick={() => setEstadoFiltro(estadoFiltro === e.clave ? "" : e.clave)}
                />
              ))}
            </div>
            <TableroDinamico
              columnas={data.columnas}
              filas={filtered}
              tablero={tablero}
          centroId={centroId}
          onRefresh={filasRes.refresh}
          optionsByCol={optionsByCol}
          transiciones={def.transiciones}
          estados={def.estados}
          density={density}
          emptyLabel={t("empty")}
          renderAccion={(fila) =>
            registro?.entidad === "cita" ? (
              <AccionesModal
                actions={
                  ((data.columnas.find((c) => c.tipo === "accion")?.render as Record<string, unknown> | null)
                    ?.actions as AccionItem[] | undefined) ?? []
                }
                fila={fila}
                centroId={centroId}
              />
            ) : (
              <TableroAcciones
                tablero={tablero}
                entidadId={fila.id}
                estado={String(fila.estado ?? fila["estado"] ?? "")}
                estados={def.estados}
                transiciones={def.transiciones}
                centroId={centroId}
                onDone={filasRes.refresh}
              />
            )
          }
            />
          </>
        );
      })()}

      {adding && centroId && (
        <AgregarCitaModal
          tablero={tablero}
          centroId={centroId}
          onClose={() => setAdding(false)}
          onSaved={filasRes.refresh}
        />
      )}
    </div>
  );
}

function KpiCard({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color?: string | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "relative flex min-w-[7rem] flex-col gap-1 overflow-hidden rounded-xl border px-4 py-3 text-left transition-colors " +
        (active ? "border-primary/60 bg-primary/5" : "hover:border-primary/40")
      }
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color ?? "var(--muted-foreground)" }} />
      <span className="text-2xl font-bold tabular-nums leading-none">{count}</span>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
    </button>
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
