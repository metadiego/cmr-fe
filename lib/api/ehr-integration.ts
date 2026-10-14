import { apiFetch } from "./client"

// Enganche con el EHR externo (cmr-ehr): al marcar PRESENTE en el tablero de Atención, el paciente
// queda también allá (se crea si no existe + se registra la llegada), lo hace el BE. El FE solo:
//  1) respeta el interruptor por centro (si está apagado, no pide nada ni bloquea),
//  2) comprueba que el paciente tiene los 5 datos que el EHR exige y, si falta alguno, bloquea Presente
//     con un modal hasta completarlos.
// Contrato: .personal/be-ehr-integration-presente-handoff.md. Diseño «enchufe»: apagado = inerte.

// Los 5 datos que exige el EHR. Las claves coinciden con campos de la ficha del paciente.
export type EhrReadinessField =
  | "idType"
  | "docId"
  | "sexo"
  | "fechaNacimiento"
  | "zipcode"

// GET /ehr-integration/patients/:id/readiness — ¿tiene los 5 datos? Permiso ehr-integration.read.
// `ehrPatientId`/`ehrRecordId` son INFORMATIVOS (ya está allá o no); el FE NO decide con ellos — el
// emparejamiento lo hace el BE por nuestro récord + código de centro (BAY-064230), no por nombre.
// `nuevo` (26-sep-2026, ya resuelto por el BE: nunca tuvo una cita con llegada sellada antes de
// esta): el modal de datos faltantes SOLO aplica a pacientes nuevos — a uno de seguimiento ya se le
// pidieron esos datos en persona, así que Presente sigue su curso aunque falten.
export interface EhrReadiness {
  listo: boolean
  faltantes: EhrReadinessField[]
  ehrPatientId?: string | null
  ehrRecordId?: string | null
  nuevo: boolean
}
// `tipo` (cmr-be PR #393): Consulta y Servicios bloquean por su propio interruptor
// (`enabledForConsultations`/`enabledForServices`). Omitido = "consulta" (default del BE), así el
// flujo de Consulta que ya llamaba esto sin `tipo` sigue funcionando sin cambios.
export function getEhrReadiness(
  patientId: string,
  centroId?: string,
  tipo?: EhrIntegrationTipo
): Promise<EhrReadiness> {
  const qs = tipo ? `?tipo=${tipo}` : ""
  return apiFetch<EhrReadiness>(
    `/ehr-integration/patients/${patientId}/readiness${qs}`,
    {},
    centroId
  )
}

// GET/PUT /ehr-integration/config — dos interruptores INDEPENDIENTES por centro (cmr-be PR #393,
// 04-oct-2026): prender uno NO prende el otro. Antes era un solo `habilitado` que gobernaba
// Consulta Y cualquier servicio con `pushesToEhrOnPresente` juntos — breaking change, campo
// renombrado, no solo agregado. Sin fila para un centro = los dos apagados.
// Permiso ehr-integration.config. Aceptan ?centerIds= para resolver permiso contra otros centros.
export type EhrIntegrationTipo = "consulta" | "servicio"
export interface EhrConfig {
  enabledForConsultations: boolean
  enabledForServices: boolean
  // Where the claim code of a new EHR patient prints (a center_printers.id), through the branch hub's
  // print queue. null = not set. Handoff codigo-de-alta-del-ehr.
  claimCodePrinterId?: string | null
}
function centerQs(centerIds?: string[]): string {
  if (!centerIds?.length) return ""
  return (
    "?" + centerIds.map((id) => `centerIds=${encodeURIComponent(id)}`).join("&")
  )
}
export function getEhrConfig(
  centroId?: string,
  centerIds?: string[]
): Promise<EhrConfig> {
  return apiFetch<EhrConfig>(
    `/ehr-integration/config${centerQs(centerIds)}`,
    {},
    centroId
  )
}
// Manda SOLO los campos que cambiaron (el DTO real los trata todos como opcionales) — nunca el
// objeto `EhrConfig` completo, para no apagar por accidente el otro tipo.
export function setEhrConfig(
  cambios: Partial<EhrConfig>,
  centroId?: string,
  centerIds?: string[]
): Promise<EhrConfig> {
  return apiFetch<EhrConfig>(
    `/ehr-integration/config${centerQs(centerIds)}`,
    { method: "PUT", body: JSON.stringify(cambios) },
    centroId
  )
}

// Huérfanos del EHR: pacientes creados en el otro sistema (desde su «Registrar llegada») que aún no están
// atados a uno nuestro. El BE propone el nuestro cuando el documento coincide (`pacienteSugeridoId`), o
// `null` si hay que elegirlo a mano. GET /ehr-integration/orphans (permiso ehr-integration.read).
export interface EhrOrphan {
  ehrPatientId: string
  ehrRecordId: string | null
  nombre: string | null
  fechaNacimiento: string | null
  documento: string | null
  pacienteSugeridoId: string | null
}
export async function listEhrOrphans(
  limit = 500,
  centroId?: string
): Promise<EhrOrphan[]> {
  const res = await apiFetch<unknown>(
    `/ehr-integration/orphans?limit=${limit}`,
    {},
    centroId
  )
  if (Array.isArray(res)) return res as EhrOrphan[]
  const items = (res as { items?: unknown } | null)?.items
  return Array.isArray(items) ? (items as EhrOrphan[]) : []
}

