"use client";

import type { BoardColumnGroup } from "@/components/agenda/tablero-dinamico";
import { LoadingRegion, RawRowsSkeleton, type CellShape } from "@/components/kit/skeletons";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// Loading rows for TableroDinamico. With the board definition loaded the real headers render and each
// column's bar follows what its cell renders; before that a placeholder header with a typical layout.

// Patient (avatar + name), time, a status chip, the attention flow and the row action.
const PLACEHOLDER: CellShape[] = ["avatar", "short", "text", "badge", "long", "button"];

function shapeOf(g: BoardColumnGroup): CellShape {
  if (g.kind === "flow") return "long";
  const { col } = g;
  const kind = (col.render as { kind?: string } | null)?.kind;
  if (col.clave === "paciente") return "avatar";
  if (kind === "notificar" || col.tipo === "toggle" || col.tipo === "hora") return "short";
  if (col.tipo === "accion") return "button";
  if (col.tipo === "badge") return "badge";
  return "text";
}

/** Header cells while the column definition itself is still loading. */
export function BoardHeadSkeleton() {
  return PLACEHOLDER.map((_, i) => (
    <th key={i} className="px-3 py-2">
      <Skeleton aria-hidden className={i % 2 ? "h-3 w-12" : "h-3 w-16"} />
    </th>
  ));
}

/** Body rows under the (real or placeholder) headers, with the board's own cell padding. */
export function BoardRowsSkeleton({ groups, rowPad }: { groups: BoardColumnGroup[]; rowPad: string }) {
  return (
    <RawRowsSkeleton
      columns={groups.length > 0 ? groups.map(shapeOf) : PLACEHOLDER}
      rows={8}
      rowClassName="border-t"
      cellClassName={"px-3 " + rowPad}
    />
  );
}

// The KPI row while the board loads: the real "All" tile with its count pending, plus a few status
// tiles, all with generic-board.tsx KpiCard's exact box.
const KPI_TILE = "flex min-w-[7rem] flex-col gap-1.5 rounded-md bg-card px-4 py-3 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10";
export function KpiTilesSkeleton({ allLabel }: { allLabel: string }) {
  return (
    <LoadingRegion className="flex flex-wrap gap-2">
      <div className={KPI_TILE}>
        <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{allLabel}</span>
        <Skeleton className="h-6 w-8" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className={KPI_TILE}>
          <span className="flex items-center gap-1.5">
            <Skeleton className="size-2 shrink-0 rounded-full" />
            <Skeleton className={cn("my-0.5 h-3", i % 2 ? "w-12" : "w-16")} />
          </span>
          <Skeleton className="h-6 w-8" />
        </div>
      ))}
    </LoadingRegion>
  );
}
