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
// `userId` YA lo acepta el BE en PUT /invoices/:id/header (verificado 18-ago; corrige el usuario
// responsable — quién creó el borrador / quién cobró la emitida). El schema generado aún no lo refleja
// (drift pendiente de gen:api). Handoff HANDOFF-usuario-de-la-factura-y-ventas-por-usuario.
export type EditarCabeceraPayload = components["schemas"]["EditarCabeceraDto"] & {
  userId?: string | null;
};
export type DescuentosGrupoPayload = components["schemas"]["DescuentosGrupoDto"];
export type SetExentoPayload = components["schemas"]["SetExentoDto"];

// Bloque fiscal por sucursal, proyectado en la factura (getById) y en
// GET /centers/:id/tax-details. Configurable/multi-tenant; campos null = sin dato.
export type FacturaEmpresa = {
  legalName: string | null;
  tradeName: string | null;
  taxRegistration: string | null;
  taxRegistrationLabel: string | null;
  phone: string | null;
  address: string | null;
  sucursal: string | null; // BE aún NO traduce esta clave (no está en el mapa api-ingles)
  invoiceFooter: string | null; // pie de EMITIDA (factura)
  quoteFooter: string | null; // pie de BORRADOR (presupuesto) — BE PR #157
  email: string | null; // correo del centro para el encabezado
  website: string | null;
  logoUrl: string | null;
};

export type FacturaPago = {
  id?: string;
  paymentMethodId?: string | null;
  formaPagoNombre?: string | null; // ya resuelto por el BE. OJO: clave NO está en el mapa api-ingles (sigue en español)
  amount: number;
  reference?: string | null;
  type?: "pago" | "reembolso" | string; // pago = abono de la factura; reembolso = de una devolución
  refundId?: string | null; // liga el reembolso a su devolución (solo type=reembolso)
  date?: string | null;
};

// La factura con sus líneas + proyección enriquecida de GET /invoices/:id (BE):
// patient, doctor, empresa (bloque fiscal), payments[], emisor, emitidaEn, displayNumber.
// createdBy/issuedBy (BE PR #82): usuario que CREÓ el borrador y quien lo EMITIÓ/cobró (del
// RequestContext, no falsificable). En la entidad base son IDs string → los sobreescribimos como
// objeto {id,name} que trae la proyección de getById. `emisor`/`issuerId` quedan deprecados.
// Nota: las claves `empresa`, `emisor`, `emitidaEn`, `esLlave` y `componentes` NO están en el mapa
// api-ingles → el BE las deja en español (el CONTENIDO de los objetos sí se traduce por recursión).
export type FacturaConItems = Omit<Factura, "createdBy" | "issuedBy"> & {
  items?: FacturaItem[];
  patient?: {
    firstName?: string;
    lastName?: string | null;
    displayName?: string | null; // compuesto por el BE (apellido primero); usar para MOSTRAR
    medicalRecordNumber?: string | null;
    documentId?: string | null;
  } | null;
  doctor?: { id?: string; name?: string } | null;
  empresa?: FacturaEmpresa | null;
  payments?: FacturaPago[];
  // `profileId` = id de /profiles (para preseleccionar el select de usuario); `esLlave` = la emitió una
  // integración, no una persona (no ofrecer corregirlo como empleado). Handoff usuario-de-la-factura.
  emisor?: { id?: string; profileId?: string | null; name?: string | null; esLlave?: boolean } | null;
  createdBy?: { id?: string; profileId?: string | null; name?: string | null; esLlave?: boolean } | null;
  issuedBy?: { id?: string; profileId?: string | null; name?: string | null; esLlave?: boolean } | null;
  emitidaEn?: string | null;
  displayNumber?: string | null;
  // Snapshot congelado de componentes de kit (solo facturas EMITIDAS), agrupado por invoiceItemId.
  // Alimenta la impresión DETALLADA del recibo (kit-opcionales-y-display, BE PR #84).
  componentes?: FacturaComponente[] | null;
};

