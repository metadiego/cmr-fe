import type { components } from "./schema";
import type { Paginated } from "./types";
import { apiFetch, apiFetchPaged } from "./client";

// Inventario — proveedores, productos y catálogos de apoyo.
export type Producto = components["schemas"]["ProductoEntity"];

// `conProveedores=true` adjunta esta lista a cada producto (columna Proveedor).
export type ProductoConProveedores = Producto & {
  suppliers?: { id: string; name: string }[];
};

// Listado paginado para la pantalla Productos (§1 del hand-off). Solo params del
// whitelist del BE: soloFisicos, conProveedores, q, incluirInactivos, page, limit.
// Clase del catálogo (data-driven, 1:1 con producto.type): fisico=unico · insumo=base ·
// compuesto=compuesto · servicio=servicio. Las pestañas salen del BE (listClasesProducto).
export type ClaseProducto = "fisico" | "insumo" | "compuesto" | "servicio";

export function listProductosPaged(opts: {
  soloFisicos?: boolean;
  class?: ClaseProducto;
  conProveedores?: boolean;
  q?: string;
  incluirInactivos?: boolean;
  page?: number;
  limit?: number;
}): Promise<Paginated<ProductoConProveedores>> {
  const sp = new URLSearchParams();
  if (opts.class) sp.set("class", opts.class);
  if (opts.soloFisicos) sp.set("soloFisicos", "true");
  if (opts.conProveedores) sp.set("conProveedores", "true");
  if (opts.q?.trim()) sp.set("q", opts.q.trim());
  if (opts.incluirInactivos) sp.set("incluirInactivos", "true");
  sp.set("page", String(opts.page ?? 1));
  sp.set("limit", String(opts.limit ?? 50));
  return apiFetchPaged<ProductoConProveedores>(
    `/inventory/products?${sp.toString()}`,
  );
}

// Clases del catálogo para las pestañas (data-driven + i18n). GET /inventory/products/classes.
export interface ClaseProductoOpcion {
  class: string;
  labelKey: string;
}
export function listClasesProducto(): Promise<ClaseProductoOpcion[]> {
  return apiFetch<ClaseProductoOpcion[]>(`/inventory/products/classes`);
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
      return await apiFetch<Producto[]>(`/inventory/products?${sp.toString()}`);
    } catch {
      // BE sin soloFisicos/q → lista base y filtramos en cliente.
      const all = await apiFetch<Producto[]>(`/inventory/products?limit=100`);
      const needle = q?.toLowerCase();
      return all.filter((p) => {
        if (opts.soloFisicos && p.type === "servicio") return false;
        if (!needle) return true;
        return [p.name, p.sku, p.barcode]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle));
      });
    }
  }
  return apiFetch<Producto[]>(`/inventory/products?${sp.toString()}`);
}

