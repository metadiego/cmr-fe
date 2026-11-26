import { apiFetch } from "./client";

// Positions held at a center (cmr-be docs/specs/positions-and-centers.md): one concept replaces job
// title, responsibilities, service centers and login roles/centers. Typed by hand: these routes are not
// in lib/api/schema.d.ts yet (same as lib/api/centers.ts).

/** A position anyone can hold (`GET /positions`). */
export interface Position {
  id: string;
  slug: string;
  name: string;
  labelKey: string | null;
  allCenters: boolean;
  /** Permissions it carries; 0 = it only says what the person does (pickers, label). */
  permissions: number;
  /** It grants full access ('*'): held everywhere, admin only. */
  fullAccess: boolean;
}

/** A position a person holds; `centerIds: null` = everywhere (only the full-access one). */
export interface HeldPosition {
  position: string;
  labelKey: string | null;
  permissions: number;
  centerIds: string[] | null;
}

export interface StaffPositions {
  primary: string | null;
  positions: HeldPosition[];
}

/** The COMPLETE list after the change: what is not listed is removed. */
export interface StaffPositionsBody {
  positions: { position: string; centerIds?: string[] }[];
  primary?: string;
}

export function getPositions(): Promise<Position[]> {
  return apiFetch<Position[]>(`/positions`);
}

export function getStaffPositions(staffId: string, centroId?: string): Promise<StaffPositions> {
  return apiFetch<StaffPositions>(`/staff/${staffId}/positions`, {}, centroId);
}

// 403 `positions.accessChangeNeedsAdmin` for a non-admin changing access; the admin position answers 428
// and apiFetch's confirmation shield asks and repeats it.
export function setStaffPositions(staffId: string, body: StaffPositionsBody, centroId?: string): Promise<StaffPositions> {
  return apiFetch<StaffPositions>(
    `/staff/${staffId}/positions`,
    { method: "PUT", body: JSON.stringify(body) },
    centroId,
  );
}
