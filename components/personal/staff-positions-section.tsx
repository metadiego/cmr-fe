"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { Personal } from "@/lib/api/personal";
import { getStaffPositions, setStaffPositions, type Position, type StaffPositions } from "@/lib/api/positions";
import { getCenters, getCentrosDondePuedo, type Centro } from "@/lib/api/centers";
import {
  buildPositionsBody,
  centersOf,
  chipState,
  effectivePrimary,
  gridFromStaff,
  sameGrid,
  type PositionGrid,
} from "@/lib/personal/positions";
import { useResource } from "@/hooks/use-resource";
import { useMe, isAdmin } from "@/hooks/use-me";
import { Label } from "@/components/ui/label";
import { useSaveSection } from "@/components/personal/save-group";
import { PositionsPicker } from "@/components/personal/positions-picker";

// «Puestos» on the staff record (docs/specs/positions-and-centers.md §2): what the person does at each
// center; their centers are the rows with a position. It replaces job title, responsibilities, service
// centers and the login's roles/centers. Saved with the record's single "Save" as the COMPLETE list.
// `centro` = the person's home clinic, where the record is read and written (as the other sections).
export function StaffPositionsSection({
  persona,
  catalog,
  centro,
}: {
  persona: Personal;
  catalog: Position[];
  centro?: string;
}) {
  const t = useTranslations("staffPositions");
  const me = useMe();
  const viewerIsAdmin = me.kind === "ok" && isAdmin(me.me);
  const heldRes = useResource<StaffPositions>(() => getStaffPositions(persona.id, centro), [persona.id, centro]);
  const centersRes = useResource<Centro[]>(() => getCenters());
  const editableRes = useResource<Centro[]>(() => getCentrosDondePuedo("staff.update").catch(() => []));

  const centers = React.useMemo(() => (centersRes.state.kind === "ok" ? centersRes.state.data : []), [centersRes.state]);
  const editable = React.useMemo(
    () => new Set((editableRes.state.kind === "ok" ? editableRes.state.data : []).map((c) => c.id)),
    [editableRes.state],
  );
  const centerIds = React.useMemo(() => centers.map((c) => c.id), [centers]);
  const held = heldRes.state.kind === "ok" ? heldRes.state.data : null;

  // Saved state and the edit over it; a fresh load replaces the edit (adjusted during render, no effect).
  const [prevHeld, setPrevHeld] = React.useState<StaffPositions | null>(null);
  const [saved, setSaved] = React.useState<{ grid: PositionGrid; primary: string | null } | null>(null);
  const [grid, setGrid] = React.useState<PositionGrid | null>(null);
  const [primary, setPrimary] = React.useState<string | null>(null);
  const ready = held !== null && centersRes.state.kind === "ok" && catalog.length > 0;
  if (ready && held !== prevHeld) {
    const g = gridFromStaff(held, catalog, centerIds);
    const p = effectivePrimary(held.primary, g, catalog);
    setPrevHeld(held);
    setSaved({ grid: g, primary: p });
    setGrid(g);
    setPrimary(p);
  }

  const shownPrimary = grid ? effectivePrimary(primary, grid, catalog) : null;
  const dirty = !!grid && !!saved && (!sameGrid(grid, saved.grid) || shownPrimary !== saved.primary);
  useSaveSection("positions", dirty, async () => {
    if (!grid) throw new Error("positions are not loaded");
    const result = await setStaffPositions(persona.id, buildPositionsBody(grid, primary, catalog), centro);
    const g = gridFromStaff(result, catalog, centerIds);
    const p = effectivePrimary(result.primary, g, catalog);
    setPrevHeld(result);
    setSaved({ grid: g, primary: p });
    setGrid(g);
    setPrimary(p);
  });

  // Rows: every center the viewer can edit staff in, plus every center where the person already holds
  // a position (shown read-only when the viewer cannot edit there).
  const rows = grid
    ? centers.filter((c) => editable.has(c.id) || centersOf(grid).includes(c.id)).map((c) => ({ id: c.id, name: c.name }))
    : [];

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="space-y-0.5">
        <Label>{t("title")}</Label>
        <p className="text-xs text-muted-foreground">{t("help")}</p>
      </div>
      {heldRes.state.kind === "fail" && <p className="text-sm text-destructive">{heldRes.state.message}</p>}
      {centersRes.state.kind === "fail" && <p className="text-sm text-destructive">{centersRes.state.message}</p>}
      {!grid && heldRes.state.kind !== "fail" && centersRes.state.kind !== "fail" && (
        <div className="space-y-2" aria-hidden>
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="h-7 w-full animate-pulse rounded-full bg-muted" />
        </div>
      )}
      {grid && (
        <>
          <PositionsPicker
            idPrefix={`staff-${persona.id}`}
            catalog={catalog}
            centers={rows}
            grid={grid}
            onChange={setGrid}
            primary={shownPrimary}
            onPrimaryChange={setPrimary}
            viewerIsAdmin={viewerIsAdmin}
            blockOf={(position, centerId) =>
              chipState({
                position,
                centerId,
                grid,
                viewerIsAdmin,
                hasLogin: !!persona.profileId,
                canEditCenter: viewerIsAdmin || editable.has(centerId),
              })
            }
          />
          {centersOf(grid).length === 0 && !grid.admin && <p className="text-xs text-warning-foreground">{t("noneAtAll")}</p>}
        </>
      )}
    </div>
  );
}
