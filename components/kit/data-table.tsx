"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { ResourceState } from "@/hooks/use-resource";
import type { ApiMeta } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// One column of a DataTable. `cell` renders the value for a row; `align` and
// `className` style both the header and cells.
export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}

type Pagination = NonNullable<ApiMeta["pagination"]>;

// Generic list table over a useResource state — renders the loading / empty /
// fail visual states (extracted from the original users-list.tsx) plus an
// optional pagination footer. The page owns data fetching (useResource +
// apiFetch/apiFetchPaged); DataTable only renders.
//
//   const { state, reload } = useResource(() => getPacientes());
//   <DataTable columns={cols} state={state} getRowKey={(p) => p.id} onReload={reload} />
export function DataTable<T>({
  columns,
  state,
  getRowKey,
  onReload,
  onRowClick,
  pagination,
  labels,
}: {
  columns: Column<T>[];
  state: ResourceState<T[]>;
  getRowKey: (row: T) => React.Key;
  onReload?: () => void;
  onRowClick?: (row: T) => void;
  pagination?: { meta: Pagination; onPageChange: (page: number) => void };
  labels?: { loading?: string; empty?: string; retry?: string };
}) {
  const t = useTranslations("common");
  const loadingLabel = labels?.loading ?? t("loading");
  const emptyLabel = labels?.empty ?? t("empty");
  const retryLabel = labels?.retry ?? t("retry");

  const alignClass = (align?: Column<T>["align"]) =>
    align === "right"
      ? "text-right"
      : align === "center"
        ? "text-center"
        : undefined;

  if (state.kind === "loading") {
    return <p className="text-sm text-muted-foreground">{loadingLabel}</p>;
  }

  if (state.kind === "fail") {
    return (
      <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <p>{state.message}</p>
        {onReload && (
          <Button size="sm" variant="outline" onClick={onReload}>
            {retryLabel}
          </Button>
        )}
      </div>
    );
  }

  if (state.data.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key} className={cn(alignClass(col.align), col.className)}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {state.data.map((row) => (
            <TableRow
              key={getRowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? "cursor-pointer" : undefined}
            >
              {columns.map((col) => (
                <TableCell key={col.key} className={cn(alignClass(col.align), col.className)}>
                  {col.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {pagination && (
        <PaginationFooter
          meta={pagination.meta}
          onPageChange={pagination.onPageChange}
          rangeLabel={(from, to, total) =>
            t("pagination.range", { from, to, total })
          }
          prevLabel={t("pagination.prev")}
          nextLabel={t("pagination.next")}
        />
      )}
    </div>
  );
}

function PaginationFooter({
  meta,
  onPageChange,
  rangeLabel,
  prevLabel,
  nextLabel,
}: {
  meta: Pagination;
  onPageChange: (page: number) => void;
  rangeLabel: (from: number, to: number, total: number) => string;
  prevLabel: string;
  nextLabel: string;
}) {
  const { total, page, limit } = meta;
  const pages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);

  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>{rangeLabel(from, to, total)}</span>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {prevLabel}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
