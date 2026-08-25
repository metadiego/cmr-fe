import type { components } from "./schema";
import type { Paginated } from "./types";
import { apiFetch, apiFetchPaged, apiFetchEnvelope } from "./client";

// Facturación (BE PR #39+). Tenant-scoped: pasar centroId (X-Tenant-ID) en escrituras.
export type Factura = components["schemas"]["FacturaEntity"];
export type FacturaItem = components["schemas"]["FacturaItemEntity"];
export type Producto = components["schemas"]["ProductoEntity"];
export type FormaPago = components["schemas"]["FormaPagoEntity"];
// `meta` sale como Record<string,never> en OpenAPI (quirk) → lo tipamos usable: los
// valores de columnas por su clave. NÚMERO para multiplicador/informativo (áreas, días…) y STRING para
// los select de captura (p. ej. zona = rodilla|codo|cadera|hombro del Protocolo Articular).
export type AgregarItemPayload = Omit<components["schemas"]["AgregarItemDto"], "meta"> & {
  meta?: Record<string, number | string>;
};
export type RegistrarPagoPayload = components["schemas"]["RegistrarPagoDto"];
export type DescuentoGlobalPayload = components["schemas"]["DescuentoGlobalDto"];
export type CrearFacturaPayload = components["schemas"]["CreateFacturaDto"];
// `usuarioId` YA lo acepta el BE en PUT /facturas/:id/cabecera (verificado 18-ago; corrige el usuario
// responsable — quién creó el borrador / quién cobró la emitida). El schema generado aún no lo refleja
// (drift pendiente de gen:api). Handoff HANDOFF-usuario-de-la-factura-y-ventas-por-usuario.
export type EditarCabeceraPayload = components["schemas"]["EditarCabeceraDto"] & {
  usuarioId?: string | null;
};
export type DescuentosGrupoPayload = components["schemas"]["DescuentosGrupoDto"];
export type SetExentoPayload = components["schemas"]["SetExentoDto"];

// Bloque fiscal por sucursal, proyectado en la factura (getById) y en
// GET /centros/:id/datos-fiscales. Configurable/multi-tenant; campos null = sin dato.
export type FacturaEmpresa = {
  nombreLegal: string | null;
  nombreComercial: string | null;
  registroFiscal: string | null;
  registroFiscalLabel: string | null;
  telefono: string | null;
  direccion: string | null;
  sucursal: string | null;
  pieFactura: string | null; // pie de EMITIDA (factura)
  piePresupuesto: string | null; // pie de BORRADOR (presupuesto) — BE PR #157
  email: string | null; // correo del centro para el encabezado
  web: string | null;
  logoUrl: string | null;
};

export type FacturaPago = {
  id?: string;
  formaPagoId?: string | null;
  formaPagoNombre?: string | null; // ya resuelto por el BE
  monto: number;
  referencia?: string | null;
  tipo?: "pago" | "reembolso" | string; // pago = abono de la factura; reembolso = de una devolución
  devolucionId?: string | null; // liga el reembolso a su devolución (solo tipo=reembolso)
  fecha?: string | null;
};

// La factura con sus líneas + proyección enriquecida de GET /facturas/:id (BE):
// paciente, medico, empresa (bloque fiscal), pagos[], emisor, emitidaEn, numeroDisplay.
// creadoPor/emitidoPor (BE PR #82): usuario que CREÓ el borrador y quien lo EMITIÓ/cobró (del
// RequestContext, no falsificable). En la entidad base son IDs string → los sobreescribimos como
// objeto {id,nombre} que trae la proyección de getById. `emisor`/`emisorId` quedan deprecados.
export type FacturaConItems = Omit<Factura, "creadoPor" | "emitidoPor"> & {
  items?: FacturaItem[];
  paciente?: {
    nombres?: string;
    apellidos?: string | null;
    record?: string | null;
    docId?: string | null;
  } | null;
  medico?: { id?: string; nombre?: string } | null;
  empresa?: FacturaEmpresa | null;
  pagos?: FacturaPago[];
  // `perfilId` = id de /profiles (para preseleccionar el select de usuario); `esLlave` = la emitió una
  // integración, no una persona (no ofrecer corregirlo como empleado). Handoff usuario-de-la-factura.
  emisor?: { id?: string; perfilId?: string | null; nombre?: string | null; esLlave?: boolean } | null;
  creadoPor?: { id?: string; perfilId?: string | null; nombre?: string | null; esLlave?: boolean } | null;
  emitidoPor?: { id?: string; perfilId?: string | null; nombre?: string | null; esLlave?: boolean } | null;
  emitidaEn?: string | null;
  numeroDisplay?: string | null;
  // Snapshot congelado de componentes de kit (solo facturas EMITIDAS), agrupado por facturaItemId.
  // Alimenta la impresión DETALLADA del recibo (kit-opcionales-y-display, BE PR #84).
  componentes?: FacturaComponente[] | null;
};

