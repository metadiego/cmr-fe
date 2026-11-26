"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { SquareLock02Icon } from "@hugeicons/core-free-icons";

import type { Position } from "@/lib/api/positions";
import {
  effectivePrimary,
  positionLabel,
  togglePosition,
  type ChipBlock,
  type PositionGrid,
} from "@/lib/personal/positions";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// The positions grid shared by the staff record and the invite: one row per center with a chip per
// position, the full-access position as a separate switch (admins only), and the primary position.
// It only edits a PositionGrid; loading and saving belong to the caller. Every blocked chip says why,
// under its row (rule 8: never a grey control without a reason).
export function PositionsPicker({
  catalog,
  centers,
  grid,
  onChange,
  primary,
  onPrimaryChange,
  blockOf,
  viewerIsAdmin,
  idPrefix,
}: {
  catalog: Position[];
  centers: { id: string; name: string }[];
  grid: PositionGrid;
  onChange: (grid: PositionGrid) => void;
  primary: string | null;
  onPrimaryChange: (slug: string) => void;
  blockOf: (position: Position, centerId: string) => ChipBlock;
  viewerIsAdmin: boolean;
  /** Unique per mounted picker, for label/control ids. */
  idPrefix: string;
}) {
  const t = useTranslations("staffPositions");
  const tRoot = useTranslations();
  const label = (p: Position) => positionLabel(p.slug, tRoot, p.name);
  // No-permission positions first, then the ones that give access; alphabetical inside each group.
  const chips = React.useMemo(
    () =>
      catalog
        .filter((p) => !p.fullAccess)
        .sort((a, b) => Number(a.permissions > 0) - Number(b.permissions > 0) || label(a).localeCompare(label(b))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalog],
  );
  const adminPosition = catalog.find((p) => p.fullAccess);
  const shownPrimary = effectivePrimary(primary, grid, catalog);
  const held = catalog.filter(
    (p) => (p.fullAccess && grid.admin) || Object.values(grid.byCenter).some((slugs) => slugs.includes(p.slug)),
  );

  return (
    <div className="space-y-3">
      {adminPosition && (viewerIsAdmin || grid.admin) && (
        <div className="flex items-start justify-between gap-4 rounded-lg border px-3 py-2">
          <div className="space-y-0.5">
            <Label htmlFor={`${idPrefix}-admin`}>{t("adminSwitch")}</Label>
            <p className="text-xs text-muted-foreground">
              {viewerIsAdmin ? t("adminSwitchHelp") : t("blocked.carriesPermissions")}
            </p>
          </div>
          <Switch
            id={`${idPrefix}-admin`}
            checked={grid.admin}
            disabled={!viewerIsAdmin}
            onCheckedChange={(on) => onChange({ ...grid, admin: on })}
          />
        </div>
      )}

      {centers.map((c) => {
        const reasons = new Set<Exclude<ChipBlock, null>>();
        const inCenter = grid.byCenter[c.id] ?? [];
        return (
          <div key={c.id} className="space-y-1.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{c.name}</div>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((p) => {
                const on = inCenter.includes(p.slug);
                const block = blockOf(p, c.id);
                if (block) reasons.add(block);
                return (
                  <button
                    key={p.slug}
                    type="button"
                    aria-pressed={on}
                    disabled={block !== null}
                    title={p.permissions > 0 ? t("carriesPermissions") : undefined}
                    onClick={() => onChange(togglePosition(grid, c.id, p.slug))}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      on ? "border-primary/40 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-accent",
                      p.permissions > 0 && !on && "border-dashed",
                      block !== null && "cursor-not-allowed opacity-60 hover:bg-transparent",
                    )}
                  >
                    {p.permissions > 0 && (
                      <HugeiconsIcon icon={SquareLock02Icon} className="size-3" aria-label={t("carriesPermissions")} />
                    )}
                    {on ? "✓ " : ""}
                    {label(p)}
                  </button>
                );
              })}
            </div>
            {inCenter.length === 0 && <p className="text-xs text-muted-foreground">{t("none")}</p>}
            {[...reasons].map((r) => (
              <p key={r} className="text-xs text-muted-foreground">{t(`blocked.${r}`)}</p>
            ))}
          </div>
        );
      })}

      {held.length > 1 && shownPrimary && (
        <div className="grid gap-1.5 sm:max-w-xs">
          <Label htmlFor={`${idPrefix}-primary`}>{t("primary")}</Label>
          <Select value={shownPrimary} onValueChange={onPrimaryChange}>
            <SelectTrigger id={`${idPrefix}-primary`} className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {held.map((p) => <SelectItem key={p.slug} value={p.slug}>{label(p)}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t("primaryHelp")}</p>
        </div>
      )}
    </div>
  );
}
