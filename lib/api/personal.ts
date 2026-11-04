import type { components } from "./schema";
import { apiFetch, apiFetchPaged, oneCenterPath, tenantOf } from "./client";
import type { CenterChoice } from "@/lib/clinic-read-scope";
import type { Paginated } from "./types";

// Staff member. `capacidades` includes role-like tags (e.g. "medico") used to
// filter who can be assigned to an appointment.
export type Personal = components["schemas"]["PersonalEntity"];

// A staff row of a list over clinics (cmr-be clinic-read-scope, `withServiceCenters`): one row per person,
// `clinicName` = the home clinic (`clinicId`, where the record was created), `servesInCenters` = the
// clinics of the read's scope where the person shows up in pickers. Declared by hand until `gen:api`
// brings them into the schema.
export type PersonalEnAlcance = Personal & {
  clinicName?: string | null;
  servesInCenters?: { clinicId: string; clinicName: string | null }[];
};

// `frontdeskStartsOnConsultation` (BE PR #386, EN REVISIÓN — sin desplegar a esta fecha): dato de la
// persona, mismo GET/PUT /staff/:id de siempre, sin ruta nueva. Se declara A MANO porque el schema
// generado todavía no lo trae (gen:api necesita el BE local en :3001, no disponible en esta sesión) —
// quitar este tipo y usar el campo real en cuanto `npm run gen:api` lo traiga. Handoff
// aterrizar-en-consulta-handoff-fe. SIN VERIFICAR EN VIVO: el PUT con este campo no se ha probado
// contra prod (el BE de hoy no lo conoce todavía); si lo rechaza, falla con un toast, no rompe nada más.
export type PersonalConPreferenciaFrontdesk = Personal & {
  frontdeskStartsOnConsultation?: boolean | null;
  // Con qué pestaña de ESTADO abre el tablero de Consulta (clave del estado, p. ej. "presente"); null =
  // como está hoy. Es de la PERSONA que mira (handoff traer-al-dia-y-la-pestana-inicial-de-consulta). Mismo
  // GET/PUT /staff/:id; se declara a mano hasta que `npm run gen:api` lo traiga (igual que el campo hermano).
  consultationBoardInitialTab?: string | null;
};

export interface ListPersonalParams {
  page?: number;
  limit?: number;
  q?: string;
  capacidad?: string;
  // Bajas lógicas: `onlyInactive` solo los dados de baja (para verlos/reactivarlos), `includeInactive` los
  // mezcla con los activos. Verificado en vivo contra /api/v2/staff. Handoff personal-crud-completo.
  onlyInactive?: boolean;
  includeInactive?: boolean;
}

// Which clinics the read covers (`CenterChoice`, lib/clinic-read-scope.ts): a single clinic string (the
// doctor pickers and every one-clinic screen: someone of another clinic is never offered there, e.g.
// Emma/Javier of Caguas showing up in Bayamón), the clinic filter's ticked ids, `null` for every clinic
// where the person holds personal.read, or `undefined` for the one X-Tenant-ID carries. Handoff
// selector-de-centro / clinic-read-scope.
export async function listPersonal(
  params: ListPersonalParams = {},
  centroId?: CenterChoice,
): Promise<Paginated<PersonalEnAlcance>> {
  const { page = 1, limit = 50, q, capacidad, onlyInactive, includeInactive } = params;
  const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (q?.trim()) sp.set("q", q.trim());
  if (capacidad) sp.set("capacity", capacidad);
  if (onlyInactive) sp.set("onlyInactive", "true");
  if (includeInactive) sp.set("includeInactive", "true");
  return apiFetchPaged<PersonalEnAlcance>(
    await oneCenterPath(`/staff?${sp.toString()}`, centroId),
    {},
    tenantOf(centroId),
  );
}

// Every page of a staff list (the BE caps `limit` at 100), for the staff screen across clinics.
export async function listPersonalAll(
  params: Omit<ListPersonalParams, "page" | "limit"> = {},
  centroId?: CenterChoice,
): Promise<PersonalEnAlcance[]> {
  const limit = 100;
  const first = await listPersonal({ ...params, page: 1, limit }, centroId);
  const pages = Math.ceil(first.pagination.total / limit);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) => listPersonal({ ...params, page: i + 2, limit }, centroId)),
  );
  return [first, ...rest].flatMap((r) => r.items);
}

// Ficha de UN miembro (GET /staff/:id) para el hub del médico. Tenant-scoped; `centroId` fuerza el centro.
export function getStaff(id: string, centroId?: string): Promise<Personal> {
  return apiFetch<Personal>(`/staff/${id}`, {}, centroId);
}

// Campos editables de la ficha (PUT /staff/:id). Se escriben a mano porque el schema generado va DETRÁS del
// BE (p. ej. `color`/`sex` se añadieron al DTO el 3-oct y gen:api no corrió en esta sesión — necesita el BE
// local). Verificado en vivo que /staff/:id acepta name/lastName/specialty/phone/email/sex/color/active +
// jobTitle/capabilities/profileId. `initials` NO va: el BE las recalcula solas. Handoff personal-crud-completo.
export type StaffEditable = {
  name?: string;
  lastName?: string | null;
  jobTitle?: string | null;
  capabilities?: string[];
  specialty?: string | null;
  phone?: string | null;
  email?: string | null;
  sex?: string | null;
  color?: string;
  profileId?: string | null;
  active?: boolean;
};

