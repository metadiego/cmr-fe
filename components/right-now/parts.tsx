import * as React from "react";

import { cn } from "@/lib/utils";

// Small building blocks shared by the «Ahora mismo» panels (one look for every number on the board).

export function Panel({
  title,
  aside,
  children,
  className,
}: {
  title: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg bg-card ring-1 ring-foreground/10 shadow-sm", className)}>
      <header className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {aside}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  tone,
  size = "md",
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: "success" | "warning" | "destructive" | "muted";
  size?: "md" | "lg";
}) {
  const toneCls =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "destructive"
          ? "text-destructive"
          : tone === "muted"
            ? "text-muted-foreground"
            : "text-foreground";
  return (
    <div className="min-w-0">
      <div className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("font-semibold tabular-nums", size === "lg" ? "text-3xl" : "text-xl", toneCls)}>{value}</div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">{children}</p>;
}

// Numbered medal for a ranking row (owner, 11-nov: legacy's "Ahora Mismo" read denser/livelier than
// ours — this + Pill below are the pieces that make a ranking scannable without a table). Top 3 get a
// color; everyone else gets a plain number, same size so the list doesn't jump around.
export function RankBadge({ rank }: { rank: number }) {
  const cls =
    rank === 1
      ? "bg-amber-400 text-amber-950"
      : rank === 2
        ? "bg-slate-300 text-slate-800 dark:bg-slate-400 dark:text-slate-900"
        : rank === 3
          ? "bg-orange-400/80 text-orange-950"
          : "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums", cls)}>
      {rank}
    </span>
  );
}

// Small colored count, inline with a row (replaces a whole table column with one glance-able chip).
export function Pill({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "success" | "warning" | "destructive" | "info" | "muted";
}) {
  const cls =
    tone === "success"
      ? "bg-success/15 text-success-foreground"
      : tone === "warning"
        ? "bg-warning/20 text-warning-foreground"
        : tone === "destructive"
          ? "bg-destructive/10 text-destructive"
          : tone === "info"
            ? "bg-info/15 text-info-foreground"
            : "bg-muted text-muted-foreground";
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums", cls)}>{children}</span>;
}
