"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useFormShell, type FormShellProps } from "./form-shell";

export type FormSheetSize = "sm" | "md" | "lg" | "xl" | "2xl";

const WIDTH: Record<FormSheetSize, string> = {
  sm: "data-[side=right]:sm:max-w-md",
  md: "data-[side=right]:sm:max-w-lg",
  lg: "data-[side=right]:sm:max-w-xl",
  xl: "data-[side=right]:sm:max-w-2xl",
  "2xl": "data-[side=right]:sm:max-w-3xl",
};

/** Same contract as FormDialog, as a right-hand sheet. */
export function FormSheet(p: FormShellProps & { size?: FormSheetSize }) {
  const { onOpenChange, contentGuards, onKeyDown, footer, submitting } = useFormShell(p);
  return (
    <Sheet open={p.open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn("flex max-h-[100dvh] flex-col", WIDTH[p.size ?? "md"])}
        showCloseButton={!submitting}
        {...contentGuards}
      >
        <SheetHeader className="shrink-0">
          <SheetTitle>{p.title}</SheetTitle>
          {p.description && <SheetDescription>{p.description}</SheetDescription>}
        </SheetHeader>
        <div className="-my-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-1" onKeyDown={onKeyDown}>
          {p.children}
        </div>
        <div className="shrink-0 border-t p-6">{footer}</div>
      </SheetContent>
    </Sheet>
  );
}
