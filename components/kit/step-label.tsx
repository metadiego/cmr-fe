import * as React from "react";

/**
 * «1 · La cita» / «2 · Cuándo»: names what each side of a two-sided booking dialog is for, numbered in
 * the order it is filled. A section title (text-xs uppercase muted) with its step in a dark dot.
 */
export function StepLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
      <span className="grid size-[18px] place-items-center rounded-full bg-foreground text-[10px] tracking-normal text-background">
        {n}
      </span>
      {children}
    </p>
  );
}
