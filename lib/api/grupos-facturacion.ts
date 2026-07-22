import type { components } from "./schema";
import { apiFetch, apiFetchPaged } from "./client";
import type { Producto } from "./inventario";

// Administración de GRUPOS DE FACTURACIÓN (crear/editar + membresía de productos).
// API-First: tipos del schema OpenAPI. Contrato verificado en prod (2026-07-21):
//   GET  /facturacion/columnas/grupos              → GrupoFacturacionEntity[]
//   POST /facturacion/columnas/grupos              (CrearGrupoFacturacionDto: clave, labelKey, division?)
//   PUT  /facturacion/columnas/grupos/:id          (UpdateGrupoFacturacionDto: labelKey?, division?, activo?)
//   PUT  /facturacion/columnas/grupos/:id/productos (GrupoProductosDto: productoIds[] — reemplaza membresía)
//   GET  /facturacion/columnas/divisiones          → {clave, labelKey}[] (data-driven, sin hardcode)
// See docs/specs/fe-grupos-facturacion-admin-handoff.md.

export type GrupoFacturacion = components["schemas"]["GrupoFacturacionEntity"];
export type CrearGrupoPayload = components["schemas"]["CrearGrupoFacturacionDto"];
export type ActualizarGrupoPayload = components["schemas"]["UpdateGrupoFacturacionDto"];

// El endpoint de divisiones sale sin tipar en Swagger (Record<string,never>); el BE devuelve
// `{clave, labelKey}[]` (columnas-facturacion.service.listarDivisiones). Se tipa aquí.
export interface Division {
  clave: string;
  labelKey: string;
}

export function listGruposFacturacion(): Promise<GrupoFacturacion[]> {
  return apiFetch<GrupoFacturacion[]>(`/facturacion/columnas/grupos`);
}

export function listDivisiones(): Promise<Division[]> {
  return apiFetch<Division[]>(`/facturacion/columnas/divisiones`);
}

export function crearGrupoFacturacion(
  payload: CrearGrupoPayload,
): Promise<GrupoFacturacion> {
  return apiFetch<GrupoFacturacion>(`/facturacion/columnas/grupos`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function actualizarGrupoFacturacion(
  id: string,
  payload: ActualizarGrupoPayload,
): Promise<GrupoFacturacion> {
  return apiFetch<GrupoFacturacion>(`/facturacion/columnas/grupos/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// Reemplaza la membresía del grupo: los productoIds que se envían QUEDAN; los demás se desasignan.
export function setProductosDeGrupo(
  id: string,
  productoIds: string[],
): Promise<void> {
  return apiFetch<void>(`/facturacion/columnas/grupos/${id}/productos`, {
    method: "PUT",
    body: JSON.stringify({ productoIds }),
  });
}

// Trae TODOS los productos (paginado) para armar la membresía y contar por grupo. El BE no expone
// productosCount en el grupo, así que se deriva del listado (cada producto trae grupoFacturacionId).
export async function listTodosProductos(): Promise<Producto[]> {
  const out: Producto[] = [];
  let page = 1;
  const limit = 200;
  for (;;) {
    const { items, pagination } = await apiFetchPaged<Producto>(
      `/inventario/productos?incluirInactivos=false&page=${page}&limit=${limit}`,
    );
    out.push(...items);
    const total = pagination?.total ?? out.length;
    if (out.length >= total || items.length === 0) break;
    page += 1;
    if (page > 50) break; // backstop
  }
  return out;
}