// Editar la ficha (PUT /personal/:id). Verificado en prod. Handoff personal-crud-completo / ficha-de-personal.
export function updatePersonal(
  id: string,
  payload: StaffEditable,
  centroId?: string,
): Promise<Personal> {
  return apiFetch<Personal>(`/staff/${id}`, { method: "PUT", body: JSON.stringify(payload) }, centroId);
}

// Alta de personal (POST /staff). `name` es lo único obligatorio; los centros se asignan aparte con
// updatePersonalCentros (regla del BE: sin centros no aparece en selects). Handoff personal-crud-completo.
export function createPersonal(payload: StaffEditable, centroId?: string): Promise<Personal> {
  return apiFetch<Personal>(`/staff`, { method: "POST", body: JSON.stringify(payload) }, centroId);
}

// Baja LÓGICA (DELETE /staff/:id): la persona sigue firmando sus citas/facturas y conserva su cartera; se
// reactiva con updatePersonal(active:true). Handoff personal-crud-completo.
export function deletePersonal(id: string, centroId?: string): Promise<unknown> {
  return apiFetch(`/staff/${id}`, { method: "DELETE" }, centroId);
}

// Catálogo de cargos (GET /personal/cargos) → [{ clave, labelKey }]. Ruta arreglada por el BE (antes
// colisionaba con /personal/:id). Handoff huecos-lectura-personal.
export interface CargoCatalogo {
  slug: string;
  labelKey?: string | null; // se dice igual (CAMPOS_IGUALES)
  name?: string | null;
}
export function getCargos(centroId?: string): Promise<CargoCatalogo[]> {
  return apiFetch<CargoCatalogo[]>(`/staff/job-titles`, {}, centroId);
}

// Centros de SERVICIO de una persona (LECTURA, GET /personal/:id/centros): devuelve TODOS los centros del
// sistema con un `activo` por cada uno, YA RESUELTO por el BE (incluye el caso de la ficha sin lista, que
// aparece activa en su centro de origen). El FE NO replica esa regla — pinta lo que llega. Handoff
// huecos-lectura-personal.
export interface CentroDePersonal {
  id: string;
  name: string;
  active: boolean;
}
export function getPersonalCentros(id: string, centroId?: string): Promise<CentroDePersonal[]> {
  return apiFetch<CentroDePersonal[]>(`/staff/${id}/centers`, {}, centroId);
}

// Guardar los centros ACTIVOS de la persona (PUT /personal/:id/centros { centroIds }). Se manda la lista
// de los que quedan ENCENDIDOS; el BE deja el set exactamente así.
// `centroIds` NO está en el mapa de campos → el body va tal cual (el middleware lo deja pasar al DTO).
export function updatePersonalCentros(id: string, centroIds: string[], centroId?: string): Promise<Personal> {
  return apiFetch<Personal>(`/staff/${id}/centers`, { method: "PUT", body: JSON.stringify({ centroIds }) }, centroId);
}

// Guardado APARTE del de cargo/capacidades (updatePersonal) a propósito: si el BE de hoy todavía no
// conoce `frontdeskStartsOnConsultation` (PR #386 sin desplegar) y lo rechaza, que falle SOLO este
// interruptor con su propio toast — nunca el guardado de cargo/capacidades, que es otro dominio y ya
// funciona. Ver PersonalConPreferenciaFrontdesk arriba. Handoff aterrizar-en-consulta-handoff-fe.
export function updateFrontdeskStartsOnConsultation(
  id: string,
  frontdeskStartsOnConsultation: boolean,
  centroId?: string,
): Promise<PersonalConPreferenciaFrontdesk> {
  return apiFetch<PersonalConPreferenciaFrontdesk>(
    `/staff/${id}`,
    { method: "PUT", body: JSON.stringify({ frontdeskStartsOnConsultation }) },
    centroId,
  );
}

// Guardado APARTE (su propio PUT, su propio toast) de la pestaña inicial del tablero de Consulta, por el
// mismo motivo que su hermano de arriba: si falla, que no tumbe el guardado de cargo/capacidades. `null`
// = volver al comportamiento por defecto. Acepta la clave de CUALQUIER estado del tablero (dato, no código).
// Handoff traer-al-dia-y-la-pestana-inicial-de-consulta.
export function updateConsultationBoardInitialTab(
  id: string,
  consultationBoardInitialTab: string | null,
  centroId?: string,
): Promise<PersonalConPreferenciaFrontdesk> {
  return apiFetch<PersonalConPreferenciaFrontdesk>(
    `/staff/${id}`,
    { method: "PUT", body: JSON.stringify({ consultationBoardInitialTab }) },
    centroId,
  );
}

// Roster por CAPACIDAD (enfermera/tecnico/medico…), agnóstico al tablero: GET /personal/por-capacidad/:cap.
// Alimenta el selector de enfermera del modal de Notificar aunque la columna fd_enfermera NO esté
// colocada en ese tablero (p. ej. Atención). Devuelve {id, nombre, apellido}. Verificado en prod.
export interface PersonalPorCapacidad {
  id: string;
  name: string;
  lastName?: string | null;
}
export async function listPersonalPorCapacidad(capacidad: string, centro?: string): Promise<PersonalPorCapacidad[]> {
  const path = await oneCenterPath(`/staff/capacity-by/${encodeURIComponent(capacidad)}`, centro);
  return apiFetch<PersonalPorCapacidad[]>(path, {}, centro);
}

// Doctors available to be assigned to appointments (capacidad = "medico"). `centroId` recarga la lista
// con los médicos del centro que se está mirando (selector de centro EN la pantalla).
export async function getMedicos(centroId?: string): Promise<Personal[]> {
  const { items } = await listPersonal({ capacidad: "medico", limit: 100 }, centroId);
  return items;
}
