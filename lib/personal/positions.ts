// Positions held at centers, as the staff record edits them (cmr-be docs/specs/positions-and-centers.md):
// a grid center → positions, plus the full-access position as a separate switch. Pure, so the rules the
// BE enforces (403/428) are known before saving and every blocked chip can say why. Run: `npm test`.
import type { Position, StaffPositions, StaffPositionsBody } from "../api/positions.ts";

/** next-intl's translator, reduced to what a label needs. */
export type Translator = { has(key: string): boolean; (key: string): string };

/** One label for a position slug everywhere: `positions.<slug>`, then the old `personal.cargo.<slug>`, then the name, then the slug. */
export function positionLabel(slug: string, t: Translator, name?: string | null): string {
  for (const key of [`positions.${slug}`, `personal.cargo.${slug}`]) if (t.has(key)) return t(key);
  return name || slug;
}

/** Slugs per center (sorted, no empty centers); `admin` = holds the full-access position. */
export type PositionGrid = { admin: boolean; byCenter: Record<string, string[]> };

function normalize(byCenter: Record<string, Iterable<string>>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const c of Object.keys(byCenter).sort()) {
    const slugs = [...new Set(byCenter[c])].sort();
    if (slugs.length) out[c] = slugs;
  }
  return out;
}

const isFullAccess = (slug: string, catalog: readonly Position[]) =>
  catalog.some((p) => p.slug === slug && p.fullAccess);

/**
 * The grid for what the BE returned. A normal position with `centerIds: null` (old data; the BE refuses
 * to save it that way) is spread over `centerIds`, so saving it untouched sends explicit centers.
 */
export function gridFromStaff(held: StaffPositions, catalog: readonly Position[], centerIds: readonly string[]): PositionGrid {
  let admin = false;
  const byCenter: Record<string, string[]> = {};
  for (const h of held.positions) {
    if (isFullAccess(h.position, catalog)) {
      admin = true;
      continue;
    }
    for (const c of h.centerIds ?? centerIds) (byCenter[c] ??= []).push(h.position);
  }
  return { admin, byCenter: normalize(byCenter) };
}

export function togglePosition(grid: PositionGrid, centerId: string, slug: string): PositionGrid {
  const current = grid.byCenter[centerId] ?? [];
  const next = current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug];
  return { admin: grid.admin, byCenter: normalize({ ...grid.byCenter, [centerId]: next }) };
}

/** The person's centers: those where they hold at least one position. */
export function centersOf(grid: PositionGrid): string[] {
  return Object.keys(grid.byCenter).sort();
}

function heldSlugs(grid: PositionGrid, catalog: readonly Position[]): string[] {
  const slugs = [...new Set(Object.values(grid.byCenter).flat())].sort();
  const admin = catalog.find((p) => p.fullAccess)?.slug;
  return grid.admin && admin ? [admin, ...slugs] : slugs;
}

/** The primary while it is still held; else the first held position; null when none. */
export function effectivePrimary(primary: string | null, grid: PositionGrid, catalog: readonly Position[]): string | null {
  const held = heldSlugs(grid, catalog);
  if (primary && held.includes(primary)) return primary;
  const firstNormal = held.find((s) => !isFullAccess(s, catalog));
  return firstNormal ?? held[0] ?? null;
}

/** The PUT body: the complete list, one entry per position with its centers; full access without centers. */
export function buildPositionsBody(grid: PositionGrid, primary: string | null, catalog: readonly Position[]): StaffPositionsBody {
  const centersBySlug = new Map<string, string[]>();
  for (const c of centersOf(grid)) for (const s of grid.byCenter[c]) centersBySlug.set(s, [...(centersBySlug.get(s) ?? []), c]);
  const positions: StaffPositionsBody["positions"] = [];
  const admin = catalog.find((p) => p.fullAccess)?.slug;
  if (grid.admin && admin) positions.push({ position: admin });
  for (const s of [...centersBySlug.keys()].sort()) positions.push({ position: s, centerIds: centersBySlug.get(s)! });
  const p = effectivePrimary(primary, grid, catalog);
  return p ? { positions, primary: p } : { positions };
}

export function sameGrid(a: PositionGrid, b: PositionGrid): boolean {
  return a.admin === b.admin && JSON.stringify(normalize(a.byCenter)) === JSON.stringify(normalize(b.byCenter));
}

/** Why a chip cannot be toggled by this viewer; null = it can. Same rules as the BE (403). */
export type ChipBlock = "carriesPermissions" | "loginCenterNeedsAdmin" | "noCenterAccess" | null;

export function chipState(args: {
  position: Position;
  centerId: string;
  grid: PositionGrid;
  viewerIsAdmin: boolean;
  hasLogin: boolean;
  canEditCenter: boolean;
}): ChipBlock {
  const { position, centerId, grid, viewerIsAdmin, hasLogin, canEditCenter } = args;
  if (!canEditCenter) return "noCenterAccess";
  if (viewerIsAdmin) return null;
  if (position.permissions > 0) return "carriesPermissions";
  if (hasLogin) {
    // Toggling it changes where the login works when it is the center's first or last position.
    const held = grid.byCenter[centerId] ?? [];
    const after = held.includes(position.slug) ? held.length - 1 : held.length + 1;
    if (held.length === 0 || after === 0) return "loginCenterNeedsAdmin";
  }
  return null;
}