// Componente de kit congelado en la factura (para el recibo detallado).
export type FacturaComponente = {
  invoiceItemId: string;
  name?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
};

// GET /invoices — listado paginado (findAll), filtrado server-side. Devuelve
// FacturaEntity cruda por fila (sin proyección de paciente); el detalle en
// /invoices/:id. `q` = nº de factura o record del paciente (verificado en prod).
export interface ListFacturasParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  patientId?: string;
  context?: "general" | "consulta"; // general excluye consultas médicas; omitido = todas (valor inválido → 400)
}
export function listFacturas(
  params: ListFacturasParams = {},
  centroId?: string,
): Promise<Paginated<Factura>> {
  const { page = 1, limit = 20, q, status, from, to, patientId, context } = params;
  const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (q?.trim()) sp.set("q", q.trim());
  if (status) sp.set("status", status);
  if (from) sp.set("from", from);
  if (to) sp.set("to", to);
  if (patientId) sp.set("patientId", patientId);
  if (context) sp.set("context", context);
  return apiFetchPaged<Factura>(`/invoices?${sp.toString()}`, {}, centroId);
}

// Lista metadata-driven de facturación (GET /invoices/board): columnas RESUELTAS por el BE
// (fac_numero/fac_fecha/fac_paciente/fac_medico/fac_estado/fac_total/fac_medio/fac_acciones) + filas
// con esos valores YA resueltos (nombre de paciente, etc.) — a diferencia de GET /invoices (entidad cruda).
// Es la fuente correcta para la LISTA de facturas. context=general excluye consultas.
// OJO: `columns`/`rows` son bolsas OPACAS (el BE traduce la CLAVE columnas→columns/filas→rows pero NO su
// CONTENIDO): las claves internas de la columna (clave/rol/tipo) siguen en español a propósito (motor de tableros).
export interface FacturaTableroColumna {
  clave: string;
  labelKey: string;
  rol?: string | null;
  // Columnas editables inline (fac_medico/fac_usuario): el BE las declara select con writeBinding
  // (factura.medicoId / factura.usuarioId) y optionsSource; la fila trae `<clave>__valor` = el id crudo
  // (perfilId/medicoId). Se escribe por PUT /invoices/:id/header. Handoff usuario-de-la-factura.
  tipo?: string;
  editable?: boolean;
  render?: { writeBinding?: string; optionsSource?: string; [k: string]: unknown } | null;
}
export type FacturaTableroFila = { id: string } & Record<string, unknown>;
export interface FacturaTablero {
  columns: FacturaTableroColumna[];
  rows: FacturaTableroFila[];
}
export function getFacturasTablero(
  params: ListFacturasParams = {},
  centroId?: string,
): Promise<FacturaTablero> {
  const { page = 1, limit = 20, q, status, from, to, context } = params;
  const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (q?.trim()) sp.set("q", q.trim());
  if (status) sp.set("status", status);
  if (from) sp.set("from", from);
  if (to) sp.set("to", to);
  if (context) sp.set("context", context);
  return apiFetch<FacturaTablero>(`/invoices/board?${sp.toString()}`, {}, centroId);
}

// Resumen del RANGO filtrado (total del servidor, no de la página): importe/exentas/cobradas del
// `meta.resumen` de GET /invoices + el conteo total del `meta.pagination`. Mismos filtros que la lista.
// La lista pinta filas resueltas vía /invoices/board (sin resumen); este es el único que trae el
// total del rango — no sumar la página (número falso si hay paginación). Handoff facturación-totales.
// `meta` es una bolsa OPACA: el BE NO traduce su contenido → `resumen.importe/exentas/cobradas` van en español.
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
  const { q, status, from, to, context } = params;
  // limit=1: solo interesa el meta (resumen + total); no traer filas de más.
  const sp = new URLSearchParams({ page: "1", limit: "1" });
  if (q?.trim()) sp.set("q", q.trim());
  if (status) sp.set("status", status);
  if (from) sp.set("from", from);
  if (to) sp.set("to", to);
  if (context) sp.set("context", context);
  const env = await apiFetchEnvelope<unknown>(`/invoices?${sp.toString()}`, {}, centroId);
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
  return apiFetch<FacturaConItems>(`/invoices/appointment/${citaId}`, { method: "POST" }, centroId);
}

