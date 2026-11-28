import type { components } from "./schema";
import { apiFetch } from "./client";

// Functions (cmr-be docs/specs/access-skills-and-usual-week.md): what a person does — a service or a
// task — with no center. Never opens a screen (that is the access role). The list responses have no
// response DTO in the OpenAPI, so their shape is typed here from the BE handoff §2.1–2.2.

export type FunctionKind = "service" | "task";
export type FunctionPlace = "in_person" | "any_center";

/** A function a person holds (`GET /staff/:id/functions`). */
export interface StaffFunction {
  slug: string;
  /** i18n key; null for services and functions created later: show `name` then. */
  labelKey: string | null;
  name: string;
  kind: FunctionKind;
  serviceSlug: string | null;
  place: FunctionPlace;
}

/** A catalog row (`GET /functions`). `active = false`: not offered, kept by whoever holds it. */
export interface CatalogFunction extends StaffFunction {
  active: boolean;
  sortOrder: number;
}

export type CreateFunctionBody = components["schemas"]["CreateFunctionDto"];
export type UpdateFunctionBody = components["schemas"]["UpdateFunctionDto"];

export function getFunctions(includeInactive = false): Promise<CatalogFunction[]> {
  return apiFetch<CatalogFunction[]>(`/functions${includeInactive ? "?includeInactive=true" : ""}`);
}

/** Full access only (`rbac.create`). 409 `functions.duplicate`, 400 `functions.unknownService` / `kindServiceMismatch`. */
export function createFunction(body: CreateFunctionBody): Promise<CatalogFunction> {
  return apiFetch<CatalogFunction>(`/functions`, { method: "POST", body: JSON.stringify(body) });
}

/** Full access only (`rbac.update`). `kind` and `serviceSlug` never change. */
export function updateFunction(slug: string, body: UpdateFunctionBody): Promise<CatalogFunction> {
  return apiFetch<CatalogFunction>(`/functions/${encodeURIComponent(slug)}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function getStaffFunctions(staffId: string, centerId?: string): Promise<StaffFunction[]> {
  return apiFetch<StaffFunction[]>(`/staff/${staffId}/functions`, {}, centerId);
}

/**
 * The COMPLETE list. Removing a function a job position backs also removes that position (BE
 * feat/functions-drop-job-position); for a login that moves its centers, only an admin (403
 * `positions.accessChangeNeedsAdmin`).
 */
export function setStaffFunctions(staffId: string, body: { functions: string[] }, centerId?: string): Promise<StaffFunction[]> {
  return apiFetch<StaffFunction[]>(`/staff/${staffId}/functions`, { method: "PUT", body: JSON.stringify(body) }, centerId);
}
