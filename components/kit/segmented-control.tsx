"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

export type SegmentedOption<V extends string> = {
  value: V;
  label: string;
  /** Optional colour dot before the label (a catalogue colour, e.g. an appointment status). */
  dot?: string;
};

/**
 * A choice among two or three options shown side by side: one click instead of opening a dropdown.
 * For more options, use a Select. Arrow keys move between options (radiogroup pattern).
 */
export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  disabled,
  className,
}: {
  options: ReadonlyArray<SegmentedOption<V>>;
  value: V | "" | undefined;
  onChange: (value: V) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const current = options.findIndex((o) => o.value === value);

  function onKeyDown(e: React.KeyboardEvent, i: number) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("flex h-9 w-full rounded-md border border-input bg-muted/40 p-0.5", className)}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            // Roving tab stop: the chosen option (or the first, when none is) is the one Tab reaches.
            tabIndex={active || (current === -1 && i === 0) ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded px-3 text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
              active ? "bg-background font-medium text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.dot && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: o.dot }} />}
            {/* Narrow options (4+ in a tray) truncate with an ellipsis — the tooltip is the only way
                to read the rest, so it's never conditional on measuring overflow. */}
            <Tooltip content={o.label} className="min-w-0 flex-1">
              <span className="block min-w-0 truncate">{o.label}</span>
            </Tooltip>
          </button>
        );
      })}
    </div>
  );
}