// Proveedores (RBAC admin/super_admin). DELETE = baja lógica.
export function listProveedores(): Promise<Proveedor[]> {
  return apiFetch<Proveedor[]>(`/inventory/suppliers?limit=100`);
}
export function createProveedor(
  payload: CreateProveedorPayload,
): Promise<Proveedor> {
  return apiFetch<Proveedor>(`/inventory/suppliers`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
export function updateProveedor(
  id: string,
  payload: UpdateProveedorPayload,
): Promise<Proveedor> {
  return apiFetch<Proveedor>(`/inventory/suppliers/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
export function deleteProveedor(id: string): Promise<void> {
  return apiFetch<void>(`/inventory/suppliers/${id}`, { method: "DELETE" });
}

// `billingGroupId` (uuid | null) YA lo acepta el BE en create/update de producto (verificado por HTTP:
// PUT con el campo responde 200 y persiste). El schema generado aún no lo refleja (drift pendiente de
// gen:api), así que lo añadimos aquí explícitamente. null = "sin grupo" (insumo que se consume, no abre
// columna en frontdesk). Handoff HANDOFF-grupo-de-facturacion-en-la-ficha-del-producto.
export type CreateProductoPayload = components["schemas"]["CreateProductoDto"] & {
  billingGroupId?: string | null;
};
export type UpdateProductoPayload = components["schemas"]["UpdateProductoDto"] & {
  billingGroupId?: string | null;
};

export function createProducto(payload: CreateProductoPayload): Promise<Producto> {
  return apiFetch<Producto>(`/inventory/products`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
export function updateProducto(
  id: string,
  payload: UpdateProductoPayload,
): Promise<Producto> {
  return apiFetch<Producto>(`/inventory/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
export function deleteProducto(id: string): Promise<void> {
  return apiFetch<void>(`/inventory/products/${id}`, { method: "DELETE" });
}

// "¿Qué se descuenta si facturo esto?" — desglose YA EXPANDIDO (abre kits anidados, cantidades
// multiplicadas por el camino). Usa la MISMA función que la descarga real (no una copia). Contrato:
// GET /inventory/products/:id/simulated-deduction?quantity&includeOptionalItems=<id>,<id>
export type DescargaModo = "a_la_venta" | "a_la_entrega" | "no_descarga";
// Una línea que SÍ descuenta. `rutas` = por dónde llegó cada uno (array de caminos de productIds);
// con más de una ruta, es un DUPLICADO (se descuenta por dos caminos).
// NOTA: `rutas` NO está en el mapa BE → llega en español.
export type DescargaLinea = {
  productId: string;
  sku?: string | null;
  name?: string | null;
  technicalName?: string | null;
  quantity: number;
  deductionMode: DescargaModo;
  referenceCost?: number | null;
  rutas: string[][];
};
// Consumos ESTIMADOS: se reportan pero NO descargan (gasa, cánula). Se pintan aparte y en gris.
export type DescargaEstimado = {
  productId?: string | null;
  sku?: string | null;
  name?: string | null;
  quantity?: number | null;
  deductionMode?: DescargaModo | null;
};
// Avisos: `duplicado` (el mismo producto por dos caminos → se descontaría N veces, el fallo que originó
// esto), `ciclo` y `profundidad` (configuraciones rotas). NOTA: `veces` NO está en el mapa BE.
export type DescargaAviso = {
  type: "duplicado" | "ciclo" | "profundidad";
  productId?: string | null;
  veces?: number | null;
  ruta?: string[] | null;
};
// NOTA: `estimados` y `avisos` NO están en el mapa BE → llegan en español.
export type DescargaSimulada = {
  product: { id: string; sku?: string | null; name?: string | null; technicalName?: string | null };
  lines: DescargaLinea[];
  estimados: DescargaEstimado[];
  avisos: DescargaAviso[];
};
export function getDescargaSimulada(
  id: string,
  quantity = 1,
  includeOptionalItems?: string[],
): Promise<DescargaSimulada> {
  const sp = new URLSearchParams({ quantity: String(quantity) });
  if (includeOptionalItems && includeOptionalItems.length) sp.set("includeOptionalItems", includeOptionalItems.join(","));
  return apiFetch<DescargaSimulada>(`/inventory/products/${id}/simulated-deduction?${sp.toString()}`);
}

export function listUnidades(): Promise<Unidad[]> {
  return apiFetch<Unidad[]>(`/inventory/units?limit=100`);
}

// Clasificaciones por tipo (marca | fabricante | categoria | …).
export function listClasificaciones(type?: string): Promise<Clasificacion[]> {
  const qs = type ? `?type=${encodeURIComponent(type)}&limit=100` : `?limit=100`;
  return apiFetch<Clasificacion[]>(`/inventory/classifications${qs}`);
}

export type Almacen = components["schemas"]["AlmacenEntity"];
export type Ubicacion = components["schemas"]["UbicacionEntity"];

// `tenant`: undefined = centro activo; un id = almacenes de ESE centro (para elegir el
// almacén destino en una transferencia entre centros).
export function listAlmacenes(tenant?: string | null): Promise<Almacen[]> {
  return apiFetch<Almacen[]>(`/inventory/warehouses?limit=100`, {}, tenant);
}
// Ubicaciones (opcional; puede filtrar por almacén). Devuelve [] si el BE no soporta el filtro.
export function listUbicaciones(warehouseId?: string): Promise<Ubicacion[]> {
  const qs = warehouseId ? `?warehouseId=${warehouseId}&limit=100` : `?limit=100`;
  return apiFetch<Ubicacion[]>(`/inventory/locations${qs}`).catch(() => []);
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
  productId: string,
  opts: { active?: boolean } = {},
): Promise<PresentacionProveedor[]> {
  const sp = new URLSearchParams({ productId });
  if (opts.active !== undefined) sp.set("active", String(opts.active));
  return apiFetch<PresentacionProveedor[]>(
    `/inventory/supplier-presentations?${sp.toString()}`,
  );
}
export function createPresentacionProveedor(
  payload: CreatePresentacionProveedorPayload,
): Promise<PresentacionProveedor> {
  return apiFetch<PresentacionProveedor>(`/inventory/supplier-presentations`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
export function updatePresentacionProveedor(
  id: string,
  payload: UpdatePresentacionProveedorPayload,
): Promise<PresentacionProveedor> {
  return apiFetch<PresentacionProveedor>(
    `/inventory/supplier-presentations/${id}`,
    { method: "PUT", body: JSON.stringify(payload) },
  );
}
export function deletePresentacionProveedor(id: string): Promise<void> {
  return apiFetch<void>(`/inventory/supplier-presentations/${id}`, {
    method: "DELETE",
  });
}

// Presentaciones del PRODUCTO (el "vial": contenido + su unidad). Cambiar de vial = elegir la ACTIVA
// (isDefault); el BE deja exactamente UNA. `content`/`contentUnitId` los añadió el BE (drift del
// schema pendiente de gen:api). No hay borrado: se pone active:false y se queda (histórico/viales apuntan).
// Handoff HANDOFF-viales-presentaciones-y-remanente.
export type Presentacion = components["schemas"]["PresentacionEntity"] & {
  content?: number | null;
  contentUnitId?: string | null;
};
export type CreatePresentacionPayload = components["schemas"]["CreatePresentacionDto"] & {
  content?: number | null;
  contentUnitId?: string | null;
};
export type UpdatePresentacionPayload = components["schemas"]["UpdatePresentacionDto"] & {
  content?: number | null;
  contentUnitId?: string | null;
};
export function listPresentaciones(productId: string, centroId?: string): Promise<Presentacion[]> {
  return apiFetch<Presentacion[]>(`/inventory/presentations?productId=${encodeURIComponent(productId)}`, {}, centroId);
}
export function createPresentacion(payload: CreatePresentacionPayload, centroId?: string): Promise<Presentacion> {
  return apiFetch<Presentacion>(`/inventory/presentations`, { method: "POST", body: JSON.stringify(payload) }, centroId);
}
export function updatePresentacion(id: string, payload: UpdatePresentacionPayload, centroId?: string): Promise<Presentacion> {
  return apiFetch<Presentacion>(`/inventory/presentations/${id}`, { method: "PUT", body: JSON.stringify(payload) }, centroId);
}

// Viales ABIERTOS de un producto (por dosis): el remanente NO se guarda, se deriva de las dosis apuntadas
// contra el vial (corregir una dosis lo corrige solo). `remanente` nunca negativo: si se aplicó de más,
// llega remanente:0 + `excedido` con la diferencia (mostrar en ámbar, es dato a revisar). Campos nuevos
// del BE (schema stale). Ordenar por más viejo primero (orden en que el sistema los consume).
// NOTA: consumido/remanente/porcentajeUsado/agotado/excedido NO están en el mapa BE → llegan en español.
export type VialAbierto = components["schemas"]["VialAbiertoEntity"] & {
  consumido?: number;
  remanente?: number;
  porcentajeUsado?: number;
  agotado?: boolean;
  excedido?: number;
};
export function listVialesAbiertos(productId: string, centroId?: string): Promise<VialAbierto[]> {
  return apiFetch<VialAbierto[]>(`/inventory/open-vials?productId=${encodeURIComponent(productId)}`, {}, centroId);
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
  compositeProductId: string,
): Promise<ProductoComponente[]> {
  return apiFetch<ProductoComponente[]>(
    `/inventory/components?compositeProductId=${encodeURIComponent(compositeProductId)}`,
  );
}
export function createComponente(
  payload: CreateComponentePayload,
): Promise<ProductoComponente> {
  return apiFetch<ProductoComponente>(`/inventory/components`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
export function updateComponente(
  id: string,
  payload: UpdateComponentePayload,
): Promise<ProductoComponente> {
  return apiFetch<ProductoComponente>(`/inventory/components/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
export function deleteComponente(id: string): Promise<void> {
  return apiFetch<void>(`/inventory/components/${id}`, { method: "DELETE" });
}

// Compuestos (derivados). El endpoint de productos no filtra por `type` y `soloFisicos`
// EXCLUYE compuestos → traemos sin soloFisicos y filtramos type==='compuesto' en el FE.
export async function listCompuestos(q?: string): Promise<Producto[]> {
  const all = await listProductos({ q });
  return all.filter((p) => p.type === "compuesto");
}

// Recibir compra. CONTRATO CLAVE: con AMP, `quantity` = EMPAQUES y `unitCost` =
// costo POR EMPAQUE; el BE convierte a unidad base con factorABase. NO pre-convertir.
// Sin AMP: quantity/cost en unidad base directa.
export type RecibirCompraPayload = components["schemas"]["RecibirCompraDto"];
export function recibirCompra(payload: RecibirCompraPayload): Promise<unknown> {
  return apiFetch(`/inventory/operations/receive-purchase`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Recibir compra por PACKING LIST: una cabecera común + 1..200 líneas, todo-o-nada. OJO (verificado en
// el handoff recepcion-packing-list): a diferencia de receive-purchase de UNA línea, este endpoint NO
// convierte por empaque — `quantity` se guarda TAL CUAL, en la unidad de inventario del producto. Por eso
// la pantalla captura cantidad en unidad base (sin pre-conversión por AMP). Errores con labelKey:
// inventario.recepcion_sin_lineas / recepcion_demasiadas_lineas / recepcion_cantidad_invalida.
export interface RecibirCompraLoteItem {
  productId: string;
  quantity: number; // > 0, en la unidad de inventario del producto
  unitCost?: number;
  lotNumber?: string;
  expirationDate?: string; // YYYY-MM-DD
  supplierPresentationId?: string;
  locationId?: string;
  notes?: string; // gana a la nota común de la cabecera
}
export interface RecibirCompraLotePayload {
  warehouseId?: string; // si no va, el del centro activo
  supplierId?: string;
  purchaseInvoiceNumber?: string; // nº del PROVEEDOR, común a todas las líneas
  effectiveDate?: string; // YYYY-MM-DD (por defecto, ahora)
  notes?: string;
  items: RecibirCompraLoteItem[];
}
export interface RecibirCompraLoteResult {
  documentId: string;
  lines: Array<{ lot?: unknown; movement?: unknown }>;
}
export function recibirCompraLote(payload: RecibirCompraLotePayload): Promise<RecibirCompraLoteResult> {
  return apiFetch<RecibirCompraLoteResult>(`/inventory/operations/receive-purchase-lot`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Recepción DESDE el papel del proveedor (foto/pegado → emparejar → confirmar). El emparejamiento se
// APRENDE por proveedor: mandar el `texto` original de cada línea es lo que crea el alias, para que la
// próxima compra de ese proveedor llegue resuelta sola. NO escribe stock hasta confirmar. Perm
// inventario.recibir. Handoff recepcion-desde-factura.
// NOTA: texto/confirmado/sugerencias/confianza/listas/porRevisar/aliasAprendidos NO están en el mapa BE.
export interface RecepcionLineaEntrada {
  texto: string;
  quantity?: number | null;
  unitCost?: number | null;
  lotNumber?: string | null;
  expirationDate?: string | null;
}
export interface RecepcionSugerencia {
  productId: string;
  name: string;
  confianza: number; // 0..1
}
export interface RecepcionLineaEmparejada {
  texto: string;
  productId?: string | null;
  source?: "alias" | "sku" | null;
  confirmado: boolean;
  sugerencias: RecepcionSugerencia[];
  quantity?: number | null;
  unitCost?: number | null;
  lotNumber?: string | null;
  expirationDate?: string | null;
}
export interface EmparejarResult {
  listas: number;
  porRevisar: number;
  lines: RecepcionLineaEmparejada[];
}
export function emparejarRecepcion(
  lineas: RecepcionLineaEntrada[],
  supplierId?: string,
): Promise<EmparejarResult> {
  return apiFetch<EmparejarResult>(`/inventory/receipts/match`, {
    method: "POST",
    body: JSON.stringify({ ...(supplierId ? { supplierId } : {}), lines: lineas }),
  });
}
export interface ConfirmarRecepcionLinea {
  productId: string;
  texto: string; // ORIGINAL del proveedor → se aprende como alias
  quantity: number;
  unitCost?: number | null;
  lotNumber?: string | null;
  expirationDate?: string | null;
}
export interface ConfirmarRecepcionResult {
  documentId: string;
  lines?: unknown[];
  aliasAprendidos?: number;
}
export function confirmarRecepcion(payload: {
  warehouseId: string;
  supplierId?: string;
  purchaseInvoiceNumber?: string;
  effectiveDate?: string;
  notes?: string;
  lines: ConfirmarRecepcionLinea[];
}): Promise<ConfirmarRecepcionResult> {
  return apiFetch<ConfirmarRecepcionResult>(`/inventory/receipts/confirm`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Recibo de una recepción por lote (para volver a verlo tras guardar). Perm inventario.read.
export interface RecepcionLinea {
  productId?: string;
  product?: string | null;
  quantity?: number;
  unitCost?: number | null;
  lotNumber?: string | null;
  expirationDate?: string | null;
}
export interface Recepcion {
  documentId?: string;
  supplier?: string | null;
  purchaseInvoiceNumber?: string | null;
  effectiveDate?: string | null;
  warehouse?: string | null;
  notes?: string | null;
  lines: RecepcionLinea[];
}
export function getRecepcion(documentId: string): Promise<Recepcion> {
  return apiFetch<Recepcion>(`/inventory/operations/receipts/${encodeURIComponent(documentId)}`);
}

// ---- Ajuste de existencias ------------------------------------------------
// Los MOTIVOS son un catálogo del BE (`motivos_movimiento`), no una lista escrita aquí: el select se
// llena con esto y si mañana se agrega un motivo en la base, aparece sin tocar el FE. El BE valida la
// clave contra el catálogo y, si no existe, responde MOTIVO_INVALIDO con `motivosValidos`.
// See cmr-be/docs/specs/ajuste-de-inventario-handoff-fe.md
export interface MotivoMovimiento {
  id: string;
  slug: string;
  name: string;
  labelKey?: string | null;
  active?: boolean;
}

export function listMotivosMovimiento(
  tenant?: string | null,
): Promise<MotivoMovimiento[]> {
  return apiFetch<MotivoMovimiento[]>(
    `/inventory/movement-reasons`,
    {},
    tenant,
  );
}

// `quantity` SIEMPRE positiva; el sentido lo da `sign`. Las notas son obligatorias: un ajuste sin el
// por qué es un descuadre nuevo con otra cara.
export function ajustarExistencias(
  payload: {
    productId: string;
    warehouseId: string;
    quantity: number;
    sign: "positivo" | "negativo";
    reason: string;
    notes: string;
    lotId?: string;
    effectiveDate?: string;
  },
  tenant?: string | null,
): Promise<unknown> {
  return apiFetch(
    `/inventory/operations/adjust`,
    { method: "POST", body: JSON.stringify(payload) },
    tenant,
  );
}

// ---- Reporte de viales ----------------------------------------------------
// La foto de un producto que se dosifica en viales: cerrados, el que está en uso con su nivel, los que
// ya pasaron, y de qué vial salió cada dosis. El BE ya calcula remanente y porcentaje: aquí no se
// recalcula nada. See docs/specs/pantalla-de-viales.md
// NOTA: remanente/porcentaje/vialId/vialNumero/cerrados/historicos/consumos NO están en el mapa BE.
export interface VialDelReporte {
  id: string;
  number: number | null;
  status: string;
  totalCapacity: number;
  remanente: number;
  patientId?: string | null;
}

export interface VialActivoDelReporte extends VialDelReporte {
  capacity: number;
  /** 0–100, ya acotado por el BE. */
  porcentaje: number;
}

export interface ConsumoDelReporte {
  date: string;
  quantity: number;
  vialId: string;
  vialNumero: number | null;
  patientId: string | null;
  /** Nombre completo y récord: el BE los resuelve para que la tabla se pueda leer. */
  patient: string | null;
  medicalRecordNumber: string | null;
  sessionId: string | null;
  userId: string | null;
  // Factura que originó el consumo (BE arregló el join sesión↔factura: la descarga se etiqueta como
  // "aplicación", no "entrega"). null = carga vieja sin sesión detrás. El FE enlaza la dosis a su
  // factura. Handoff viales-enlazar-a-factura.
  invoiceId?: string | null;
  invoiceNumber?: string | null;
}

export interface ReporteViales {
  productId: string;
  cerrados: number;
  active: VialActivoDelReporte | null;
  historicos: VialDelReporte[];
  consumos: ConsumoDelReporte[];
}

export function getReporteViales(
  params: {
    productId: string;
    warehouseId?: string;
    from?: string;
    to?: string;
    patientId?: string;
  },
  tenant?: string | null,
): Promise<ReporteViales> {
  const qs = new URLSearchParams({ productId: params.productId });
  if (params.warehouseId) qs.set("warehouseId", params.warehouseId);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.patientId) qs.set("patientId", params.patientId);
  return apiFetch<ReporteViales>(
    `/inventory/open-vials/report?${qs.toString()}`,
    {},
    tenant,
  );
}
