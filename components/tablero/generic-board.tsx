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
import { cn } from "@/lib/utils";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Segmented, SegmentedButton } from "@/components/ui/segmented";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  const registro = (regRes.state.kind === "ok" ? regRes.state.data : []).find((r) => r.slug === tablero);
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
    const selects = (def?.columns ?? []).filter((c) => c.tipo === "select" && c.editable);
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

  // subTipo va al server CUANDO está elegido (tableros como `servicios` lo EXIGEN — cada tab es un
  // servicio) y ADEMÁS se filtra client-side por `fila.subtipo` (BE PR #125) para los tableros donde el
  // server no lo aplica (atencion: Nueva/Seguimiento). Ambas capas son idempotentes entre sí.
  const filasRes = useResource<Tablero>(
    () => (centroId ? getFilas(tablero, fecha, { centroId, subTipo: subTipo || undefined }) : Promise.resolve({ columns: [], rows: [] })),
    [tablero, fecha, centroId, subTipo],
  );
  const data = filasRes.state.kind === "ok" ? filasRes.state.data : null;

  const { live } = useCitaStream({
    centroId,
    entidad: registro?.entity,
    enabled: !!centroId,
    onInvalidate: filasRes.refresh,
  });

  const subTipos = React.useMemo(() => def?.subtypes ?? [], [def]);

  // Self-heal: tableros que EXIGEN subTipo (p. ej. servicios: cada tab es un servicio) responden 400 en
  // "Todos" → auto-selecciona el primer subtipo en vez de dejar el error rojo. Data-driven por el mensaje
  // del BE; los tableros que aceptan "Todos" (atencion) nunca entran aquí.
  const failMsg = filasRes.state.kind === "fail" ? filasRes.state.message : "";
  React.useEffect(() => {
    if (!failMsg || subTipo || subTipos.length === 0) return;
    if (!/subtipo/i.test(failMsg)) return;
    const h = setTimeout(() => setSubTipo(subTipos[0].slug), 0);
    return () => clearTimeout(h);
  }, [failMsg, subTipo, subTipos]);

  return (
    <PageContainer>
      <PageHeader
        title={registro ? tRoot(registro.labelKey) : tablero}
        actions={
          <>
            {live && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success-foreground">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-success-foreground opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-success-foreground" />
                </span>
                {t("live")}
              </span>
            )}
            <Input type="date" className="h-9 w-40" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            {centros.length > 1 && (
              <Select value={centroId} onValueChange={setPicked}>
                <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {centros.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {registro?.entity === "cita" && can("citas.create") && centroId && (
              <Button size="sm" onClick={() => setAdding(true)}>{t("addCita")}</Button>
            )}
          </>
        }
      />

      {subTipos.length > 0 && (
        <Segmented>
          <SegmentedButton active={subTipo === ""} onClick={() => setSubTipo("")}>
            {t("all")}
          </SegmentedButton>
          {subTipos.map((s) => (
            <SegmentedButton key={s.slug} active={subTipo === s.slug} onClick={() => setSubTipo(s.slug)}>
              {tRoot(s.labelKey)}
            </SegmentedButton>
          ))}
        </Segmented>
      )}

      {(defRes.state.kind === "loading" || filasRes.state.kind === "loading") && (
        <p className="text-sm text-muted-foreground">{tc("loading")}</p>
      )}
      {filasRes.state.kind === "fail" && (
        <Alert variant="destructive">
          <AlertDescription>{filasRes.state.message}</AlertDescription>
        </Alert>
      )}

      {data && def && (() => {
        // 1º el tab de subtipo (Nueva/Seguimiento) acota el set; los KPI de estado se cuentan sobre ese set.
        const base = subTipo
          ? data.rows.filter((f) => String((f as { subtipo?: unknown }).subtipo ?? "") === subTipo)
          : data.rows;
        const counts = new Map<string, number>();
        for (const f of base) {
          const e = String(f.estado ?? "");
          counts.set(e, (counts.get(e) ?? 0) + 1);
        }
        const kpiEstados = def.statuses.filter((e) => (counts.get(e.slug) ?? 0) > 0);
        const filtered = estadoFiltro ? base.filter((f) => String(f.estado ?? "") === estadoFiltro) : base;
        return (
          <>
            <div className="flex flex-wrap gap-2">
              <KpiCard label={t("all")} count={base.length} active={estadoFiltro === ""} onClick={() => setEstadoFiltro("")} />
              {kpiEstados.map((e) => (
                <KpiCard
                  key={e.slug}
                  label={tRoot(e.labelKey)}
                  count={counts.get(e.slug) ?? 0}
                  color={e.color}
                  active={estadoFiltro === e.slug}
                  onClick={() => setEstadoFiltro(estadoFiltro === e.slug ? "" : e.slug)}
                />
              ))}
            </div>
            <TableroDinamico
              columnas={data.columns}
              filas={filtered}
              tablero={tablero}
          centroId={centroId}
          onRefresh={filasRes.refresh}
          optionsByCol={optionsByCol}
          transiciones={def.transitions}
          estados={def.statuses.map((e) => ({ clave: e.slug, orden: e.sortOrder, color: e.color }))}
          density={density}
          emptyLabel={t("empty")}
          renderAccion={(fila, col) => {
            // Decide por LA COLUMNA (su render), no por el binding: una columna accion con `actions`
            // abre el menú declarativo; el resto cae al flujo de transiciones. La de notificar ya se
            // resolvió antes en la celda (render.kind). Handoff HANDOFF-columnas-reusables-binding.
            const actions = (col.render as Record<string, unknown> | null)?.actions as AccionItem[] | undefined;
            if (registro?.entity === "cita" || actions) {
              return <AccionesModal actions={actions ?? []} fila={fila} centroId={centroId} />;
            }
            return (
              <TableroAcciones
                tablero={tablero}
                entidadId={fila.id}
                estado={String(fila.estado ?? fila["estado"] ?? "")}
                estados={def.statuses}
                transiciones={def.transitions}
                centroId={centroId}
                onDone={filasRes.refresh}
              />
            );
          }}
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
    </PageContainer>
  );
}

// Card-styled filter button (native <button> for a11y — Card itself renders a
// <div>, and this needs real click/keyboard/aria-pressed semantics like before).
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
      className={cn(
        "group flex min-w-[7rem] flex-col gap-1.5 rounded-md bg-card px-4 py-3 text-left text-card-foreground shadow-sm shadow-[rgba(16,32,64,0.06)] transition-colors",
        active
          ? "bg-primary/[0.04] ring-2 ring-primary/50"
          : "ring-1 ring-foreground/10 hover:ring-foreground/20",
      )}
    >
      <span className="flex items-center gap-1.5">
        {color && <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />}
        <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      </span>
      <span className="text-2xl font-bold leading-none tabular-nums text-foreground">{count}</span>
    </button>
  );
}
