"use client"

import { cn } from "@/lib/utils"
import { LoadingRegion } from "@/components/kit/skeletons"
import { Skeleton } from "@/components/ui/skeleton"

// Loading placeholders for the calendar's day/agenda views and category legend. Each mirrors the
// loaded markup in calendario.tsx (Fila rows, agenda day groups, legend dots) so nothing jumps.
// The spacing/divider classes sit on an inner element: LoadingRegion's own children are the sr-only
// label and a `contents` wrapper, so `space-y`/`divide-y` on it would not reach the rows.

const TITLE_W = ["w-40", "w-56", "w-32", "w-48"]

/** One placeholder per `Fila`: same padding, dot, fixed-width time column and title. */
function FilaSkeleton({ row }: { row: number }) {
  return (
    <div className="flex w-full items-center gap-3 px-4 py-2.5">
      <Skeleton className="size-2.5 shrink-0 rounded-full" />
      <span className="flex h-5 w-24 shrink-0 items-center">
        <Skeleton className={cn("h-4", row % 2 ? "w-20" : "w-12")} />
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <Skeleton className={cn("h-4", TITLE_W[row % 4])} />
        <Skeleton className="h-3 w-16" />
      </span>
    </div>
  )
}

/** Rows for the day view's divided card (the card itself is rendered by the caller). */
export function DiaRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <LoadingRegion>
      <div className="divide-y">
        {Array.from({ length: rows }, (_, i) => (
          <FilaSkeleton key={i} row={i} />
        ))}
      </div>
    </LoadingRegion>
  )
}

/** Agenda ("upcoming"): day heading + a card of rows, a few groups of varying size. */
export function AgendaSkeleton({ groups = [2, 1, 3] }: { groups?: number[] }) {
  return (
    <LoadingRegion>
      <div className="space-y-4">
        {groups.map((rows, g) => (
          <div key={g}>
            <div className="mb-1 flex h-5 items-center">
              <Skeleton className={cn("h-4", g % 2 ? "w-36" : "w-44")} />
            </div>
            <div className="divide-y overflow-hidden rounded-md bg-card shadow-sm ring-1 shadow-[rgba(16,32,64,0.06)] ring-foreground/10">
              {Array.from({ length: rows }, (_, i) => (
                <FilaSkeleton key={i} row={g + i} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  )
}

/** Category legend dots + labels while the categories load (the trailing "global" item is real). */
export function LegendDotsSkeleton({ items = 5 }: { items?: number }) {
  return (
    <LoadingRegion className="contents">
      {Array.from({ length: items }, (_, i) => (
        <span key={i} className="inline-flex h-4 items-center gap-1.5">
          <Skeleton className="size-2.5 rounded-full" />
          <Skeleton
            className={cn("h-3", ["w-16", "w-20", "w-12", "w-14"][i % 4])}
          />
        </span>
      ))}
    </LoadingRegion>
  )
}