// Componente de kit congelado en la factura (para el recibo detallado).
export type FacturaComponente = {
  facturaItemId: string;
  nombre?: string | null;
  cantidad?: number | null;
  precioUnitario?: number | null;
};

// GET /facturas — listado paginado (findAll), filtrado server-side. Devuelve
// FacturaEntity cruda por fila (sin proyección de paciente); el detalle en
// /facturas/:id. `q` = nº de factura o record del paciente (verificado en prod).
export interface ListFacturasParams {
  page?: number;
  limit?: number;
  q?: string;
  estado?: string;
  desde?: string; // YYYY-MM-DD
  hasta?: string; // YYYY-MM-DD
  pacienteId?: string;
  contexto?: "general" | "consulta"; // general excluye consultas médicas; omitido = todas (valor inválido → 400)
}
export function listFacturas(
  params: ListFacturasParams = {},
  centroId?: string,
): Promise<Paginated<Factura>> {
  const { page = 1, limit = 20, q, estado, desde, hasta, pacienteId, contexto } = params;
  const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (q?.trim()) sp.set("q", q.trim());
  if (estado) sp.set("estado", estado);
  if (desde) sp.set("desde", desde);
  if (hasta) sp.set("hasta", hasta);
  if (pacienteId) sp.set("pacienteId", pacienteId);
  if (contexto) sp.set("contexto", contexto);
  return apiFetchPaged<Factura>(`/facturas?${sp.toString()}`, {}, centroId);
}

// Lista metadata-driven de facturación (GET /facturas/tablero): columnas RESUELTAS por el BE
// (fac_numero/fac_fecha/fac_paciente/fac_medico/fac_estado/fac_total/fac_medio/fac_acciones) + filas
// con esos valores YA resueltos (nombre de paciente, etc.) — a diferencia de GET /facturas (entidad cruda).
// Es la fuente correcta para la LISTA de facturas. contexto=general excluye consultas.
export interface FacturaTableroColumna {
  clave: string;
  labelKey: string;
  rol?: string | null;
  // Columnas editables inline (fac_medico/fac_usuario): el BE las declara select con writeBinding
  // (factura.medicoId / factura.usuarioId) y optionsSource; la fila trae `<clave>__valor` = el id crudo
  // (perfilId/medicoId). Se escribe por PUT /facturas/:id/cabecera. Handoff usuario-de-la-factura.
  tipo?: string;
  editable?: boolean;
  render?: { writeBinding?: string; optionsSource?: string; [k: string]: unknown } | null;
}
export type FacturaTableroFila = { id: string } & Record<string, unknown>;
export interface FacturaTablero {
  columnas: FacturaTableroColumna[];
  filas: FacturaTableroFila[];
}
export function getFacturasTablero(
  params: ListFacturasParams = {},
  centroId?: string,
): Promise<FacturaTablero> {
  const { page = 1, limit = 20, q, estado, desde, hasta, contexto } = params;
  const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (q?.trim()) sp.set("q", q.trim());
  if (estado) sp.set("estado", estado);
  if (desde) sp.set("desde", desde);
  if (hasta) sp.set("hasta", hasta);
  if (contexto) sp.set("contexto", contexto);
  return apiFetch<FacturaTablero>(`/facturas/tablero?${sp.toString()}`, {}, centroId);
}

