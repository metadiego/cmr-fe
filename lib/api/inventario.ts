import type { components } from "./schema";
import type { Paginated } from "./types";
import { apiFetch, apiFetchPaged } from "./client";

// Inventario — proveedores, productos y catálogos de apoyo.
export type Producto = components["schemas"]["ProductoEntity"];

// `conProveedores=true` adjunta esta lista a cada producto (columna Proveedor).
export type ProductoConProveedores = Producto & {
  proveedores?: { id: string; nombre: string }[];
};

// Listado paginado para la pantalla Productos (§1 del hand-off). Solo params del
// whitelist del BE: soloFisicos, conProveedores, q, incluirInactivos, page, limit.
export function listProductosPaged(opts: {
  soloFisicos?: boolean;
  conProveedores?: boolean;
  q?: string;
  incluirInactivos?: boolean;
  page?: number;
  limit?: number;
}): Promise<Paginated<ProductoConProveedores>> {
  const sp = new URLSearchParams();
  if (opts.soloFisicos) sp.set("soloFisicos", "true");
  if (opts.conProveedores) sp.set("conProveedores", "true");
  if (opts.q?.trim()) sp.set("q", opts.q.trim());
  if (opts.incluirInactivos) sp.set("incluirInactivos", "true");
  sp.set("page", String(opts.page ?? 1));
  sp.set("limit", String(opts.limit ?? 50));
  return apiFetchPaged<ProductoConProveedores>(
    `/inventario/productos?${sp.toString()}`,
  );
}
export type Unidad = components["schemas"]["UnidadEntity"];
export type Clasificacion = components["schemas"]["ClasificacionEntity"];

export type Proveedor = components["schemas"]["ProveedorEntity"];
export type CreateProveedorPayload = components["schemas"]["CreateProveedorDto"];
export type UpdateProveedorPayload = components["schemas"]["UpdateProveedorDto"];

// Catálogos de apoyo (pueden venir vacíos si el BE aún no los sembró).
// `soloFisicos`: excluye servicios/consultas (usar en TODO picker de productos).
// `q`: búsqueda server-side (nombre/sku/barcode). Usar con debounce en el picker.
// Resiliente: si el BE aún no soporta `soloFisicos`/`q` (400 — p.ej. prod sin deploy),
// cae a la lista completa y filtra servicios + texto en el cliente. Así funciona
// aunque el BE vaya atrás; cuando el BE los soporta, usa el filtrado server-side.
export async function listProductos(
  opts: { soloFisicos?: boolean; q?: string } = {},
): Promise<Producto[]> {
  const q = opts.q?.trim();
  const sp = new URLSearchParams({ limit: "100" });
  if (q) sp.set("q", q);
  if (opts.soloFisicos) sp.set("soloFisicos", "true");

  if (opts.soloFisicos || q) {
    try {
      return await apiFetch<Producto[]>(`/inventario/productos?${sp.toString()}`);
    } catch {
      // BE sin soloFisicos/q → lista base y filtramos en cliente.
      const all = await apiFetch<Producto[]>(`/inventario/productos?limit=100`);
      const needle = q?.toLowerCase();
      return all.filter((p) => {
        if (opts.soloFisicos && p.tipo === "servicio") return false;
        if (!needle) return true;
        return [p.nombre, p.sku, p.barcode]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle));
      });
    }
  }
  return apiFetch<Producto[]>(`/inventario/productos?${sp.toString()}`);
}