// POS GENERAL: crear un borrador desde un paciente (sin cita). El catálogo será el general
// (sin `context`). El borrador no toca stock hasta emitir.
export function crearFactura(payload: CrearFacturaPayload, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/invoices`, { method: "POST", body: JSON.stringify(payload) }, centroId);
}

// Búsqueda de paciente para el POS (nombre/record/doc). Devuelve entidades de paciente.
export type PacienteBusqueda = components["schemas"]["PacienteEntity"] & { displayName?: string | null };
export function buscarPaciente(q: string, centroId?: string): Promise<PacienteBusqueda[]> {
  return apiFetch<PacienteBusqueda[]>(
    `/invoices/search-patient?q=${encodeURIComponent(q)}`,
    {},
    centroId,
  );
}

// Descuentos nivel 2 (por grupo/categoría) y exento de cabecera (nivel factura).
export function setDescuentosGrupo(facturaId: string, payload: DescuentosGrupoPayload, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/invoices/${facturaId}/group-discounts`, { method: "PUT", body: JSON.stringify(payload) }, centroId);
}
export function setExento(facturaId: string, payload: SetExentoPayload, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/invoices/${facturaId}/exempt`, { method: "PUT", body: JSON.stringify(payload) }, centroId);
}

// Corregir el paciente de un BORRADOR (sin borrar). Solo estado borrador.
export function cambiarPacienteFactura(facturaId: string, pacienteId: string, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/invoices/${facturaId}/patient`, { method: "PUT", body: JSON.stringify({ patientId: pacienteId }) }, centroId);
}
// Editar la CABECERA completa de un BORRADOR sin descartar (BE PR #80): paciente/médico/medio/tercero.
// Campo ausente = no tocar; `null` = limpiar (médico/medio/facturarA*). Solo estado borrador (400 si no).
// Devuelve la factura proyectada (misma shape que getById).
export function editarCabeceraFactura(facturaId: string, payload: EditarCabeceraPayload, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/invoices/${facturaId}/header`, { method: "PUT", body: JSON.stringify(payload) }, centroId);
}
// Descartar un BORRADOR (borra factura + líneas; 204). 400 si ya emitida.
export function descartarFactura(facturaId: string, centroId?: string): Promise<void> {
  return apiFetch<void>(`/invoices/${facturaId}`, { method: "DELETE" }, centroId);
}

// Regenerar disponibilidad de una factura EMITIDA (reparar tras corregir la config del kit): recalcula las
// terapias que el kit debe dar y AÑADE solo las que falten (no toca lo ya existente ni entregado; idempotente;
// 400 FACTURA_NO_EMITIDA si no está emitida). `sugerencias` = componentes entregados SIN servicio anclado
// (pista, no fallo). Peligroso → RBAC factura.reparar. Contrato: HANDOFF-regenerar-disponibilidad (BE #246/#247).
// `creados`/`detalle`/`sugerencias` NO están en el mapa api-ingles → el BE las deja en español (contenido sí traducido).
export type RegenerarDisponibilidad = {
  creados: number;
  detalle: { sku?: string | null; sessions?: number | null }[];
  sugerencias: { productId?: string | null; sku?: string | null; reason?: string | null }[];
};
export function regenerarDisponibilidad(facturaId: string, centroId?: string): Promise<RegenerarDisponibilidad> {
  return apiFetch<RegenerarDisponibilidad>(`/invoices/${facturaId}/regenerate-availability`, { method: "POST" }, centroId);
}

// Proyección del catálogo facturable: producto + precio resuelto por centro + gravado (default IVU).
// `unitsPerContainer` (de NTPRODUCTOS.CapsulasXUni) y `treatmentDays` (por producto) vienen ya en
// ProductoEntity (BE en prod) y alimentan el autocálculo Dosis→Cantidad del POS. null → cantidad manual.
export type CatalogoProducto = Producto & {
  price?: number | null;
  presentationId?: string | null;
};

export function getFactura(id: string, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/invoices/${id}`, {}, centroId);
}

