"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon } from "@hugeicons/core-free-icons";

import { cn } from "@/lib/utils";

// Label/value rows of the audit detail panel (moved out of auditoria-log.tsx, which sits at its ceiling).
export function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

export function CopiableCampo({
  label,
  value,
  onCopy,
  vacio,
}: {
  label: string;
  value: string | null;
  onCopy: (txt: string) => void;
  vacio: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {value ? (
        <button
          type="button"
          onClick={() => onCopy(value)}
          className={cn("flex items-center gap-1 font-mono text-xs hover:text-foreground")}
        >
          <span className="max-w-[12rem] truncate">{value}</span>
          <HugeiconsIcon icon={Copy01Icon} className="size-3.5 opacity-60" />
        </button>
      ) : (
        <span className="text-xs text-muted-foreground">{vacio}</span>
      )}
    </div>
  );
}
