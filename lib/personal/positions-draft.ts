// The edit state of a person's positions (staff record section and invite dialogs), kept pure so the
// "what was loaded / what was saved / what is being edited" rules are tested. A draft remembers the
// loaded object it was seeded from (`source`): a re-render with that same object never re-seeds it,
// so a save's result is not overwritten by the pre-save load still held by the fetcher.
import type { Position, StaffPositions } from "../api/positions.ts";
import { effectivePrimary, gridFromStaff, sameGrid, type PositionGrid } from "./positions.ts";

export type PositionsDraft = {
  source: StaffPositions | null;
  savedGrid: PositionGrid;
  savedPrimary: string | null;
  grid: PositionGrid;
  primary: string | null;
};

const EMPTY: StaffPositions = { primary: null, positions: [] };

function seed(source: StaffPositions | null, catalog: readonly Position[], centerIds: readonly string[]): Omit<PositionsDraft, "source"> {
  const grid = gridFromStaff(source ?? EMPTY, catalog, centerIds);
  const primary = effectivePrimary((source ?? EMPTY).primary, grid, catalog);
  return { savedGrid: grid, savedPrimary: primary, grid, primary };
}

/** Seeds from a load; returns the same draft when `loaded` is the object it was seeded from. */
export function draftOnLoad(
  draft: PositionsDraft | null,
  loaded: StaffPositions | null,
  catalog: readonly Position[],
  centerIds: readonly string[],
): PositionsDraft {
  if (draft && draft.source === loaded) return draft;
  return { source: loaded, ...seed(loaded, catalog, centerIds) };
}

/** After a save: the result becomes both the saved and the edited state; `source` is kept. */
export function draftOnSave(
  draft: PositionsDraft,
  result: StaffPositions,
  catalog: readonly Position[],
  centerIds: readonly string[],
): PositionsDraft {
  return { source: draft.source, ...seed(result, catalog, centerIds) };
}

export function isDraftDirty(draft: PositionsDraft, catalog: readonly Position[]): boolean {
  return (
    !sameGrid(draft.grid, draft.savedGrid) ||
    effectivePrimary(draft.primary, draft.grid, catalog) !== draft.savedPrimary
  );
}

/**
 * The positions a staff record keeps when it gets a login: cmr-be drops every position that carries
 * permissions on linking (staff-positions.service `dropPermissionPositions`), so an invite starts
 * from the rest. An admin can still choose permission positions on purpose.
 */
export function withoutPermissionPositions(held: StaffPositions): StaffPositions {
  const positions = held.positions.filter((p) => p.permissions === 0);
  return {
    positions,
    primary: positions.some((p) => p.position === held.primary) ? held.primary : null,
  };
}