// «Lo que suma el paciente hoy» — para cobrar sin calculadora cuando arma varias facturas por separado
// (láser/suero/productos). El BE devuelve el resumen YA SUMADO (por `neto`, que descuenta devoluciones);
// NO sumar los `total` a mano (mezcla departamentos y no baja lo devuelto). Solo facturación general (las
// consultas son otro departamento). Sin from/to = hoy. Handoff resumen-de-facturas-del-paciente.
// Varias claves de este resumen (referencia→reference, estado→status, facturas→invoices están en el mapa;
// conceptoLabelKeys/devuelto/neto/cobrado/pendiente/cuenta/total* NO → siguen en español).
export interface ResumenFacturaFila {
  id: string;
  reference: string; // nº emitida, nº presupuesto si borrador, o «borrador» — un solo campo, no decidir en el FE
  status: string;
  conceptoLabelKeys: string[]; // claves i18n: grupo.laser, grupo.productos, factura.sin_lineas, factura.sin_grupo
  total: number;
  devuelto: number;
  neto: number; // LO QUE SUMA (total − devuelto)
  cobrado: number;
  pendiente: number;
  cuenta: boolean; // false = se ve pero NO suma (anuladas)
}
export interface ResumenPaciente {
  patientId: string;
  from?: string;
  to?: string;
  invoices: ResumenFacturaFila[];
  totalGeneral: number;
  totalDevuelto: number;
  totalCobrado: number;
  totalPendiente: number;
  anuladasExcluidas: number;
}
export function getResumenPaciente(
  pacienteId: string,
  opts?: { from?: string; to?: string },
  centroId?: string,
): Promise<ResumenPaciente> {
  const sp = new URLSearchParams({ patientId: pacienteId });
  if (opts?.from) sp.set("from", opts.from);
  if (opts?.to) sp.set("to", opts.to);
  return apiFetch<ResumenPaciente>(`/invoices/patient-summary?${sp.toString()}`, {}, centroId);
}

// Catálogo facturable (productos/servicios) para agregar líneas.
// `context='consulta'` → el BE restringe a los productos de los tipos de cita activos (Consulta,
// Seguimiento): una factura de consulta médica no ofrece el catálogo físico completo.
export function getCatalogoFacturacion(
  centroId?: string,
  context?: string,
): Promise<Producto[]> {
  const qs = context ? `?context=${encodeURIComponent(context)}` : "";
  return apiFetch<Producto[]>(`/invoices/catalog${qs}`, {}, centroId);
}

export function agregarItem(facturaId: string, payload: AgregarItemPayload, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/invoices/${facturaId}/items`, { method: "POST", body: JSON.stringify(payload) }, centroId);
}

export function actualizarItem(facturaId: string, itemId: string, payload: Partial<AgregarItemPayload>, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/invoices/${facturaId}/items/${itemId}`, { method: "PUT", body: JSON.stringify(payload) }, centroId);
}

