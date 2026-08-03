import { apiFetch, apiFetchPaged } from "./client";
import type { Paginated } from "./types";

// Bitácora de auditoría (BE: AuditLogController, spec docs/specs/auditoria.md — ya en prod).
// El OpenAPI NO tipa la respuesta (operación vacía), así que estos tipos son LOCALES según el
// contrato del hand-off; regenerar con `npm run gen:api` cuando el BE exponga el schema.

// Una fila de la bitácora. `meta` hoy llega null en el 100% de las filas (no pintar columna).
export interface AuditRow {
  id: string;
  createdAt: string;
  clinicId: string | null;
  userId: string | null; // authUserId de Supabase (NO el perfilId).
  // Nombre visible resuelto por el BE (authUserId → perfil; email si no hay nombre). null = API key/cron/anónimo.
  usuarioNombre: string | null;
  userType: string | null; // "api-key" | "user"
  dominio: string;
  accion: string; // "Controller.handler" (técnico a propósito) → frase humana se arma en el FE
  metodo: string;
  ruta: string;
  requestId: string | null; // correlación con el envelope de la petición original
  ip: string | null;
  resultado: "ok" | "error";
  statusCode: number | null;
  durationMs: number | null;
  entidadId: string | null;
  errorCode: string | null;
  errorMensaje: string | null;
  meta: Record<string, unknown> | null;
}

// Todos opcionales. `userId` = authUserId. Filtros indexados (rápidos): createdAt(desde/hasta),
// dominio, userId, resultado. `metodo`/`clinicId` filtran de a un valor.
export interface AuditListParams {
  desde?: string;
  hasta?: string;
  userId?: string;
  dominio?: string;
  accion?: string;
  resultado?: "ok" | "error";
  metodo?: string;
  // soloCambios=true → solo POST/PUT/PATCH/DELETE ("quién creó, editó o borró").
  soloCambios?: boolean;
  // excluirErrorCode → oculta esos códigos (CSV). El BE hace (errorCode IS NULL OR NOT IN(...)) para
  // NO ocultar las mutaciones correctas; total y paginación salen bien → NO replicar en el cliente.
  excluirErrorCode?: string;
  clinicId?: string;
  page?: number;
  limit?: number;
}

// Valores realmente presentes (para poblar los desplegables sin hardcode). Acotado al centro del
// principal; acepta desde/hasta. GET /auditoria/facetas.
export interface AuditFacetas {
  dominios: string[];
  acciones: string[];
  errorCodes: string[];
}
export function getAuditoriaFacetas(
  window: { desde?: string; hasta?: string } = {},
  tenant: string | null = null,
): Promise<AuditFacetas> {
  const sp = new URLSearchParams();
  if (window.desde) sp.set("desde", window.desde);
  if (window.hasta) sp.set("hasta", window.hasta);
  const qs = sp.toString();
  return apiFetch<AuditFacetas>(`/auditoria/facetas${qs ? `?${qs}` : ""}`, {}, tenant);
}

// Resumen para las tarjetas/gráfico de la cabecera (conteos, NO filas). GET /auditoria/resumen.
// `porDia` viene ordenado por fecha desc. `descartadosDelProceso` es un contador EN MEMORIA del
// proceso, de TODOS los centros, que ignora las fechas → etiquetar aparte, NO sumar a los totales.
export interface AuditResumen {
  total: number;
  porResultado: { resultado: string; total: number }[];
  porDominio: { dominio: string; total: number }[];
  porErrorCode: { errorCode: string; total: number }[];
  porDia: { dia: string; total: number }[];
  descartadosDelProceso: { errorCode: string; total: number }[];
}
export function getAuditoriaResumen(
  window: { desde?: string; hasta?: string } = {},
  tenant: string | null = null,
): Promise<AuditResumen> {
  const sp = new URLSearchParams();
  if (window.desde) sp.set("desde", window.desde);
  if (window.hasta) sp.set("hasta", window.hasta);
  const qs = sp.toString();
  return apiFetch<AuditResumen>(`/auditoria/resumen${qs ? `?${qs}` : ""}`, {}, tenant);
}

// Purga de la bitácora. Permiso propio auditoria.purgar + rol admin, y EXIGE admin SIN X-Tenant-ID
// (borra de TODOS los centros → tenant null). IRREVERSIBLE. Multi-pasada: completa:false = queda
// backlog, volver a llamar. yaEnCurso:true = había otra corriendo (no borró nada, NO es error).
export interface AuditPurgaResult {
  errores: number;
  mutaciones: number;
  completa: boolean;
  yaEnCurso?: boolean;
}
export function purgarAuditoria(): Promise<AuditPurgaResult> {
  return apiFetch<AuditPurgaResult>(`/auditoria/purgar`, { method: "POST" }, null);
}

// GET /auditoria — endpoint CORRECTO (el atajo /auditoria/errores devuelve el 98% de las filas por
// el ruido de RATE_LIMITED, así que NO se usa; el filtro de errores se hace con resultado=error).
// El BE responde el envelope estándar { data: filas[], meta: { pagination } } → apiFetchPaged
// (verificado en prod 2026-08-02; el hand-off decía "apiFetch", pero la paginación va en meta).
// tenant null = sin X-Tenant-ID → el admin ve TODOS los centros; el filtro de centro va por clinicId.
export function listAuditoria(
  params: AuditListParams = {},
  tenant: string | null = null,
): Promise<Paginated<AuditRow>> {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && `${v}` !== "") sp.set(k, String(v));
  }
  const qs = sp.toString();
  return apiFetchPaged<AuditRow>(`/auditoria${qs ? `?${qs}` : ""}`, {}, tenant);
}