// PUT /ehr-integration/patients/:patientId/link — ata NUESTRO paciente al del EHR. Permiso ehr-integration.config.
export function linkEhrPatient(
  patientId: string,
  body: { ehrPatientId: string; ehrRecordId: string | null },
  centroId?: string
): Promise<unknown> {
  return apiFetch(
    `/ehr-integration/patients/${patientId}/link`,
    { method: "PUT", body: JSON.stringify(body) },
    centroId
  )
}

// Lectura del interruptor TOLERANTE a que el BE aún no esté desplegado (hoy responde 404): cualquier
// fallo → apagado. Así el enganche nace inerte y nunca rompe Presente hasta que el BE exista y alguien
// lo encienda. Es el «enchufe» del handoff (apagado y no pasa nada). Por TIPO desde PR #393: Consulta
// y Servicios prenden/apagan por separado.
export async function isEhrEnabled(
  centroId: string | undefined,
  tipo: EhrIntegrationTipo
): Promise<boolean> {
  try {
    const cfg = await getEhrConfig(centroId)
    return tipo === "consulta"
      ? !!cfg.enabledForConsultations
      : !!cfg.enabledForServices
  } catch {
    return false
  }
}

// ——— Vincular PERSONAL con el EHR (crear/actualizar/habilitar-deshabilitar) ———
// Handoff docs/specs/vincular-personal-con-el-ehr-handoff-fe.md. BE: PR #381 (cmr-be), mergeado a
// main 2026-10-01, TODAVÍA NO desplegado a producción (verificado en vivo: /ehr-integration/roles
// responde 404 en prod a esa fecha) — las funciones de abajo están escritas contra el contrato
// documentado, pendientes de confirmar por HTTP real en cuanto el BE despliegue.

// Roles del EHR: lista VIVA (sembrados + los que el cliente cree a mano allá, p. ej. "waldemar") —
// NUNCA una lista fija en el FE. Permiso ehr-integration.read.
export interface EhrRole {
  id: string
  name: string
  description: string | null
  isSystem: boolean
}
export function getEhrRoles(centroId?: string): Promise<EhrRole[]> {
  return apiFetch<EhrRole[]>(`/ehr-integration/roles`, {}, centroId)
}

// Vínculos personal↔EHR ya guardados. Permiso ehr-integration.read.
// OJO: el handoff documentaba `personalId`, pero la v2 real responde `staffId` — verificado en vivo
// contra producción el 2026-10-01 (GET /ehr-integration/staff-links, 200, 17 vínculos reales). El
// nombre de la RUTA (`/staff-links/:personalId/...`) sigue tal cual el handoff; solo el campo del
// CUERPO de la lista difiere. Nunca confiar en el handoff sin probar por HTTP — así se encontró esto.
//
// La cuenta del EHR NO es por centro (una persona, una cuenta), pero el BE la guarda contra el centro
// donde se creó: consultar con un solo `X-Tenant-ID` activo deja AFUERA a cualquiera vinculado desde
// otro centro — verificado en vivo el 2026-10-01 (Glorimar/Javier, dados de alta en Bayamón, salían
// "sin vincular" al mirar su ficha desde Caguas). El endpoint ya acepta `centerIds` (mismo patrón que
// `getEhrConfig`) para resolver el permiso contra varios centros a la vez; la UI debe mandar TODOS los
// centros de la persona o del que mira, no solo el activo. Regla «Permisos por centro» del CLAUDE.md.
export interface EhrStaffLink {
  staffId: string
  name: string
  ehrUserId: string
  ehrEmail: string
}
export async function listEhrStaffLinks(
  centroId?: string,
  centerIds?: string[]
): Promise<EhrStaffLink[]> {
  const res = await apiFetch<unknown>(
    `/ehr-integration/staff-links${centerQs(centerIds)}`,
    {},
    centroId
  )
  if (Array.isArray(res)) return res as EhrStaffLink[]
  const items = (res as { items?: unknown } | null)?.items
  return Array.isArray(items) ? (items as EhrStaffLink[]) : []
}

// Crea la cuenta del EHR para esta persona (o actualiza el rol si ya existía — `created: false`,
// NUNCA duplica). Del lado del EHR dispara un correo REAL de invitación (su propio POST
// /users/invite) — avisar en la UI antes de confirmar, no es un efecto nuestro. Permiso
// ehr-integration.config.
export interface EhrProvisionResult {
  ehrUserId: string
  created: boolean
}
export function provisionEhrStaff(
  personalId: string,
  ehrRoleId: string,
  centroId?: string
): Promise<EhrProvisionResult> {
  return apiFetch<EhrProvisionResult>(
    `/ehr-integration/staff-links/${personalId}/provision`,
    { method: "POST", body: JSON.stringify({ ehrRoleId }) },
    centroId
  )
}

// Actualiza la cuenta YA vinculada (hoy solo el rol) — no vuelve a pedir el correo, eso no cambia.
// Permiso ehr-integration.config.
export function updateEhrStaffLink(
  personalId: string,
  payload: { ehrRoleId?: string; fullName?: string },
  centroId?: string
): Promise<EhrStaffLink> {
  return apiFetch<EhrStaffLink>(
    `/ehr-integration/staff-links/${personalId}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    centroId
  )
}