export function eliminarItem(facturaId: string, itemId: string, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/invoices/${facturaId}/items/${itemId}`, { method: "DELETE" }, centroId);
}

// Kits con componentes OPCIONALES (BE PR #84): el cajero incluye/excluye por línea y el BE re-precifica.
// La respuesta del GET no está tipada en swagger → shape del handoff (kit-opcionales-y-display).
// `incluido` NO está en el mapa api-ingles → el BE lo deja en español; el resto se traduce.
export interface ItemOpcional {
  componentId: string;
  name: string;
  quantity: number;
  incrementalPrice: number;
  incluido: boolean;
}
export function getItemOpcionales(facturaId: string, itemId: string, centroId?: string): Promise<ItemOpcional[]> {
  return apiFetch<ItemOpcional[]>(`/invoices/${facturaId}/items/${itemId}/optional-items`, {}, centroId);
}
// incluidos = ids de componentes que quedan marcados. El BE re-precifica la línea (base + Σ incluidos)
// y recomputa los totales; devuelve la factura proyectada (total en vivo). La clave `incluidos` NO está en
// el mapa api-ingles → se envía tal cual (el BE no la traduce y el DTO la espera en español).
export function setItemOpcionales(facturaId: string, itemId: string, incluidos: string[], centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(
    `/invoices/${facturaId}/items/${itemId}/optional-items`,
    { method: "PUT", body: JSON.stringify({ incluidos }) },
    centroId,
  );
}

// Personalizar un KIT en la factura (BE PR #293): cambiar cantidad / quitar / AGREGAR componentes de un
// producto compuesto SOLO en ESTA línea, sin tocar la receta general. Se manda la LISTA FINAL completa
// ({productId,quantity}[]): lo ausente se interpreta como quitado. Esto es lo que entra al frontdesk
// (menos PEMF = menos disponibilidad). Agregar exige el permiso fino `factura.kit_agregar` (el BE lo
// valida; el FE no muestra la puerta sin permiso). Devuelve la línea con su `personalizacion` guardada.
// La clave `componentes` NO está en el mapa api-ingles → se envía tal cual (el DTO la espera en español).
export function personalizarKit(
  facturaId: string,
  itemId: string,
  componentes: { productId: string; quantity: number }[],
  centroId?: string,
): Promise<FacturaItem> {
  return apiFetch<FacturaItem>(
    `/invoices/${facturaId}/items/${itemId}/kit`,
    { method: "PUT", body: JSON.stringify({ componentes }) },
    centroId,
  );
}

export function setDescuentoGlobal(facturaId: string, payload: DescuentoGlobalPayload, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/invoices/${facturaId}/global-discount`, { method: "PUT", body: JSON.stringify(payload) }, centroId);
}

// Envío/flete: monto de cabecera que el BE SUMA al total DESPUÉS del impuesto (como legacy monto_flete).
// Solo en borrador; permiso factura.update. Devuelve la factura con totales recomputados (el BE manda; el
// FE no recalcula). 0 = sin envío. Gravado o no lo decide config por centro `facturacion.envioGravado`.
export type SetEnvioPayload = components["schemas"]["SetEnvioDto"];
export function setEnvio(facturaId: string, monto: number, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/invoices/${facturaId}/shipping`, { method: "PUT", body: JSON.stringify({ amount: monto }) }, centroId);
}

// Emitir (cierra el borrador). Sin body.
export function emitirFactura(facturaId: string, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/invoices/${facturaId}/issue`, { method: "POST" }, centroId);
}

// Imprimir = EMITIR si procede (BE, desplegado). Un borrador SALDADO se emite (número/fecha definitivos,
// entra al cuadre) y `emitida:true`; un borrador SIN cobrar NO se emite pero NO bloquea la impresión
// (`emitida:false`, `motivo:"factura.no_emitida_pendiente_pago"`, `pendiente` con lo que falta); ya
// emitida/anulada/devuelta no hace nada (idempotente). El FE llama esto ANTES de window.print(), refresca
// con la factura devuelta y, si emitida=false con motivo, lo muestra como AVISO (no error): imprimir es
// válido igual. Handoff HANDOFF-vitales-en-atencion-e-imprimir-emite.
// El BE traduce las claves del mapa (factura→invoice, motivo→reason, numeroPresupuesto→quoteNumber) pero
// deja en español las que no están (emitida, pendiente, saldo, documento).
export interface ImprimirFacturaResult {
  invoice: FacturaConItems;
  emitida: boolean;
  reason?: string | null;
  pendiente?: { saldo?: number; paidAmount?: number; total?: number } | null;
  // Qué documento es el papel: "presupuesto" (borrador con saldo → NO emite, NO consume correlativo de
  // factura; trae `quoteNumber`) o "factura" (saldado/cortesía → emitida). El nº de presupuesto se
  // asigna la 1ª vez y se reusa al reimprimir. Handoff imprimir-presupuesto-cuando-no-esta-cobrada.
  documento?: "presupuesto" | "factura" | string;
  quoteNumber?: string | null;
}
export function imprimirFactura(facturaId: string, centroId?: string): Promise<ImprimirFacturaResult> {
  return apiFetch<ImprimirFacturaResult>(`/invoices/${facturaId}/print`, { method: "POST" }, centroId);
}

