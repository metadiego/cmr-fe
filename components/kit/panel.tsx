"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { EmptyState as EmptyStateFrame } from "@/components/ui/empty-state";

// The app's card language (see CLAUDE.md, "UI: one visual language"): a titled card (Panel), a
// hairline-divided table inside it, a grid of numbers, and one empty / loading / error treatment.
// Presentation only: no data fetching here. Status pills live in ./status-badge.tsx.

export function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl border bg-card shadow-xs", className)}>
      {(title || actions) && (
        <header className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-5 py-2.5">
          <div className="min-w-0">
            {title && <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

// Inside a Panel: no border of its own, header tinted, rows divided by hairlines.
export function RecordTable({
  head,
  children,
  foot,
}: {
  head: React.ReactNode;
  children: React.ReactNode;
  foot?: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="text-[11px] tracking-wide text-muted-foreground uppercase">{head}</tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
        {foot && <tfoot className="border-t-2">{foot}</tfoot>}
      </table>
    </div>
  );
}

export function Th({ children, right, className }: { children?: React.ReactNode; right?: boolean; className?: string }) {
  return (
    <th className={cn("px-4 py-2.5 font-medium whitespace-nowrap first:pl-5 last:pr-5", right ? "text-right" : "text-left", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className, colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cn("px-4 py-3 first:pl-5 last:pr-5", className)}>
      {children}
    </td>
  );
}

// Numbers divided by hairlines. Pulled 1px right/down under the Panel's `overflow-hidden` so the outer
// cells' rules do not double the panel border.
export function StatGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: 3 | 4 | 5 }) {
  return (
    <div
      className={cn(
        "-mr-px -mb-px grid grid-cols-2",
        cols === 4 ? "sm:grid-cols-4" : cols === 5 ? "sm:grid-cols-3 lg:grid-cols-5" : "sm:grid-cols-3",
      )}
    >
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "primary" | "danger" | "muted";
}) {
  return (
    <div className="min-w-0 border-r border-b px-5 py-4">
      <div className="truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</div>
      <div
        className={cn(
          "mt-1 truncate text-xl font-semibold tabular-nums",
          tone === "primary" && "text-primary",
          tone === "danger" && "text-destructive",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

// Empty / loading / error, sized for the inside of a Panel or standing alone (`bare`). Built on the
// shared ui/empty-state so there is one empty look in the app; inside a Panel it drops its frame.
export function EmptyState({ children, bare }: { children: React.ReactNode; bare?: boolean }) {
  return (
    <EmptyStateFrame
      title={<span className="font-normal text-muted-foreground">{children}</span>}
      className={bare ? "rounded-xl" : "rounded-none border-0 bg-transparent px-5 py-10"}
    />
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{message}</p>
  );
}

export function LoadingPanel({ rows = 4 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <div className="h-12 border-b bg-muted/30" />
      <div className="divide-y">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5">
            <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
            <div className="h-3.5 flex-1 animate-pulse rounded bg-muted" />
            <div className="h-3.5 w-16 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
