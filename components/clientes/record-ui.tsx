"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// The patient record's visual language, shared by every tab so they read as one screen: a titled
// card (Panel), a hairline-divided table, a grid of numbers, a status pill coloured by meaning, and
// one empty/loading/error treatment. Presentation only: no data fetching here.

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
export function StatGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: 3 | 4 }) {
  return (
    <div className={cn("-mr-px -mb-px grid grid-cols-2", cols === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
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

// Empty / loading / error, sized for the inside of a Panel or standing alone (`bare`).
export function EmptyState({ children, bare }: { children: React.ReactNode; bare?: boolean }) {
  return (
    <p
      className={cn(
        "px-5 py-10 text-center text-sm text-muted-foreground",
        bare && "rounded-xl border border-dashed bg-card/50",
      )}
    >
      {children}
    </p>
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

// Status pill coloured by meaning: done = green, in progress / upcoming = blue, needs attention =
// amber, cancelled / voided = red. Labels come from the existing catalogues; unknown values show raw.
type Tone = "success" | "info" | "warning" | "destructive" | "secondary";
const TONE: Record<string, Tone> = {
  // appointments
  atendida: "success",
  programada: "info",
  confirmada: "info",
  presente: "info",
  triage: "info",
  en_consulta: "info",
  no_show: "warning",
  reprogramada: "secondary",
  cancelada: "destructive",
  // therapy sessions
  asistido: "success",
  en_terapia: "info",
  pendiente: "secondary",
  // invoices
  emitida: "success",
  borrador: "secondary",
  devuelta_parcial: "warning",
  devuelta_total: "destructive",
  anulada: "destructive",
};
const LABEL_NS = {
  appointment: "citas.estado",
  therapy: "servicios.estado",
  invoice: "facturacionList.estado",
} as const;

export function StatusBadge({ kind, value }: { kind: keyof typeof LABEL_NS; value?: string | null }) {
  const t = useTranslations();
  if (!value) return <span className="text-muted-foreground">—</span>;
  const key = `${LABEL_NS[kind]}.${value}`;
  return <Badge variant={TONE[value] ?? "secondary"}>{t.has(key) ? t(key) : value}</Badge>;
}
