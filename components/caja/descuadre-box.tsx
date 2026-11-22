"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon } from "@hugeicons/core-free-icons";

import { descuadreOf } from "@/lib/caja/descuadre";
import { money } from "@/lib/caja/totales";
import { cn } from "@/lib/utils";

// THE red box for cash that does not balance (owner, 21-nov-2026): cashier sheet, division consolidated
// and the cash total all use this one piece, never loose styles. Renders nothing when it balances,
// unless `force` (a notice that is red for another reason, e.g. a consolidated count by someone else).
export function DescuadreBox({
  label,
  difference,
  force,
  children,
  className,
}: {
  label: React.ReactNode;
  difference?: number | null;
  force?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("caja.descuadre");
  const d = descuadreOf(difference);
  if (!d && !force) return null;
  return (
    <div
      role="alert"
      className={cn("rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive", className)}
    >
      <div className="flex items-start justify-between gap-3 font-semibold">
        <span className="flex min-w-0 items-start gap-2">
          <HugeiconsIcon icon={Alert02Icon} className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">{label}</span>
        </span>
        {d && <span className="shrink-0 tabular-nums">{t(d.kind, { amount: money(d.amount) })}</span>}
      </div>
      {children && <div className="mt-1 pl-6 text-xs font-normal tabular-nums">{children}</div>}
    </div>
  );
}