// Resumen del RANGO filtrado (total del servidor, no de la página): importe/exentas/cobradas del
// `meta.resumen` de GET /facturas + el conteo total del `meta.pagination`. Mismos filtros que la lista.
// La lista pinta filas resueltas vía /facturas/tablero (sin resumen); este es el único que trae el
// total del rango — no sumar la página (número falso si hay paginación). Handoff facturación-totales.
export interface FacturasResumen {
  importe: number;
  exentas: number;
  cobradas: number;
  total: number; // nº de facturas del rango (meta.pagination.total)
}
export async function getFacturasResumen(
  params: ListFacturasParams = {},
  centroId?: string,
): Promise<FacturasResumen> {
  const { q, estado, desde, hasta, contexto } = params;
  // limit=1: solo interesa el meta (resumen + total); no traer filas de más.
  const sp = new URLSearchParams({ page: "1", limit: "1" });
  if (q?.trim()) sp.set("q", q.trim());
  if (estado) sp.set("estado", estado);
  if (desde) sp.set("desde", desde);
  if (hasta) sp.set("hasta", hasta);
  if (contexto) sp.set("contexto", contexto);
  const env = await apiFetchEnvelope<unknown>(`/facturas?${sp.toString()}`, {}, centroId);
  const r = env.meta.resumen;
  return {
    importe: Number(r?.importe ?? 0),
    exentas: Number(r?.exentas ?? 0),
    cobradas: Number(r?.cobradas ?? 0),
    total: Number(env.meta.pagination?.total ?? 0),
  };
}

// Crear/obtener la factura BORRADOR de una cita (idempotente: si existe activa,
// devuelve la misma). Trae la línea de consulta del producto del tipo_cita.
export function facturarCita(citaId: string, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/facturas/cita/${citaId}`, { method: "POST" }, centroId);
}

// POS GENERAL: crear un borrador desde un paciente (sin cita). El catálogo será el general
// (sin `contexto`). El borrador no toca stock hasta emitir.
export function crearFactura(payload: CrearFacturaPayload, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/facturas`, { method: "POST", body: JSON.stringify(payload) }, centroId);
}

// Búsqueda de paciente para el POS (nombre/record/doc). Devuelve entidades de paciente.
export type PacienteBusqueda = components["schemas"]["PacienteEntity"];
export function buscarPaciente(q: string, centroId?: string): Promise<PacienteBusqueda[]> {
  return apiFetch<PacienteBusqueda[]>(
    `/facturas/buscar-paciente?q=${encodeURIComponent(q)}`,
    {},
    centroId,
  );
}

// Descuentos nivel 2 (por grupo/categoría) y exento de cabecera (nivel factura).
export function setDescuentosGrupo(facturaId: string, payload: DescuentosGrupoPayload, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/facturas/${facturaId}/descuentos-grupo`, { method: "PUT", body: JSON.stringify(payload) }, centroId);
}
export function setExento(facturaId: string, payload: SetExentoPayload, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/facturas/${facturaId}/exento`, { method: "PUT", body: JSON.stringify(payload) }, centroId);
}

// Corregir el paciente de un BORRADOR (sin borrar). Solo estado borrador.
export function cambiarPacienteFactura(facturaId: string, pacienteId: string, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/facturas/${facturaId}/paciente`, { method: "PUT", body: JSON.stringify({ pacienteId }) }, centroId);
}
// Editar la CABECERA completa de un BORRADOR sin descartar (BE PR #80): paciente/médico/medio/tercero.
// Campo ausente = no tocar; `null` = limpiar (médico/medio/facturarA*). Solo estado borrador (400 si no).
// Devuelve la factura proyectada (misma shape que getById).
export function editarCabeceraFactura(facturaId: string, payload: EditarCabeceraPayload, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/facturas/${facturaId}/cabecera`, { method: "PUT", body: JSON.stringify(payload) }, centroId);
}
// Descartar un BORRADOR (borra factura + líneas; 204). 400 si ya emitida.
export function descartarFactura(facturaId: string, centroId?: string): Promise<void> {
  return apiFetch<void>(`/facturas/${facturaId}`, { method: "DELETE" }, centroId);
}

