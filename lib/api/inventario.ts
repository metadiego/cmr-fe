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
// Clase del catálogo (data-driven, 1:1 con producto.tipo): fisico=unico · insumo=base ·
// compuesto=compuesto · servicio=servicio. Las pestañas salen del BE (listClasesProducto).
export type ClaseProducto = "fisico" | "insumo" | "compuesto" | "servicio";

export function listProductosPaged(opts: {
  soloFisicos?: boolean;
  clase?: ClaseProducto;
  conProveedores?: boolean;
  q?: string;
  incluirInactivos?: boolean;
  page?: number;
  limit?: number;
}): Promise<Paginated<ProductoConProveedores>> {
  const sp = new URLSearchParams();
  if (opts.clase) sp.set("clase", opts.clase);
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

// Clases del catálogo para las pestañas (data-driven + i18n). GET /inventario/productos/clases.
export interface ClaseProductoOpcion {
  clase: string;
  labelKey: string;
}
export function listClasesProducto(): Promise<ClaseProductoOpcion[]> {
  return apiFetch<ClaseProductoOpcion[]>(`/inventario/productos/clases`);
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

// `grupoFacturacionId` (uuid | null) YA lo acepta el BE en create/update de producto (verificado por HTTP:
// PUT con el campo responde 200 y persiste). El schema generado aún no lo refleja (drift pendiente de
// gen:api), así que lo añadimos aquí explícitamente. null = "sin grupo" (insumo que se consume, no abre
// columna en frontdesk). Handoff HANDOFF-grupo-de-facturacion-en-la-ficha-del-producto.
export type CreateProductoPayload = components["schemas"]["CreateProductoDto"] & {
  grupoFacturacionId?: string | null;
};
export type UpdateProductoPayload = components["schemas"]["UpdateProductoDto"] & {
  grupoFacturacionId?: string | null;
};

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

// "¿Qué se descuenta si facturo esto?" — desglose YA EXPANDIDO (abre kits anidados, cantidades
// multiplicadas por el camino). Usa la MISMA función que la descarga real (no una copia). Contrato:
// GET /inventario/productos/:id/descarga-simulada?cantidad&incluirOpcionales=<id>,<id>
export type DescargaModo = "a_la_venta" | "a_la_entrega" | "no_descarga";
// Una línea que SÍ descuenta. `rutas` = por dónde llegó cada uno (array de caminos de productoIds);
// con más de una ruta, es un DUPLICADO (se descuenta por dos caminos).
export type DescargaLinea = {
  productoId: string;
  sku?: string | null;
  nombre?: string | null;
  nombreTecnico?: string | null;
  cantidad: number;
  modoDescarga: DescargaModo;
  costoReferencia?: number | null;
  rutas: string[][];
};
// Consumos ESTIMADOS: se reportan pero NO descargan (gasa, cánula). Se pintan aparte y en gris.
export type DescargaEstimado = {
  productoId?: string | null;
  sku?: string | null;
  nombre?: string | null;
  cantidad?: number | null;
  modoDescarga?: DescargaModo | null;
};
// Avisos: `duplicado` (el mismo producto por dos caminos → se descontaría N veces, el fallo que originó
// esto), `ciclo` y `profundidad` (configuraciones rotas).
export type DescargaAviso = {
  tipo: "duplicado" | "ciclo" | "profundidad";
  productoId?: string | null;
  veces?: number | null;
  ruta?: string[] | null;
};
export type DescargaSimulada = {
  producto: { id: string; sku?: string | null; nombre?: string | null; nombreTecnico?: string | null };
  lineas: DescargaLinea[];
  estimados: DescargaEstimado[];
  avisos: DescargaAviso[];
};
export function getDescargaSimulada(
  id: string,
  cantidad = 1,
  incluirOpcionales?: string[],
): Promise<DescargaSimulada> {
  const sp = new URLSearchParams({ cantidad: String(cantidad) });
  if (incluirOpcionales && incluirOpcionales.length) sp.set("incluirOpcionales", incluirOpcionales.join(","));
  return apiFetch<DescargaSimulada>(`/inventario/productos/${id}/descarga-simulada?${sp.toString()}`);
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

// Presentaciones del PRODUCTO (el "vial": contenido + su unidad). Cambiar de vial = elegir la ACTIVA
// (esDefault); el BE deja exactamente UNA. `contenido`/`unidadContenidoId` los añadió el BE (drift del
// schema pendiente de gen:api). No hay borrado: se pone activo:false y se queda (histórico/viales apuntan).
// Handoff HANDOFF-viales-presentaciones-y-remanente.
export type Presentacion = components["schemas"]["PresentacionEntity"] & {
  contenido?: number | null;
  unidadContenidoId?: string | null;
};
export type CreatePresentacionPayload = components["schemas"]["CreatePresentacionDto"] & {
  contenido?: number | null;
  unidadContenidoId?: string | null;
};
export type UpdatePresentacionPayload = components["schemas"]["UpdatePresentacionDto"] & {
  contenido?: number | null;
  unidadContenidoId?: string | null;
};
export function listPresentaciones(productoId: string, centroId?: string): Promise<Presentacion[]> {
  return apiFetch<Presentacion[]>(`/inventario/presentaciones?productoId=${encodeURIComponent(productoId)}`, {}, centroId);
}
export function createPresentacion(payload: CreatePresentacionPayload, centroId?: string): Promise<Presentacion> {
  return apiFetch<Presentacion>(`/inventario/presentaciones`, { method: "POST", body: JSON.stringify(payload) }, centroId);
}
export function updatePresentacion(id: string, payload: UpdatePresentacionPayload, centroId?: string): Promise<Presentacion> {
  return apiFetch<Presentacion>(`/inventario/presentaciones/${id}`, { method: "PUT", body: JSON.stringify(payload) }, centroId);
}

// Viales ABIERTOS de un producto (por dosis): el remanente NO se guarda, se deriva de las dosis apuntadas
// contra el vial (corregir una dosis lo corrige solo). `remanente` nunca negativo: si se aplicó de más,
// llega remanente:0 + `excedido` con la diferencia (mostrar en ámbar, es dato a revisar). Campos nuevos
// del BE (schema stale). Ordenar por más viejo primero (orden en que el sistema los consume).
export type VialAbierto = components["schemas"]["VialAbiertoEntity"] & {
  consumido?: number;
  remanente?: number;
  porcentajeUsado?: number;
  agotado?: boolean;
  excedido?: number;
};
export function listVialesAbiertos(productoId: string, centroId?: string): Promise<VialAbierto[]> {
  return apiFetch<VialAbierto[]>(`/inventario/viales-abiertos?productoId=${encodeURIComponent(productoId)}`, {}, centroId);
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

// Recibir compra por PACKING LIST: una cabecera común + 1..200 líneas, todo-o-nada. OJO (verificado en
// el handoff recepcion-packing-list): a diferencia de recibir-compra de UNA línea, este endpoint NO
// convierte por empaque — `cantidad` se guarda TAL CUAL, en la unidad de inventario del producto. Por eso
// la pantalla captura cantidad en unidad base (sin pre-conversión por AMP). Errores con labelKey:
// inventario.recepcion_sin_lineas / recepcion_demasiadas_lineas / recepcion_cantidad_invalida.
export interface RecibirCompraLoteItem {
  productoId: string;
  cantidad: number; // > 0, en la unidad de inventario del producto
  costoUnitario?: number;
  numeroLote?: string;
  fechaVencimiento?: string; // YYYY-MM-DD
  presentacionProveedorId?: string;
  ubicacionId?: string;
  notas?: string; // gana a la nota común de la cabecera
}
export interface RecibirCompraLotePayload {
  almacenId?: string; // si no va, el del centro activo
  proveedorId?: string;
  numeroFacturaCompra?: string; // nº del PROVEEDOR, común a todas las líneas
  fechaEfectiva?: string; // YYYY-MM-DD (por defecto, ahora)
  notas?: string;
  items: RecibirCompraLoteItem[];
}
export interface RecibirCompraLoteResult {
  documentoId: string;
  lineas: Array<{ lote?: unknown; movimiento?: unknown }>;
}
export function recibirCompraLote(payload: RecibirCompraLotePayload): Promise<RecibirCompraLoteResult> {
  return apiFetch<RecibirCompraLoteResult>(`/inventario/operaciones/recibir-compra-lote`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Recibo de una recepción por lote (para volver a verlo tras guardar). Perm inventario.read.
export interface RecepcionLinea {
  productoId?: string;
  producto?: string | null;
  cantidad?: number;
  costoUnitario?: number | null;
  numeroLote?: string | null;
  fechaVencimiento?: string | null;
}
export interface Recepcion {
  documentoId?: string;
  proveedor?: string | null;
  numeroFacturaCompra?: string | null;
  fechaEfectiva?: string | null;
  almacen?: string | null;
  notas?: string | null;
  lineas: RecepcionLinea[];
}
export function getRecepcion(documentoId: string): Promise<Recepcion> {
  return apiFetch<Recepcion>(`/inventario/operaciones/recepciones/${encodeURIComponent(documentoId)}`);
}

// ---- Ajuste de existencias ------------------------------------------------
// Los MOTIVOS son un catálogo del BE (`motivos_movimiento`), no una lista escrita aquí: el select se
// llena con esto y si mañana se agrega un motivo en la base, aparece sin tocar el FE. El BE valida la
// clave contra el catálogo y, si no existe, responde MOTIVO_INVALIDO con `motivosValidos`.
// See cmr-be/docs/specs/ajuste-de-inventario-handoff-fe.md
export interface MotivoMovimiento {
  id: string;
  clave: string;
  nombre: string;
  labelKey?: string | null;
  activo?: boolean;
}

export function listMotivosMovimiento(
  tenant?: string | null,
): Promise<MotivoMovimiento[]> {
  return apiFetch<MotivoMovimiento[]>(
    `/inventario/motivos-movimiento`,
    {},
    tenant,
  );
}

// `cantidad` SIEMPRE positiva; el sentido lo da `signo`. Las notas son obligatorias: un ajuste sin el
// por qué es un descuadre nuevo con otra cara.
export function ajustarExistencias(
  payload: {
    productoId: string;
    almacenId: string;
    cantidad: number;
    signo: "positivo" | "negativo";
    motivo: string;
    notas: string;
    loteId?: string;
    fechaEfectiva?: string;
  },
  tenant?: string | null,
): Promise<unknown> {
  return apiFetch(
    `/inventario/operaciones/ajustar`,
    { method: "POST", body: JSON.stringify(payload) },
    tenant,
  );
}

// ---- Reporte de viales ----------------------------------------------------
// La foto de un producto que se dosifica en viales: cerrados, el que está en uso con su nivel, los que
// ya pasaron, y de qué vial salió cada dosis. El BE ya calcula remanente y porcentaje: aquí no se
// recalcula nada. See docs/specs/pantalla-de-viales.md
export interface VialDelReporte {
  id: string;
  numero: number | null;
  estado: string;
  capacidadTotal: number;
  remanente: number;
  pacienteId?: string | null;
}

export interface VialActivoDelReporte extends VialDelReporte {
  capacidad: number;
  /** 0–100, ya acotado por el BE. */
  porcentaje: number;
}

export interface ConsumoDelReporte {
  fecha: string;
  cantidad: number;
  vialId: string;
  vialNumero: number | null;
  pacienteId: string | null;
  /** Nombre completo y récord: el BE los resuelve para que la tabla se pueda leer. */
  paciente: string | null;
  record: string | null;
  sesionId: string | null;
  usuarioId: string | null;
  // Factura que originó el consumo (BE arregló el join sesión↔factura: la descarga se etiqueta como
  // "aplicación", no "entrega"). null = carga vieja sin sesión detrás. El FE enlaza la dosis a su
  // factura. Handoff viales-enlazar-a-factura.
  facturaId?: string | null;
  facturaNumero?: string | null;
}

export interface ReporteViales {
  productoId: string;
  cerrados: number;
  activo: VialActivoDelReporte | null;
  historicos: VialDelReporte[];
  consumos: ConsumoDelReporte[];
}

export function getReporteViales(
  params: {
    productoId: string;
    almacenId?: string;
    desde?: string;
    hasta?: string;
    pacienteId?: string;
  },
  tenant?: string | null,
): Promise<ReporteViales> {
  const qs = new URLSearchParams({ productoId: params.productoId });
  if (params.almacenId) qs.set("almacenId", params.almacenId);
  if (params.desde) qs.set("desde", params.desde);
  if (params.hasta) qs.set("hasta", params.hasta);
  if (params.pacienteId) qs.set("pacienteId", params.pacienteId);
  return apiFetch<ReporteViales>(
    `/inventario/viales-abiertos/reporte?${qs.toString()}`,
    {},
    tenant,
  );
}
