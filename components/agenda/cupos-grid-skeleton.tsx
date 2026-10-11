"use client";

import { useTranslations } from "next-intl";

import type { TipoCita } from "@/lib/api/citas";
import { LoadingRegion } from "@/components/kit/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// Columns shown while the appointment-type catalog itself is still loading.
const PLACEHOLDER_COLUMNS = 5;
const ROWS = 6;

// Loading stand-in for CuposGrid: same card, same header row (the real appointment-type columns once
// the catalog is in, else placeholder ones), rows of an hour + one number-input block per type, and the
// add-hour / save bar underneath.
export function CuposGridSkeleton({ tipos }: { tipos: TipoCita[] | null }) {
  const t = useTranslations("agenda");
  const cols = tipos ? tipos.length : PLACEHOLDER_COLUMNS;
  return (
    <LoadingRegion className="space-y-3">
      <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">{t("cupos.hour")}</th>
              {tipos
                ? tipos.map((tipo) => (
                    <th key={tipo.id} className="px-3 py-2 text-left font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: tipo.color }} />
                        {tipo.name}
                      </span>
                    </th>
                  ))
                : Array.from({ length: cols }, (_, i) => (
                    <th key={i} className="px-3 py-2 text-left font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <Skeleton className="size-2.5 rounded-full" />
                        <Skeleton className="h-3 w-16" />
                      </span>
                    </th>
                  ))}
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }, (_, r) => (
              <tr key={r} className="border-t">
                <td className="px-3 py-1.5">
                  <Skeleton className="h-4 w-11" />
                </td>
                {Array.from({ length: cols }, (_, c) => (
                  <td key={c} className="px-3 py-1.5">
                    <Skeleton className="h-8 w-20" />
                  </td>
                ))}
                <td className="px-3 py-1.5">
                  <Skeleton className="ml-auto size-4" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="ml-auto h-9 w-20" />
      </div>
    </LoadingRegion>
  );
}