// Proveedores (RBAC admin/super_admin). DELETE = baja lógica.
export function listProveedores(): Promise<Proveedor[]> {
  return apiFetch<Proveedor[]>(`/inventario/proveedores?limit=100`);
}
export function createProveedor(
  payload: CreateProveedorPayload,
): Promise<Proveedor> {
  return apiFetch<Proveedor>(`/inventario/proveedores`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
export function updateProveedor(
  id: string,
  payload: UpdateProveedorPayload,
): Promise<Proveedor> {
  return apiFetch<Proveedor>(`/inventario/proveedores/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
export function deleteProveedor(id: string): Promise<void> {
  return apiFetch<void>(`/inventario/proveedores/${id}`, { method: "DELETE" });
}

export type CreateProductoPayload = components["schemas"]["CreateProductoDto"];
export type UpdateProductoPayload = components["schemas"]["UpdateProductoDto"];

export function createProducto(payload: CreateProductoPayload): Promise<Producto> {
  return apiFetch<Producto>(`/inventario/productos`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
export function updateProducto(
  id: string,
  payload: UpdateProductoPayload,
): Promise<Producto> {
  return apiFetch<Producto>(`/inventario/productos/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
export function deleteProducto(id: string): Promise<void> {
  return apiFetch<void>(`/inventario/productos/${id}`, { method: "DELETE" });
}

export function listUnidades(): Promise<Unidad[]> {
  return apiFetch<Unidad[]>(`/inventario/unidades?limit=100`);
}

// Clasificaciones por tipo (marca | fabricante | categoria | …).
export function listClasificaciones(tipo?: string): Promise<Clasificacion[]> {
  const qs = tipo ? `?tipo=${encodeURIComponent(tipo)}&limit=100` : `?limit=100`;
  return apiFetch<Clasificacion[]>(`/inventario/clasificaciones${qs}`);
}

export type Almacen = components["schemas"]["AlmacenEntity"];
export type Ubicacion = components["schemas"]["UbicacionEntity"];

// `tenant`: undefined = centro activo; un id = almacenes de ESE centro (para elegir el
// almacén destino en una transferencia entre centros).
export function listAlmacenes(tenant?: string | null): Promise<Almacen[]> {
  return apiFetch<Almacen[]>(`/inventario/almacenes?limit=100`, {}, tenant);
}
// Ubicaciones (opcional; puede filtrar por almacén). Devuelve [] si el BE no soporta el filtro.
export function listUbicaciones(almacenId?: string): Promise<Ubicacion[]> {
  const qs = almacenId ? `?almacenId=${almacenId}&limit=100` : `?limit=100`;
  return apiFetch<Ubicacion[]>(`/inventario/ubicaciones${qs}`).catch(() => []);
}

// AMP (presentación de proveedor) — dm+d: donde vive lo que cambia con el proveedor
// (concentración, contenido, factorABase). Catálogo GLOBAL. RBAC admin/super_admin.
export type PresentacionProveedor =
  components["schemas"]["PresentacionProveedorEntity"];
export type CreatePresentacionProveedorPayload =
  components["schemas"]["CreatePresentacionProveedorDto"];
export type UpdatePresentacionProveedorPayload =
  components["schemas"]["UpdatePresentacionProveedorDto"];

export function listPresentacionesProveedor(
  productoId: string,
  opts: { activo?: boolean } = {},
): Promise<PresentacionProveedor[]> {
  const sp = new URLSearchParams({ productoId });
  if (opts.activo !== undefined) sp.set("activo", String(opts.activo));
  return apiFetch<PresentacionProveedor[]>(
    `/inventario/presentaciones-proveedor?${sp.toString()}`,
  );
}
export function createPresentacionProveedor(
  payload: CreatePresentacionProveedorPayload,
): Promise<PresentacionProveedor> {
  return apiFetch<PresentacionProveedor>(`/inventario/presentaciones-proveedor`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
export function updatePresentacionProveedor(
  id: string,
  payload: UpdatePresentacionProveedorPayload,
): Promise<PresentacionProveedor> {
  return apiFetch<PresentacionProveedor>(
    `/inventario/presentaciones-proveedor/${id}`,
    { method: "PUT", body: JSON.stringify(payload) },
  );
}
export function deletePresentacionProveedor(id: string): Promise<void> {
  return apiFetch<void>(`/inventario/presentaciones-proveedor/${id}`, {
    method: "DELETE",
  });
}

// Recetas de compuestos (bill-of-materials): un producto `compuesto` (derivado) consume
// N componentes (base|unico) en cierta cantidad/unidad. Al vender/entregar, el BE descarga
// la receta. GET devuelve IDs crudos → el FE resuelve nombres con productos+unidades.
export type ProductoComponente = components["schemas"]["ProductoComponenteEntity"];
export type CreateComponentePayload =
  components["schemas"]["CreateProductoComponenteDto"];
export type UpdateComponentePayload =
  components["schemas"]["UpdateProductoComponenteDto"];

export function listComponentes(
  productoCompuestoId: string,
): Promise<ProductoComponente[]> {
  return apiFetch<ProductoComponente[]>(
    `/inventario/componentes?productoCompuestoId=${encodeURIComponent(productoCompuestoId)}`,
  );
}
export function createComponente(
  payload: CreateComponentePayload,
): Promise<ProductoComponente> {
  return apiFetch<ProductoComponente>(`/inventario/componentes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
export function updateComponente(
  id: string,
  payload: UpdateComponentePayload,
): Promise<ProductoComponente> {
  return apiFetch<ProductoComponente>(`/inventario/componentes/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
export function deleteComponente(id: string): Promise<void> {
  return apiFetch<void>(`/inventario/componentes/${id}`, { method: "DELETE" });
}

// Compuestos (derivados). El endpoint de productos no filtra por `tipo` y `soloFisicos`
// EXCLUYE compuestos → traemos sin soloFisicos y filtramos tipo==='compuesto' en el FE.
export async function listCompuestos(q?: string): Promise<Producto[]> {
  const all = await listProductos({ q });
  return all.filter((p) => p.tipo === "compuesto");
}

// Recibir compra. CONTRATO CLAVE: con AMP, `cantidad` = EMPAQUES y `costoUnitario` =
// costo POR EMPAQUE; el BE convierte a unidad base con factorABase. NO pre-convertir.
// Sin AMP: cantidad/costo en unidad base directa.
export type RecibirCompraPayload = components["schemas"]["RecibirCompraDto"];
export function recibirCompra(payload: RecibirCompraPayload): Promise<unknown> {
  return apiFetch(`/inventario/operaciones/recibir-compra`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