// Regenerar disponibilidad de una factura EMITIDA (reparar tras corregir la config del kit): recalcula las
// terapias que el kit debe dar y AÑADE solo las que falten (no toca lo ya existente ni entregado; idempotente;
// 400 FACTURA_NO_EMITIDA si no está emitida). `sugerencias` = componentes entregados SIN servicio anclado
// (pista, no fallo). Peligroso → RBAC factura.reparar. Contrato: HANDOFF-regenerar-disponibilidad (BE #246/#247).
export type RegenerarDisponibilidad = {
  creados: number;
  detalle: { sku?: string | null; sesiones?: number | null }[];
  sugerencias: { productoId?: string | null; sku?: string | null; motivo?: string | null }[];
};
export function regenerarDisponibilidad(facturaId: string, centroId?: string): Promise<RegenerarDisponibilidad> {
  return apiFetch<RegenerarDisponibilidad>(`/facturas/${facturaId}/regenerar-disponibilidad`, { method: "POST" }, centroId);
}

// Proyección del catálogo facturable: producto + precio resuelto por centro + gravado (default IVU).
// `unidadesPorEnvase` (de NTPRODUCTOS.CapsulasXUni) y `diasTratamiento` (por producto) vienen ya en
// ProductoEntity (BE en prod) y alimentan el autocálculo Dosis→Cantidad del POS. null → cantidad manual.
export type CatalogoProducto = Producto & {
  precio?: number | null;
  presentacionId?: string | null;
};

export function getFactura(id: string, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/facturas/${id}`, {}, centroId);
}

// «Lo que suma el paciente hoy» — para cobrar sin calculadora cuando arma varias facturas por separado
// (láser/suero/productos). El BE devuelve el resumen YA SUMADO (por `neto`, que descuenta devoluciones);
// NO sumar los `total` a mano (mezcla departamentos y no baja lo devuelto). Solo facturación general (las
// consultas son otro departamento). Sin desde/hasta = hoy. Handoff resumen-de-facturas-del-paciente.
export interface ResumenFacturaFila {
  id: string;
  referencia: string; // nº emitida, nº presupuesto si borrador, o «borrador» — un solo campo, no decidir en el FE
  estado: string;
  conceptoLabelKeys: string[]; // claves i18n: grupo.laser, grupo.productos, factura.sin_lineas, factura.sin_grupo
  total: number;
  devuelto: number;
  neto: number; // LO QUE SUMA (total − devuelto)
  cobrado: number;
  pendiente: number;
  cuenta: boolean; // false = se ve pero NO suma (anuladas)
}
export interface ResumenPaciente {
  pacienteId: string;
  desde?: string;
  hasta?: string;
  facturas: ResumenFacturaFila[];
  totalGeneral: number;
  totalDevuelto: number;
  totalCobrado: number;
  totalPendiente: number;
  anuladasExcluidas: number;
}
export function getResumenPaciente(
  pacienteId: string,
  opts?: { desde?: string; hasta?: string },
  centroId?: string,
): Promise<ResumenPaciente> {
  const sp = new URLSearchParams({ pacienteId });
  if (opts?.desde) sp.set("desde", opts.desde);
  if (opts?.hasta) sp.set("hasta", opts.hasta);
  return apiFetch<ResumenPaciente>(`/facturas/resumen-paciente?${sp.toString()}`, {}, centroId);
}

// Catálogo facturable (productos/servicios) para agregar líneas.
// `contexto='consulta'` → el BE restringe a los productos de los tipos de cita activos (Consulta,
// Seguimiento): una factura de consulta médica no ofrece el catálogo físico completo.
export function getCatalogoFacturacion(
  centroId?: string,
  contexto?: string,
): Promise<Producto[]> {
  const qs = contexto ? `?contexto=${encodeURIComponent(contexto)}` : "";
  return apiFetch<Producto[]>(`/facturas/catalogo${qs}`, {}, centroId);
}

export function agregarItem(facturaId: string, payload: AgregarItemPayload, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/facturas/${facturaId}/items`, { method: "POST", body: JSON.stringify(payload) }, centroId);
}

export function actualizarItem(facturaId: string, itemId: string, payload: Partial<AgregarItemPayload>, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/facturas/${facturaId}/items/${itemId}`, { method: "PUT", body: JSON.stringify(payload) }, centroId);
}

export function eliminarItem(facturaId: string, itemId: string, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/facturas/${facturaId}/items/${itemId}`, { method: "DELETE" }, centroId);
}

