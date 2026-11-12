"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { multiplierPatch } from "@/lib/factura/line-multipliers";

// The «(12 Días × 4 Áreas)» of a draft line, editable in place (BE #572): the desk no longer removes and
// re-adds a HILT / MLS / PEMF line to fix its areas. Saved on blur or Enter, only what changed; the
// quantity, total and header totals come back from the BE. Mount it keyed by the line's multipliers so a
// refetch reseeds it.
export function LineMultipliersEditor({
  multipliers,
  disabled,
  onSave,
}: {
  multipliers: Record<string, number>;
  disabled?: boolean;
  onSave: (meta: Record<string, number>) => void;
}) {
  const tRoot = useTranslations();
  const t = useTranslations("facturacion");
  const keys = Object.keys(multipliers);
  const [typed, setTyped] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(keys.map((k) => [k, String(multipliers[k])])),
  );
  const label = (k: string) => (tRoot.has(`fac.col.${k}`) ? tRoot(`fac.col.${k}`) : k);

  function commit() {
    const r = multiplierPatch(multipliers, typed);
    if (r.kind === "invalid") {
      toast.error(t("error.multiplicador_invalido", { field: label(r.field) }));
      setTyped((m) => ({ ...m, [r.field]: String(multipliers[r.field]) }));
      return;
    }
    if (r.kind === "patch") onSave(r.meta);
  }

  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground" title={t("multipliersEditHint")}>
      {keys.map((k, i) => (
        <React.Fragment key={k}>
          {i > 0 && <span aria-hidden>×</span>}
          <label className="flex items-center gap-1">
            <input
              value={typed[k] ?? ""}
              onChange={(e) => setTyped((m) => ({ ...m, [k]: e.target.value }))}
              onBlur={commit}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), e.currentTarget.blur())}
              disabled={disabled}
              inputMode="numeric"
              aria-label={label(k)}
              className="h-6 w-11 rounded border bg-background px-1 text-right text-xs tabular-nums text-foreground disabled:opacity-50"
            />
            {label(k)}
          </label>
        </React.Fragment>
      ))}
    </span>
  );
}
