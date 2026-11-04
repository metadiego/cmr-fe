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
