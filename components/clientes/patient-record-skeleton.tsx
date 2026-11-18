import * as React from "react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// Loading state of the patient record, drawn with the real chrome (card borders, header rows, tab
// rule, hairline-divided cells) so nothing jumps when the data lands. Mirrors the layout in
// app/(app)/patients/[id]/layout.tsx and the cards of components/clientes/record-ui.tsx: change them
// together.
export function PatientRecordSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      {/* Header card: avatar, name + status, subline; actions on the right. */}
      <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Skeleton className="size-14 shrink-0 rounded-full" />
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-64 max-w-[50vw]" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="h-4 w-80 max-w-[60vw]" />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="size-8" />
          </div>
        </div>
      </section>

      {/* Tab strip: the line variant's bottom rule with label-sized bars. */}
      <div className="flex gap-1 overflow-hidden border-b">
        {[72, 48, 64, 80, 84, 88, 136].map((w, i) => (
          <div key={i} className="px-3 pt-1.5 pb-2.5">
            <Skeleton className="h-4" style={{ width: w }} />
          </div>
        ))}
      </div>

      {/* Resumen: personal + contact on the left, clinical + last visit on the right. */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CardSkeleton titleWidth={128} fields={5} columns={2} withAction />
          <CardSkeleton titleWidth={80} fields={4} columns={2} withIcons />
        </div>
        <div className="space-y-6">
          <CardSkeleton titleWidth={144} fields={3} columns={1} />
          <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
            <CardHeaderSkeleton titleWidth={88} />
            <div className="space-y-2 px-5 py-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-44" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function CardHeaderSkeleton({ titleWidth, withAction }: { titleWidth: number; withAction?: boolean }) {
  return (
    <div className="flex min-h-12 items-center justify-between border-b px-5 py-2.5">
      <Skeleton className="h-3" style={{ width: titleWidth }} />
      {withAction && <Skeleton className="h-7 w-16" />}
    </div>
  );
}

function CardSkeleton({
  titleWidth,
  fields,
  columns,
  withAction,
  withIcons,
}: {
  titleWidth: number;
  fields: number;
  columns: 1 | 2;
  withAction?: boolean;
  withIcons?: boolean;
}) {
  // Varied value widths so the block reads as data, not as a stripe pattern.
  const valueWidths = ["w-32", "w-40", "w-28", "w-24", "w-36"];
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <CardHeaderSkeleton titleWidth={titleWidth} withAction={withAction} />
      <div className={cn("-mb-px grid", columns === 2 && "sm:grid-cols-2")}>
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="flex items-start gap-3 border-b px-5 py-3.5">
            {withIcons && <Skeleton className="mt-0.5 size-4 shrink-0" />}
            <div className="space-y-2">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className={cn("h-4", valueWidths[i % valueWidths.length])} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
