"use client";

import * as React from "react";

import { LoadingRegion } from "@/components/kit/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// Loading stand-ins for TherapyDayScheduler, shaped like what replaces them.

const SLOTS = 15; // three rows at the widest breakpoint

/** The hours panel while availability loads: same grid and slot-button box as the real slots. */
export function SlotGridSkeleton({ hint }: { hint: React.ReactNode }) {
  return (
    <LoadingRegion>
      {hint}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: SLOTS }, (_, i) => (
          <div key={i} className="flex flex-col items-start rounded-lg border p-2">
            {/* time (text-sm line), stations bar, caption (text-[10px] line) */}
            <Skeleton className="my-0.5 h-4 w-12" />
            <Skeleton className="mt-1 h-1.5 w-10" />
            <Skeleton className="mt-1 h-3 w-16" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

/** The bottom summary while the day plan loads: the fits badge, start time and minutes on one line. */
export function PlanSummarySkeleton() {
  return (
    <LoadingRegion className="flex flex-wrap items-center gap-2">
      <Skeleton className="h-5 w-16 rounded-4xl" />
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-4 w-36" />
    </LoadingRegion>
  );
}
