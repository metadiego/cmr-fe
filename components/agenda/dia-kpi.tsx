"use client";

import * as React from "react";

// Presentational bits of the day view's new (beta) sheet: the four KPI cards and the type filter
// chips. Pulled out of dia-view.tsx, which sits at its line ceiling — and a ceiling only comes
// down. Pure rendering: no data, no i18n, no state.

export function Kpi({ label, value, tono }: { label: string; value: number; tono?: "ok" | "warn" | "muted" }) {
  const color =
    tono === "ok" ? "text-success-foreground"
    : tono === "warn" ? "text-warning-foreground"
    : tono === "muted" ? "text-muted-foreground"
    : "text-primary";
  return (
    <div className="rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] px-3 py-2">
      <div className={"text-xl font-bold tabular-nums " + color}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
        (active ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/50")
      }
    >
      {children}
    </button>
  );
}
