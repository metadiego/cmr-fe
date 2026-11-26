"use client";

import * as React from "react";

import { getPositions, getStaffPositions, type Position, type StaffPositions } from "@/lib/api/positions";
import { getCenters, type Centro } from "@/lib/api/centers";
import { effectivePrimary, gridFromStaff, type PositionGrid } from "@/lib/personal/positions";
import { useResource } from "@/hooks/use-resource";

const EMPTY: PositionGrid = { admin: false, byCenter: {} };

/**
 * The positions an invite will give. It starts from what the linked staff record already holds
 * (`staffId`), because the save sends the COMPLETE list: starting empty would wipe them. No staffId
 * (a new person) → empty. `enabled` is the dialog's `open`: nothing loads while it is closed.
 */
export function usePositionsDraft(staffId: string | null, enabled: boolean, centro?: string) {
  const catalogRes = useResource<Position[]>(() => (enabled ? getPositions() : Promise.resolve([])), [enabled]);
  const centersRes = useResource<Centro[]>(() => (enabled ? getCenters() : Promise.resolve([])), [enabled]);
  const heldRes = useResource<StaffPositions | null>(
    () => (enabled && staffId ? getStaffPositions(staffId, centro) : Promise.resolve(null)),
    [enabled, staffId, centro],
  );
  const catalog = React.useMemo(() => (catalogRes.state.kind === "ok" ? catalogRes.state.data : []), [catalogRes.state]);
  const centers = React.useMemo(() => (centersRes.state.kind === "ok" ? centersRes.state.data : []), [centersRes.state]);
  const held = heldRes.state.kind === "ok" ? heldRes.state.data : undefined;

  const [loadedFrom, setLoadedFrom] = React.useState<StaffPositions | null | undefined>(undefined);
  const [grid, setGrid] = React.useState<PositionGrid>(EMPTY);
  const [primary, setPrimary] = React.useState<string | null>(null);
  const ready = held !== undefined && catalogRes.state.kind === "ok" && centersRes.state.kind === "ok";
  // Adjusted during render (no effect): another linked record, or a fresh load, replaces the draft.
  if (ready && held !== loadedFrom) {
    const g = held ? gridFromStaff(held, catalog, centers.map((c) => c.id)) : EMPTY;
    setLoadedFrom(held);
    setGrid(g);
    setPrimary(held ? effectivePrimary(held.primary, g, catalog) : null);
  }

  const failure =
    catalogRes.state.kind === "fail" ? catalogRes.state.message
    : centersRes.state.kind === "fail" ? centersRes.state.message
    : heldRes.state.kind === "fail" ? heldRes.state.message
    : null;

  return {
    catalog,
    centers: centers.map((c) => ({ id: c.id, name: c.name })),
    grid,
    setGrid,
    primary: effectivePrimary(primary, grid, catalog),
    setPrimary,
    ready,
    failure,
  };
}
