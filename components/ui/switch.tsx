"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Toggle accesible (role=switch) sin dependencias extra. Acción instantánea (sin
// confirmación), tokens-only, ambos temas.
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  id,
  className,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onCheckedChange?: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-input",
        className,
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block size-5 rounded-full bg-background shadow ring-0 transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