// Anular una factura emitida (RBAC factura.anular; motivo obligatorio). El BE sella
// actor/fecha. La ventana "mismo día" es configurable en el BE.
export function anularFactura(facturaId: string, motivo: string, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(
    `/invoices/${facturaId}/void`,
    { method: "POST", body: JSON.stringify({ reason: motivo }) },
    centroId,
  );
}

export function getFormasPago(centroId?: string): Promise<FormaPago[]> {
  return apiFetch<FormaPago[]>(`/billing/payment-methods`, {}, centroId);
}

// Enviar la factura por email (BE PR #106). Sin `email` usa el del paciente (400 si no hay ninguno).
// RBAC notificaciones.create. El DTO no está tipado en swagger → shape del handoff.
export function emailFactura(facturaId: string, payload: { email?: string; body?: string }, centroId?: string): Promise<unknown> {
  return apiFetch(`/invoices/${facturaId}/email`, { method: "POST", body: JSON.stringify(payload) }, centroId);
}

// ---- Devoluciones (BE PR #102) ---------------------------------------------
// Una factura EMITIDA puede tener varias devoluciones (append-only, no bloqueante).
// Anular (mismo día, error) ≠ Devolver (día siguiente/24h). El actor lo sella el BE (RequestContext).
// displayNumber = correlativo PROPIO de la devolución (p. ej. "D-000001"), secuencia independiente de
// facturas (BE PR #113). Lo proyecta el BE en la lista/detalle aunque no esté en la entidad base.
export type Devolucion = components["schemas"]["DevolucionEntity"] & { displayNumber?: string | null };
export type DevolverPayload = components["schemas"]["DevolverDto"];

// Recibo PROPIO de una devolución (documento "Devolución #D-000001", no la factura). El BE no tipó la
// respuesta en Swagger (Record<string,never>) → tipamos aquí la forma verificada en vivo. Los ítems traen
// `invoiceItemId` (para resolver el nombre desde la factura de origen) pero no el nombre del producto.
export type ReciboDevolucionItem = {
  invoiceItemId: string;
  productId: string;
  quantity: number;
  sessions: number;
  amount: number; // base reembolsada (pre-impuesto)
  taxAmount: number;
};
// `tipoDocumento` y `formaReembolso` NO están en el mapa api-ingles → el BE las deja en español.
// `empresa`/`emisor` tampoco (la clave), pero su CONTENIDO se traduce por recursión.
export type ReciboDevolucion = {
  tipoDocumento: "devolucion";
  displayNumber: string;
  invoiceNumber: string | null; // referencia de origen
  date: string;
  status: string; // activa | anulada
  refundedAmount: number; // total con impuesto
  refundedTax: number;
  formaReembolso: string | null;
  reason: string | null;
  items: ReciboDevolucionItem[];
  patient: { firstName?: string; lastName?: string | null; medicalRecordNumber?: string | null; documentId?: string | null } | null;
  empresa: FacturaEmpresa | null;
  emisor: { id?: string; name?: string | null } | null;
};
export function getReciboDevolucion(
  facturaId: string,
  devolucionId: string,
  centroId?: string,
): Promise<ReciboDevolucion> {
  return apiFetch<ReciboDevolucion>(`/invoices/${facturaId}/refunds/${devolucionId}/receipt`, {}, centroId);
}

