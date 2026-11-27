"use client";

import * as React from "react";

import { getPositions, getStaffPositions, type Position, type StaffPositions } from "@/lib/api/positions";
import { getCenters, type Centro } from "@/lib/api/centers";
import { effectivePrimary, type PositionGrid } from "@/lib/personal/positions";
import { draftOnLoad, withoutPermissionPositions, type PositionsDraft } from "@/lib/personal/positions-draft";
import { useResource } from "@/hooks/use-resource";

const EMPTY: PositionGrid = { admin: false, byCenter: {} };

/**
 * The positions an invite will give. It starts from what the linked staff record already holds
 * (`staffId`) minus the permission positions cmr-be drops on linking, because the save sends the
 * COMPLETE list: starting empty would wipe them. No staffId
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

  // cmr-be drops the positions that carry permissions when the record gets its login, so the draft
  // starts without them (memoized: a new object every render would re-seed forever).
  // A new person's draft is a fresh empty load on every open, so a reopened dialog never keeps the
  // previous invite's chips (draftOnLoad keeps a draft while its source object is the same).
  const source = React.useMemo(
    () => (held ? withoutPermissionPositions(held) : held === null ? { primary: null, positions: [] } : held),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [held, enabled],
  );
  const [draft, setDraft] = React.useState<PositionsDraft | null>(null);
  const ready = source !== undefined && catalogRes.state.kind === "ok" && centersRes.state.kind === "ok";
  // Seeded during render (no effect): another linked record, or a fresh load, replaces the draft.
  if (ready) {
    const next = draftOnLoad(draft, source, catalog, centers.map((c) => c.id));
    if (next !== draft) setDraft(next);
  }
  const grid = draft?.grid ?? EMPTY;

  const failure =
    catalogRes.state.kind === "fail" ? catalogRes.state.message
    : centersRes.state.kind === "fail" ? centersRes.state.message
    : heldRes.state.kind === "fail" ? heldRes.state.message
    : null;

  return {
    catalog,
    centers: centers.map((c) => ({ id: c.id, name: c.name })),
    grid,
    setGrid: (g: PositionGrid) => setDraft((d) => (d ? { ...d, grid: g } : d)),
    primary: effectivePrimary(draft?.primary ?? null, grid, catalog),
    setPrimary: (p: string) => setDraft((d) => (d ? { ...d, primary: p } : d)),
    // Not ready while another record's positions load: submitting then would save the wrong list.
    ready: ready && draft?.source === source,
    failure,
  };
}