// Kits con componentes OPCIONALES (BE PR #84): el cajero incluye/excluye por línea y el BE re-precifica.
// La respuesta del GET no está tipada en swagger → shape del handoff (kit-opcionales-y-display).
export interface ItemOpcional {
  componenteId: string;
  nombre: string;
  cantidad: number;
  precioIncremental: number;
  incluido: boolean;
}
export function getItemOpcionales(facturaId: string, itemId: string, centroId?: string): Promise<ItemOpcional[]> {
  return apiFetch<ItemOpcional[]>(`/facturas/${facturaId}/items/${itemId}/opcionales`, {}, centroId);
}
// incluidos = ids de componentes que quedan marcados. El BE re-precifica la línea (base + Σ incluidos)
// y recomputa los totales; devuelve la factura proyectada (total en vivo).
export function setItemOpcionales(facturaId: string, itemId: string, incluidos: string[], centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(
    `/facturas/${facturaId}/items/${itemId}/opcionales`,
    { method: "PUT", body: JSON.stringify({ incluidos }) },
    centroId,
  );
}

// Personalizar un KIT en la factura (BE PR #293): cambiar cantidad / quitar / AGREGAR componentes de un
// producto compuesto SOLO en ESTA línea, sin tocar la receta general. Se manda la LISTA FINAL completa
// ({productoId,cantidad}[]): lo ausente se interpreta como quitado. Esto es lo que entra al frontdesk
// (menos PEMF = menos disponibilidad). Agregar exige el permiso fino `factura.kit_agregar` (el BE lo
// valida; el FE no muestra la puerta sin permiso). Devuelve la línea con su `personalizacion` guardada.
export function personalizarKit(
  facturaId: string,
  itemId: string,
  componentes: { productoId: string; cantidad: number }[],
  centroId?: string,
): Promise<FacturaItem> {
  return apiFetch<FacturaItem>(
    `/facturas/${facturaId}/items/${itemId}/kit`,
    { method: "PUT", body: JSON.stringify({ componentes }) },
    centroId,
  );
}

export function setDescuentoGlobal(facturaId: string, payload: DescuentoGlobalPayload, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/facturas/${facturaId}/descuento-global`, { method: "PUT", body: JSON.stringify(payload) }, centroId);
}

// Envío/flete: monto de cabecera que el BE SUMA al total DESPUÉS del impuesto (como legacy monto_flete).
// Solo en borrador; permiso factura.update. Devuelve la factura con totales recomputados (el BE manda; el
// FE no recalcula). 0 = sin envío. Gravado o no lo decide config por centro `facturacion.envioGravado`.
export type SetEnvioPayload = components["schemas"]["SetEnvioDto"];
export function setEnvio(facturaId: string, monto: number, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/facturas/${facturaId}/envio`, { method: "PUT", body: JSON.stringify({ monto }) }, centroId);
}