// Registrar una devolución (total o parcial) de una factura. items = líneas a devolver.
export function devolverFactura(facturaId: string, payload: DevolverPayload, centroId?: string): Promise<FacturaConItems> {
  return apiFetch<FacturaConItems>(`/invoices/${facturaId}/refund`, { method: "POST", body: JSON.stringify(payload) }, centroId);
}
// Devoluciones de UNA factura.
export function listDevolucionesDeFactura(facturaId: string, centroId?: string): Promise<Devolucion[]> {
  return apiFetch<Devolucion[]>(`/invoices/${facturaId}/refunds`, {}, centroId);
}
// Anular una devolución (RBAC). Motivo obligatorio; actor sellado por el BE.
export function anularDevolucion(facturaId: string, devolucionId: string, motivo: string, centroId?: string): Promise<unknown> {
  return apiFetch(`/invoices/${facturaId}/refunds/${devolucionId}/void`, { method: "POST", body: JSON.stringify({ reason: motivo }) }, centroId);
}

// Guía de timing (no bloqueante): mismo día → sugiere Anular; después → Devolver. Ambos siempre disponibles.
// Ninguna clave de esta política está en el mapa api-ingles → todas siguen en español.
export interface PoliticaDevolucion {
  accionSugerida?: "anular" | "devolver";
  mismoDia?: boolean;
  dentroVentanaAnulacion?: boolean;
  config?: Record<string, unknown>;
}
export function getPoliticaDevolucion(facturaId: string, centroId?: string): Promise<PoliticaDevolucion> {
  return apiFetch<PoliticaDevolucion>(`/invoices/${facturaId}/refund-policy`, {}, centroId);
}

// Precio base de un producto (para la política precio_base: valorar lo consumido al precio base).
export function getPrecioBase(productoId: string, centroId?: string): Promise<{ productId: string; basePrice: number }> {
  return apiFetch<{ productId: string; basePrice: number }>(
    `/invoices/base-price?productId=${encodeURIComponent(productoId)}`,
    {},
    centroId,
  );
}

// Lista GLOBAL de devoluciones (por centro), paginada + filtros. Cada fila = DevolucionEntity
// (invoiceNumber incluido). Multi-tenant por X-Tenant-ID.
export interface ListDevolucionesParams {
  page?: number;
  limit?: number;
  q?: string; // nº de factura
  status?: string; // activa|anulada
  from?: string;
  to?: string;
  context?: "general" | "consulta"; // filtra por tipo de factura de la devolución
}
export function listDevoluciones(params: ListDevolucionesParams = {}, centroId?: string): Promise<Paginated<Devolucion>> {
  const { page = 1, limit = 20, q, status, from, to, context } = params;
  const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (q?.trim()) sp.set("q", q.trim());
  if (status) sp.set("status", status);
  if (from) sp.set("from", from);
  if (to) sp.set("to", to);
  if (context) sp.set("context", context);
  return apiFetchPaged<Devolucion>(`/billing/refunds?${sp.toString()}`, {}, centroId);
}

export function registrarPago(facturaId: string, payload: RegistrarPagoPayload, centroId?: string): Promise<unknown> {
  return apiFetch(`/invoices/${facturaId}/payments`, { method: "POST", body: JSON.stringify(payload) }, centroId);
}

// Corrección de un pago/reembolso (append-only, auditable): anula el viejo y crea el corregido
// enlazado; recomputa la factura. Sirve tanto para pagos (type=pago) como para el reembolso de una
// devolución (type=reembolso, conserva el type). RBAC `factura.pago.anular`. Ver #112.
export type RepararPagoPayload = components["schemas"]["RepararPagoDto"];
export function repararPago(
  facturaId: string,
  pagoId: string,
  payload: RepararPagoPayload,
  centroId?: string,
): Promise<unknown> {
  return apiFetch(
    `/invoices/${facturaId}/payments/${pagoId}`,
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
    `/invoices/${facturaId}/payments/${pagoId}`,
    { method: "DELETE", body: JSON.stringify({ reason: motivo }) },
    centroId,
  );
}

// Series de numeración (SerieNumeracion + get/actualizar/establecerArranque) extraídas a
// ./facturas-series por el techo de tamaño (max-lines); se re-exportan para no tocar consumidores.
export * from "./facturas-series";
