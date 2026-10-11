"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { FrontdeskColumna } from "@/lib/api/frontdesk";
import type { RenderItem } from "@/lib/frontdesk/board-columns";
import { CellSkeleton, LoadingRegion, type CellShape } from "@/components/kit/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// Loading placeholders for the Patient Center board (docs/specs/2026-10-10-skeletons-de-carga.md),
// kept out of frontdesk-board.tsx (DEBT ceiling). The table frame is shared with the loaded table, so
// the skeleton rows sit under the real headers whenever the service's columns are already known.

type Cols = RenderItem<FrontdeskColumna>[];

/** Base classes of a KPI tile; the board's KpiTile and its skeleton share them so both have one size. */
export const KPI_TILE =
  "group flex min-w-24 flex-col items-start gap-1 rounded-md bg-card px-4 py-3 text-left shadow-sm shadow-[rgba(16,32,64,0.06)] transition-colors ";

const PILL_WIDTHS = ["w-28", "w-24", "w-32", "w-20", "w-28"];

/** Service tab pills (same row, same pill height as ServiciosTabs). */
export function ServiceTabsSkeleton() {
  return (
    <LoadingRegion className="mb-3 flex flex-wrap gap-1.5">
      {PILL_WIDTHS.map((w, i) => (
        <Skeleton key={i} className={"h-8.5 rounded-full " + w} />
      ))}
    </LoadingRegion>
  );
}

/** KPI filter tiles ("Todos" + a few states) with the real tile box. */
export function KpiTilesSkeleton() {
  return (
    <LoadingRegion className="mb-4 flex flex-wrap gap-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={KPI_TILE + "ring-1 ring-foreground/10"}>
          <span className="flex h-[16.5px] items-center">
            <Skeleton className={"h-2.5 " + (i ? "w-16" : "w-12")} />
          </span>
          <span className="flex h-7 items-center">
            <Skeleton className="h-5 w-8" />
          </span>
        </div>
      ))}
    </LoadingRegion>
  );
}

// What a column's loaded cell looks like (fila-sesion.tsx), so the bar reads the same.
function columnShape(c: FrontdeskColumna): BoardCellShape {
  if (c.clave === "fd_estado") return "badge";
  if (c.clave === "fd_paciente") return "long";
  if (c.editable && (c.tipo === "select" || (c.render as { datalist?: boolean } | null)?.datalist)) return "control";
  return "text";
}

// The flow cell: step pills with their caption underneath (FilaSesion's flujoCell).
function FlowCellSkeleton() {
  return (
    <div className="flex items-start">
      {[0, 1, 2].map((i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="mt-3 h-px w-4 shrink-0 bg-border" />}
          <div className="flex min-w-16 flex-col items-center gap-1">
            <Skeleton className="h-6 w-14 rounded-full" />
            <Skeleton className="h-2.5 w-12" />
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

export type BoardCellShape = CellShape | "control" | "flow";

// Layout used before the service's columns are known (first load of a tab).
const FALLBACK: BoardCellShape[] = ["short", "long", "flow", "badge", "control", "text"];

/**
 * Body rows under the board's headers: one cell per render column plus the actions menu. With no
 * columns yet, `fallback` (default: the board's usual layout) stands in for them.
 */
export function BoardRowsSkeleton({ colsRender, rows = 8, fallback = FALLBACK }: { colsRender: Cols; rows?: number; fallback?: BoardCellShape[] }) {
  const t = useTranslations("common");
  const shapes = colsRender.length
    ? colsRender.map((it) => (it.kind === "flujo" ? ("flow" as const) : columnShape(it.col)))
    : fallback;
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} aria-busy={r === 0 ? true : undefined}>
          {shapes.map((s, c) => (
            <td key={c} className="px-3 py-2">
              {r === 0 && c === 0 && <span className="sr-only">{t("loading")}</span>}
              <div aria-hidden>
                {s === "flow" ? <FlowCellSkeleton /> : s === "control" ? <Skeleton className="h-8 w-40" /> : <CellSkeleton shape={s} row={r + c} />}
              </div>
            </td>
          ))}
          <td className="px-3 py-2">
            <Skeleton aria-hidden className="ml-auto size-8" />
          </td>
        </tr>
      ))}
    </>
  );
}

/**
 * The board's table: container, sortable headers and body. With no columns yet (first load of a tab)
 * the header row is a skeleton too, sized like the fallback body.
 */
export function BoardTable({
  colsRender,
  sort,
  onSort,
  onNaturalSort,
  children,
}: {
  colsRender: Cols;
  sort?: { col: string; dir: "asc" | "desc" } | null;
  onSort?: (col: string) => void;
  onNaturalSort?: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations("frontdesk");
  const tRoot = useTranslations();
  return (
    <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            {colsRender.length === 0
              ? FALLBACK.map((_, i) => (
                  <th key={i} className="px-3 py-2">
                    <Skeleton aria-hidden className="h-[16.5px] w-16" />
                  </th>
                ))
              : colsRender.map((item, i) =>
                  item.kind === "flujo" ? (
                    // Click on Flow → natural order by arrival (turn).
                    <th key={`flujo-${i}`} className="px-3 py-2 font-semibold">
                      <button type="button" onClick={onNaturalSort} className="inline-flex items-center gap-1 hover:text-foreground" title={t("ordenarTurno")}>
                        {t("flujo")}{!sort && <span aria-hidden>•</span>}
                      </button>
                    </th>
                  ) : (
                    <th key={item.col.clave} className="px-3 py-2 font-semibold">
                      <button type="button" onClick={() => onSort?.(item.col.clave)} className="inline-flex items-center gap-1 hover:text-foreground">
                        {item.col.label ?? tRoot(((item.col.render as { labelKey?: string } | null)?.labelKey) ?? item.col.labelKey)}
                        {sort?.col === item.col.clave && <span aria-hidden>{sort.dir === "asc" ? "▲" : "▼"}</span>}
                      </button>
                    </th>
                  ),
                )}
            <th className="px-3 py-2 text-right font-semibold">{tRoot("fd.col.acciones")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

/** Whole board body before the center gate resolves: KPI tiles + table with skeleton headers and rows. */
export function BoardSkeleton() {
  return (
    <>
      <KpiTilesSkeleton />
      <BoardTable colsRender={[]}>
        <BoardRowsSkeleton colsRender={[]} />
      </BoardTable>
    </>
  );
}