// Emitir (cierra el borrador). Sin body.
export function emitirFactura(facturaId: string, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/facturas/${facturaId}/emitir`, { method: "POST" }, centroId);
}

// Imprimir = EMITIR si procede (BE, desplegado). Un borrador SALDADO se emite (número/fecha definitivos,
// entra al cuadre) y `emitida:true`; un borrador SIN cobrar NO se emite pero NO bloquea la impresión
// (`emitida:false`, `motivo:"factura.no_emitida_pendiente_pago"`, `pendiente` con lo que falta); ya
// emitida/anulada/devuelta no hace nada (idempotente). El FE llama esto ANTES de window.print(), refresca
// con la factura devuelta y, si emitida=false con motivo, lo muestra como AVISO (no error): imprimir es
// válido igual. Handoff HANDOFF-vitales-en-atencion-e-imprimir-emite.
export interface ImprimirFacturaResult {
  factura: FacturaConItems;
  emitida: boolean;
  motivo?: string | null;
  pendiente?: { saldo?: number; montoAbonado?: number; total?: number } | null;
  // Qué documento es el papel: "presupuesto" (borrador con saldo → NO emite, NO consume correlativo de
  // factura; trae `numeroPresupuesto`) o "factura" (saldado/cortesía → emitida). El nº de presupuesto se
  // asigna la 1ª vez y se reusa al reimprimir. Handoff imprimir-presupuesto-cuando-no-esta-cobrada.
  documento?: "presupuesto" | "factura" | string;
  numeroPresupuesto?: string | null;
}
export function imprimirFactura(facturaId: string, centroId?: string): Promise<ImprimirFacturaResult> {
  return apiFetch<ImprimirFacturaResult>(`/facturas/${facturaId}/imprimir`, { method: "POST" }, centroId);
}

// Anular una factura emitida (RBAC factura.anular; motivo obligatorio). El BE sella
// actor/fecha. La ventana "mismo día" es configurable en el BE.
export function anularFactura(facturaId: string, motivo: string, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(
    `/facturas/${facturaId}/anular`,
    { method: "POST", body: JSON.stringify({ motivo }) },
    centroId,
  );
}

export function getFormasPago(centroId?: string): Promise<FormaPago[]> {
  return apiFetch<FormaPago[]>(`/facturacion/formas-pago`, {}, centroId);
}

// Enviar la factura por email (BE PR #106). Sin `email` usa el del paciente (400 si no hay ninguno).
// RBAC notificaciones.create. El DTO no está tipado en swagger → shape del handoff.
export function emailFactura(facturaId: string, payload: { email?: string; cuerpo?: string }, centroId?: string): Promise<unknown> {
  return apiFetch(`/facturas/${facturaId}/email`, { method: "POST", body: JSON.stringify(payload) }, centroId);
}

// ---- Devoluciones (BE PR #102) ---------------------------------------------
// Una factura EMITIDA puede tener varias devoluciones (append-only, no bloqueante).
// Anular (mismo día, error) ≠ Devolver (día siguiente/24h). El actor lo sella el BE (RequestContext).
// numeroDisplay = correlativo PROPIO de la devolución (p. ej. "D-000001"), secuencia independiente de
// facturas (BE PR #113). Lo proyecta el BE en la lista/detalle aunque no esté en la entidad base.
export type Devolucion = components["schemas"]["DevolucionEntity"] & { numeroDisplay?: string | null };
export type DevolverPayload = components["schemas"]["DevolverDto"];

// Recibo PROPIO de una devolución (documento "Devolución #D-000001", no la factura). El BE no tipó la
// respuesta en Swagger (Record<string,never>) → tipamos aquí la forma verificada en vivo. Los ítems traen
// `facturaItemId` (para resolver el nombre desde la factura de origen) pero no el nombre del producto.
export type ReciboDevolucionItem = {
  facturaItemId: string;
  productoId: string;
  cantidad: number;
  sesiones: number;
  monto: number; // base reembolsada (pre-impuesto)
  montoImpuesto: number;
};
export type ReciboDevolucion = {
  tipoDocumento: "devolucion";
  numeroDisplay: string;
  facturaNumero: string | null; // referencia de origen
  fecha: string;
  estado: string; // activa | anulada
  montoDevuelto: number; // total con impuesto
  impuestoDevuelto: number;
  formaReembolso: string | null;
  motivo: string | null;
  items: ReciboDevolucionItem[];
  paciente: { nombres?: string; apellidos?: string | null; record?: string | null; docId?: string | null } | null;
  empresa: FacturaEmpresa | null;
  emisor: { id?: string; nombre?: string | null } | null;
};
export function getReciboDevolucion(
  facturaId: string,
  devolucionId: string,
  centroId?: string,
): Promise<ReciboDevolucion> {
  return apiFetch<ReciboDevolucion>(`/facturas/${facturaId}/devoluciones/${devolucionId}/recibo`, {}, centroId);
}

// Registrar una devolución (total o parcial) de una factura. items = líneas a devolver.
export function devolverFactura(facturaId: string, payload: DevolverPayload, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/facturas/${facturaId}/devolver`, { method: "POST", body: JSON.stringify(payload) }, centroId);
}
// Devoluciones de UNA factura.
export function listDevolucionesDeFactura(facturaId: string, centroId?: string): Promise<Devolucion[]> {
  return apiFetch<Devolucion[]>(`/facturas/${facturaId}/devoluciones`, {}, centroId);
}
// Anular una devolución (RBAC). Motivo obligatorio; actor sellado por el BE.
export function anularDevolucion(facturaId: string, devolucionId: string, motivo: string, centroId?: string): Promise<unknown> {
  return apiFetch(`/facturas/${facturaId}/devoluciones/${devolucionId}/anular`, { method: "POST", body: JSON.stringify({ motivo }) }, centroId);
}

