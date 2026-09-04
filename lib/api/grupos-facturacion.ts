import type { components } from "./schema";
import { apiFetch, apiFetchPaged } from "./client";
import type { Producto } from "./inventario";

// Administración de GRUPOS DE FACTURACIÓN (crear/editar + membresía de productos).
// API-First: tipos del schema OpenAPI. Contrato verificado en prod (2026-07-21):
//   GET  /billing/columns/groups              → GrupoFacturacionEntity[]
//   POST /billing/columns/groups              (CrearGrupoFacturacionDto: slug, labelKey, division?)
//   PUT  /billing/columns/groups/:id          (UpdateGrupoFacturacionDto: labelKey?, division?, active?)
//   PUT  /billing/columns/groups/:id/products (GrupoProductosDto: productoIds[] — reemplaza membresía)
//   GET  /billing/columns/divisions           → {slug, labelKey}[] (data-driven, sin hardcode)
// See docs/specs/fe-grupos-facturacion-admin-handoff.md.

export type GrupoFacturacion = components["schemas"]["GrupoFacturacionEntity"];
export type CrearGrupoPayload = components["schemas"]["CrearGrupoFacturacionDto"];
export type ActualizarGrupoPayload = components["schemas"]["UpdateGrupoFacturacionDto"];

// Esquema de columnas de línea, por grupo (los 7 roles de fábrica + los campos EXTRA que definen
// qué se le pregunta al empleado al facturar y cuáles multiplican el precio). Contrato verificado
// en prod (2026-08-10): GET/POST /billing/columns, PUT /billing/columns/:id — sin DELETE,
// "quitar" es PUT con active:false. FE-HANDOFF-MULTIPLICADOR-GRUPOS-FACTURACION.
export type ColumnaFacturacion = components["schemas"]["ColumnaFacturacionEntity"];
export type CrearColumnaPayload = components["schemas"]["CrearColumnaFacturacionDto"];
export type ActualizarColumnaPayload = components["schemas"]["UpdateColumnaFacturacionDto"];

// Roles de fábrica: todo grupo los tiene, no se editan/borran desde "Cómo se cobra".
export const ROLES_DE_FABRICA = [
  "producto",
  "cantidad",
  "precio",
  "descuento",
  "impuesto",
  "subtotal",
  "accion",
] as const;

export function getColumnasDeGrupo(grupoClave: string): Promise<ColumnaFacturacion[]> {
  return apiFetch<ColumnaFacturacion[]>(
    `/billing/columns?group=${encodeURIComponent(grupoClave)}`,
  );
}

export function crearColumnaFacturacion(
  payload: CrearColumnaPayload,
): Promise<ColumnaFacturacion> {
  return apiFetch<ColumnaFacturacion>(`/billing/columns`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function actualizarColumnaFacturacion(
  id: string,
  payload: ActualizarColumnaPayload,
): Promise<ColumnaFacturacion> {
  return apiFetch<ColumnaFacturacion>(`/billing/columns/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// El endpoint de divisiones sale sin tipar en Swagger (Record<string,never>); el BE devuelve
// `{slug, labelKey}[]` (columnas-facturacion.service.listarDivisiones). Se tipa aquí.
export interface Division {
  slug: string;
  labelKey: string;
}

export function listGruposFacturacion(): Promise<GrupoFacturacion[]> {
  return apiFetch<GrupoFacturacion[]>(`/billing/columns/groups`);
}

export function listDivisiones(): Promise<Division[]> {
  return apiFetch<Division[]>(`/billing/columns/divisions`);
}

export function crearGrupoFacturacion(
  payload: CrearGrupoPayload,
): Promise<GrupoFacturacion> {
  return apiFetch<GrupoFacturacion>(`/billing/columns/groups`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function actualizarGrupoFacturacion(
  id: string,
  payload: ActualizarGrupoPayload,
): Promise<GrupoFacturacion> {
  return apiFetch<GrupoFacturacion>(`/billing/columns/groups/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// Reemplaza la membresía del grupo: los productoIds que se envían QUEDAN; los demás se desasignan.
// La clave `productoIds` NO está en el mapa api-ingles → se envía tal cual (el DTO la espera en español).
export function setProductosDeGrupo(
  id: string,
  productoIds: string[],
): Promise<void> {
  return apiFetch<void>(`/billing/columns/groups/${id}/products`, {
    method: "PUT",
    body: JSON.stringify({ productoIds }),
  });
}

// Trae TODOS los productos (paginado) para armar la membresía y contar por grupo. El BE no expone
// productosCount en el grupo, así que se deriva del listado (cada producto trae billingGroupId).
// `incluirInactivos` NO está en el mapa api-ingles → se envía tal cual (el BE no la traduce).
export async function listTodosProductos(): Promise<Producto[]> {
  const out: Producto[] = [];
  let page = 1;
  const limit = 100; // máximo permitido por el BE (PaginationQueryDto @Max(100))
  for (;;) {
    const { items, pagination } = await apiFetchPaged<Producto>(
      `/inventory/products?incluirInactivos=false&page=${page}&limit=${limit}`,
    );
    out.push(...items);
    const total = pagination?.total ?? out.length;
    if (out.length >= total || items.length === 0) break;
    page += 1;
    if (page > 50) break; // backstop
  }
  return out;
}
