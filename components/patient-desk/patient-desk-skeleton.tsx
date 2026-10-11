"use client";

import * as React from "react";

import { BoardRowsSkeleton, type BoardCellShape } from "@/components/frontdesk/frontdesk-skeleton";
import { LoadingRegion } from "@/components/kit/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// Loading placeholders for the patient desk (docs/specs/2026-10-10-skeletons-de-carga.md): the same
// master/detail grid, list card and detail card as PatientListView, filled with bars of the loaded size.

// A service block without its patient's name/record columns (blockColumns): flow, status, dose, notes.
const SERVICE_SHAPES: BoardCellShape[] = ["flow", "badge", "control", "text"];

/** A service block's table before its board arrives: header bars + one row per session. */
export function ServiceTableSkeleton({ rows = 1 }: { rows?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/20">
          <tr className="border-b">
            {[...SERVICE_SHAPES, "button"].map((_, i) => (
              <th key={i} className="px-3 py-2">
                <Skeleton aria-hidden className={"h-[16.5px] w-16" + (i === SERVICE_SHAPES.length ? " ml-auto" : "")} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          <BoardRowsSkeleton colsRender={[]} rows={rows} fallback={SERVICE_SHAPES} />
        </tbody>
      </table>
    </div>
  );
}

// One entry of the patient list (name + first time, record, service chips).
function PatientItemSkeleton({ i }: { i: number }) {
  return (
    <li className="rounded-md px-3 py-2">
      <div className="flex h-5 items-center justify-between gap-2">
        <Skeleton className={"h-3.5 " + ["w-32", "w-40", "w-28", "w-36"][i % 4]} />
        <Skeleton className="h-3 w-10" />
      </div>
      <div className="mb-1 flex h-[16.5px] items-center">
        <Skeleton className="h-2.5 w-14" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Skeleton className="h-[22px] w-20 rounded-full" />
        {i % 3 !== 1 && <Skeleton className="h-[22px] w-24 rounded-full" />}
      </div>
    </li>
  );
}

// A service block of the detail: coloured-dot header + its table.
function ServiceSectionSkeleton() {
  return (
    <section className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
      <header className="flex h-[37px] items-center gap-2 border-b bg-muted/40 px-3 py-2">
        <Skeleton className="size-2.5 rounded-full" />
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-16" />
      </header>
      <ServiceTableSkeleton />
    </section>
  );
}

/** The whole master/detail grid while the day's patients load. */
export function PatientDeskSkeleton() {
  return (
    <LoadingRegion className="grid min-h-[60vh] gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
      <ul className="max-h-[calc(100vh-15rem)] space-y-1.5 overflow-hidden rounded-lg bg-card p-2 ring-1 ring-foreground/10">
        {Array.from({ length: 8 }, (_, i) => (
          <PatientItemSkeleton key={i} i={i} />
        ))}
      </ul>
      <div className="min-w-0 space-y-4 rounded-lg bg-card p-4 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex h-7 items-center">
              <Skeleton className="h-5 w-48" />
            </div>
            <div className="flex h-5 items-center">
              <Skeleton className="h-3.5 w-40" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
        <ServiceSectionSkeleton />
        <ServiceSectionSkeleton />
      </div>
    </LoadingRegion>
  );
}