// Guía de timing (no bloqueante): mismo día → sugiere Anular; después → Devolver. Ambos siempre disponibles.
export interface PoliticaDevolucion {
  accionSugerida?: "anular" | "devolver";
  mismoDia?: boolean;
  dentroVentanaAnulacion?: boolean;
  config?: Record<string, unknown>;
}
export function getPoliticaDevolucion(facturaId: string, centroId?: string): Promise<PoliticaDevolucion> {
  return apiFetch<PoliticaDevolucion>(`/facturas/${facturaId}/politica-devolucion`, {}, centroId);
}

// Precio base de un producto (para la política precio_base: valorar lo consumido al precio base).
export function getPrecioBase(productoId: string, centroId?: string): Promise<{ productoId: string; precioBase: number }> {
  return apiFetch<{ productoId: string; precioBase: number }>(
    `/facturas/precio-base?productoId=${encodeURIComponent(productoId)}`,
    {},
    centroId,
  );
}

// Lista GLOBAL de devoluciones (por centro), paginada + filtros. Cada fila = DevolucionEntity
// (facturaNumero incluido). Multi-tenant por X-Tenant-ID.
export interface ListDevolucionesParams {
  page?: number;
  limit?: number;
  q?: string; // nº de factura
  estado?: string; // activa|anulada
  desde?: string;
  hasta?: string;
  contexto?: "general" | "consulta"; // filtra por tipo de factura de la devolución
}
export function listDevoluciones(params: ListDevolucionesParams = {}, centroId?: string): Promise<Paginated<Devolucion>> {
  const { page = 1, limit = 20, q, estado, desde, hasta, contexto } = params;
  const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (q?.trim()) sp.set("q", q.trim());
  if (estado) sp.set("estado", estado);
  if (desde) sp.set("desde", desde);
  if (hasta) sp.set("hasta", hasta);
  if (contexto) sp.set("contexto", contexto);
  return apiFetchPaged<Devolucion>(`/facturacion/devoluciones?${sp.toString()}`, {}, centroId);
}

export function registrarPago(facturaId: string, payload: RegistrarPagoPayload, centroId?: string): Promise<unknown> {
  return apiFetch(`/facturas/${facturaId}/pagos`, { method: "POST", body: JSON.stringify(payload) }, centroId);
}

// Corrección de un pago/reembolso (append-only, auditable): anula el viejo y crea el corregido
// enlazado; recomputa la factura. Sirve tanto para pagos (tipo=pago) como para el reembolso de una
// devolución (tipo=reembolso, conserva el tipo). RBAC `factura.pago.anular`. Ver #112.
export type RepararPagoPayload = components["schemas"]["RepararPagoDto"];
export function repararPago(
  facturaId: string,
  pagoId: string,
  payload: RepararPagoPayload,
  centroId?: string,
): Promise<unknown> {
  return apiFetch(
    `/facturas/${facturaId}/pagos/${pagoId}`,
    { method: "PUT", body: JSON.stringify(payload) },
    centroId,
  );
}

// Anula un pago mal capturado (sin reemplazo), soft/auditable. No es una devolución.
export function anularPago(
  facturaId: string,
  pagoId: string,
  motivo: string,
  centroId?: string,
): Promise<unknown> {
  return apiFetch(
    `/facturas/${facturaId}/pagos/${pagoId}`,
    { method: "DELETE", body: JSON.stringify({ motivo }) },
    centroId,
  );
}

// Series de numeración por centro (BE): `default` (facturas), `devolucion`, `presupuesto`, cada una con
// `prefijo`, `padding` y `proximo` (solo lectura: moverlo abre huecos o repite un correlativo). Editar el
// prefijo/padding: admin, super_admin, gerente; exige centro elegido. Handoff imprimir-presupuesto (§3).
export interface SerieNumeracion {
  id: string;
  serie: string;
  prefijo?: string | null;
  padding?: number | null;
  proximo?: number | null;
}
export function getSeriesNumeracion(centroId?: string): Promise<SerieNumeracion[]> {
  return apiFetch<SerieNumeracion[]>(`/facturas/series`, {}, centroId);
}
export function actualizarSerieNumeracion(
  serie: string,
  payload: { prefijo?: string | null; padding?: number },
  centroId?: string,
): Promise<SerieNumeracion> {
  return apiFetch<SerieNumeracion>(`/facturas/series/${encodeURIComponent(serie)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, centroId);
}
