"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import {
  getFrontdeskTablero,
  listSesionesRango,
  getPendientesEntrega,
  type FrontdeskFila,
  type FrontdeskTablero,
  type Sesion,
  type PendienteEntrega,
} from "@/lib/api/frontdesk";
import type { Servicio } from "@/lib/api/servicios";
import { getDefinicion, getOpciones, type TableroDefinicion, type Opcion } from "@/lib/api/tablero";
import { flowColumns, renderColumns, sortBoardRowsNatural } from "@/lib/frontdesk/board-columns";
import { hideCancelledRow } from "@/lib/frontdesk/reopen";
import { todayISO, STAMP_FIELD } from "@/components/frontdesk/frontdesk-board.helpers";
import { FilaSesion } from "@/components/frontdesk/fila-sesion";
import { BoardTable, BoardRowsSkeleton, KPI_TILE, KpiTilesSkeleton } from "@/components/frontdesk/frontdesk-skeleton";
import { useResource } from "@/hooks/use-resource";
import { useCitaStream } from "@/hooks/use-cita-stream";
import { useCan } from "@/hooks/use-can";
import { TherapyDayScheduler } from "@/components/agenda/therapy-day-scheduler";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// Visor general de UNA terapia (pedido del dueño, 17-nov-2026, a partir de la pantalla del legado):
// clic en el NOMBRE de una pastilla de la cola (components/patient-desk/therapy-queue-strip.tsx) abre
// esto — el MISMO tablero interactivo del frontdesk (FilaSesion: Presente→En terapia→Asistido,
// terapeuta, mediciones), pero data-fetching propio y acotado a este servicio+fecha, en un Dialog, sin
// tocar components/frontdesk/frontdesk-board.tsx (archivo con techo de DEBT, dinero en vivo — se
// replica la plomería mínima en vez de arriesgar esa pantalla). Sin buscador ni filtro de paciente: el
// legado tampoco los tiene aquí, son del tablero completo.
export function ServiceBoardViewer({
  servicio,
  centro,
  fecha,
  open,
  onOpenChange,
}: {
  servicio: Servicio;
  centro: string | undefined;
  fecha: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("frontdesk");
  const tRoot = useTranslations();
  const { can } = useCan();
  const [programar, setProgramar] = React.useState<{ open: boolean; pacienteId?: string; pacienteNombre?: string }>({ open: false });

  const defRes = useResource<TableroDefinicion>(
    () => (open && centro ? getDefinicion("servicios", centro) : Promise.resolve({ statuses: [], transitions: [], columns: [], subtypes: [] } as unknown as TableroDefinicion)),
    [open, centro],
  );
  const def = defRes.state.kind === "ok" ? defRes.state.data : null;
  const estados = React.useMemo(() => def?.statuses ?? [], [def]);
  const estadoDe = React.useCallback((clave: string) => estados.find((e) => e.slug === clave), [estados]);
  const flujo = React.useMemo(() => {
    const trans = new Set((def?.transitions ?? []).map((x) => x.slug));
    return estados.filter((e) => trans.has(e.slug) && STAMP_FIELD[e.slug]);
  }, [def, estados]);

  const boardRes = useResource<FrontdeskTablero>(
    () => (open && centro ? getFrontdeskTablero(servicio.slug, fecha, centro) : Promise.resolve({ columns: [], rows: [] })),
    [open, centro, servicio.slug, fecha],
  );
  const board = boardRes.state.kind === "ok" ? boardRes.state.data : null;
  const sesRes = useResource<Sesion[]>(
    () => (open && centro ? listSesionesRango({ desde: fecha, hasta: fecha, servicioId: servicio.id }) : Promise.resolve([])),
    [open, centro, servicio.id, fecha],
  );
  const sesiones = React.useMemo(() => new Map((sesRes.state.kind === "ok" ? sesRes.state.data : []).map((s) => [s.id, s])), [sesRes.state]);
  const refetch = React.useCallback(() => {
    boardRes.refresh();
    sesRes.refresh();
  }, [boardRes, sesRes]);

  useCitaStream({ centroId: centro ?? null, entidad: "sesion", enabled: open && !!centro, onInvalidate: refetch });

  const flujoCols = React.useMemo(() => flowColumns(board?.columns ?? []), [board]);
  const colsRender = React.useMemo(() => renderColumns(board?.columns ?? []), [board]);

  const [optionsByCol, setOptionsByCol] = React.useState<Record<string, Opcion[]>>({});
  React.useEffect(() => {
    if (!open || !centro) return;
    const selects = (board?.columns ?? []).filter(
      (c) => c.editable && (c.tipo === "select" || !!(c.render as { optionsSource?: string } | null)?.optionsSource),
    );
    if (!selects.length) return;
    let active = true;
    Promise.all(
      selects.map((c) =>
        getOpciones(servicio.slug, c.clave, centro)
          .then((ops) => [c.clave, ops] as const)
          .catch(() => [c.clave, []] as const),
      ),
    ).then((pairs) => {
      if (active) setOptionsByCol(Object.fromEntries(pairs));
    });
    return () => {
      active = false;
    };
  }, [open, centro, board, servicio.slug]);

  const hayDosis = React.useMemo(
    () => (board?.columns ?? []).some((c) => (c.render as { optionsSource?: string } | null)?.optionsSource === "productos_grupo"),
    [board],
  );
  const [saldoByPaciente, setSaldoByPaciente] = React.useState<Record<string, PendienteEntrega[]>>({});
  React.useEffect(() => {
    if (!open || !centro) return;
    const ids = hayDosis
      ? Array.from(new Set((board?.rows ?? []).map((f) => sesiones.get(f.id)?.patientId).filter((x): x is string => !!x)))
      : [];
    let active = true;
    Promise.all(
      ids.map((id) =>
        getPendientesEntrega(id, centro)
          .then((r) => [id, r] as const)
          .catch(() => [id, [] as PendienteEntrega[]] as const),
      ),
    ).then((pairs) => {
      if (active) setSaldoByPaciente(Object.fromEntries(pairs));
    });
    return () => {
      active = false;
    };
  }, [open, hayDosis, centro, board, sesiones]);

  const estadoFila = React.useCallback((f: FrontdeskFila) => String(f.estado ?? f.fd_estado ?? sesiones.get(f.id)?.status ?? ""), [sesiones]);
  const visibles = React.useMemo(
    () => (board?.rows ?? []).filter((f) => !hideCancelledRow(estadoFila(f), sesiones.get(f.id)?.date, todayISO())),
    [board, sesiones, estadoFila],
  );
  const ordenadas = React.useMemo(
    () =>
      sortBoardRowsNatural(visibles, {
        estadoOf: estadoFila,
        presenteOf: (f) => f["presente"] as string | undefined,
        asistidoOf: (f) => f["asistido"] as string | undefined,
        scheduledTimeOf: (f) => sesiones.get(f.id)?.time ?? null,
      }),
    [visibles, estadoFila, sesiones],
  );
  const kpis = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of visibles) counts.set(estadoFila(f), (counts.get(estadoFila(f)) ?? 0) + 1);
    return { counts, total: visibles.length };
  }, [visibles, estadoFila]);

  const cargando = [defRes, boardRes].some((r) => r.state.kind === "loading");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>{servicio.name}</DialogTitle>
          </DialogHeader>

          {cargando ? (
            <KpiTilesSkeleton />
          ) : (
            <div className="mb-4 flex flex-wrap gap-2">
              <ViewerKpiTile label={t("todos")} count={kpis.total} />
              {estados
                .filter((e) => (kpis.counts.get(e.slug) ?? 0) > 0)
                .map((e) => (
                  <ViewerKpiTile key={e.slug} label={tRoot(e.labelKey)} count={kpis.counts.get(e.slug) ?? 0} color={e.color} />
                ))}
            </div>
          )}

          <BoardTable colsRender={colsRender}>
            {cargando && <BoardRowsSkeleton colsRender={colsRender} />}
            {!cargando && ordenadas.length === 0 && (
              <tr>
                <td colSpan={colsRender.length + 1} className="px-3 py-10 text-center text-muted-foreground">
                  {t("sinFilas")}
                </td>
              </tr>
            )}
            {!cargando &&
              ordenadas.map((f) => (
                <FilaSesion
                  key={f.id}
                  fila={f}
                  sesion={sesiones.get(f.id)}
                  colsRender={colsRender}
                  flujoCols={flujoCols}
                  flujo={flujo.map((e) => ({ clave: e.slug, labelKey: e.labelKey, color: e.color }))}
                  transiciones={def?.transitions ?? []}
                  estadoDe={estadoDe}
                  servicio={servicio}
                  tablero={servicio.slug}
                  fecha={fecha}
                  optionsByCol={optionsByCol}
                  saldoDosis={saldoByPaciente[String(sesiones.get(f.id)?.patientId ?? "")] ?? []}
                  centro={centro}
                  sinSaldo={false}
                  canReparar={can("frontdesk.reparar")}
                  estados={estados.map((e) => ({ clave: e.slug, label: tRoot(e.labelKey) }))}
                  onChanged={refetch}
                  onProgramar={(ctx) => setProgramar({ open: true, pacienteId: ctx.pacienteId, pacienteNombre: ctx.pacienteNombre })}
                />
              ))}
          </BoardTable>
        </DialogContent>
      </Dialog>

      <Dialog open={programar.open} onOpenChange={(o) => setProgramar((p) => ({ ...p, open: o }))}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{tRoot("programarCitas.title")}</DialogTitle>
            <DialogDescription className="sr-only">{servicio.name}</DialogDescription>
          </DialogHeader>
          <TherapyDayScheduler
            defaultDate={fecha}
            defaultServiceId={servicio.id}
            centro={centro}
            lockedPatient={programar.pacienteId ? { id: programar.pacienteId, name: programar.pacienteNombre ?? "" } : undefined}
            onBooked={({ close }) => {
              refetch();
              if (close) setProgramar((p) => ({ ...p, open: false }));
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function ViewerKpiTile({ label, count, color }: { label: string; count: number; color?: string | null }) {
  return (
    <span className={KPI_TILE + "cursor-default ring-1 ring-foreground/10"}>
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {color && <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />}
        {label}
      </span>
      <span className="text-xl font-bold tabular-nums">{count}</span>
    </span>
  );
}
