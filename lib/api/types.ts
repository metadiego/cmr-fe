// Mirrors cmr-be's response/error envelopes (see CLAUDE.md request pipeline).

export interface ApiMeta {
  tenant?: string;
  timestamp: string;
  requestId: string;
  pagination?: { total: number; page: number; limit: number };
  // Resumen del RANGO filtrado que el BE calcula server-side (mismos filtros que la lista):
  // importe facturado, cuántas quedaron exentas (en cero) y cuántas cobradas. GET /facturas.
  // Es la fuente de verdad del total del rango (no sumar la página). Handoff facturación-totales.
  resumen?: { importe: number; exentas: number; cobradas: number };
  // Non-fatal warnings the BE attaches to a successful write (e.g. an
  // appointment created despite an overlap when the policy is "advertir").
  advertencias?: ApiWarning[];
  // Avisos no bloqueantes de una escritura exitosa (p. ej. cupo excedido al agendar,
  // BE PR #168). El FE los muestra como toast traducido por `labelKey`.
  warnings?: ApiWarning[];
  // CERTIFICADO de persistencia (BE, POST /tablero/celda): el bloque se arma RELEYENDO la fila de la base
  // tras guardar, no con lo que el servidor creía escribir. `ok:false` = no quedó (validador, carrera, no
  // se pudo releer). El FE lo muestra en un toast y, si ok:false, devuelve la celda a `campos` (la verdad).
  // Handoff HANDOFF-toast-que-certifica-la-persistencia.
  persistencia?: Persistencia;
}

export interface Persistencia {
  ok: boolean;
  entidad?: string;
  id?: string;
  // Ruta del dato → valor REAL en la base (p. ej. { "datos.tubos": 8 }). Con ok:false trae lo que hay
  // de verdad (a veces null): esa es la fuente de verdad para revertir la celda.
  campos?: Record<string, unknown>;
  guardadoEn?: string | null; // updatedAt de la fila releída (hora de la BASE, no del navegador)
  motivo?: string;
}

export interface ApiWarning {
  code: string;
  labelKey?: string;
  message?: string;
  [k: string]: unknown;
}

export interface ApiEnvelope<T> {
  data: T;
  meta: ApiMeta;
}

// For endpoints the BE returns paginated (meta.pagination present).
export interface Paginated<T> {
  items: T[];
  pagination: { total: number; page: number; limit: number };
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorShape {
  // labelKey: optional i18n key the BE attaches to domain errors
  // (e.g. "facturacion.anulacion.fuera_de_ventana") for client-side translation.
  // Domain errors may also carry extra business payload (e.g. `dueno` on
  // PACIENTE_RECORD_DUPLICADO, `campos` on PACIENTE_CAMPOS_OBLIGATORIOS).
  error: {
    code: string;
    message: string;
    labelKey?: string;
    details?: ApiErrorDetail[];
    [key: string]: unknown;
  };
  meta: ApiMeta;
}

// Thrown by the API client on any non-2xx response.
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: ApiErrorDetail[];
  readonly labelKey?: string;
  // Full error body from the BE, for domain errors whose UI needs more than
  // the message (e.g. who owns a duplicated record number).
  readonly data?: Record<string, unknown>;

  // Spelled out instead of TS parameter-property shorthand: the shorthand isn't valid syntax under
  // `node --experimental-strip-types` (type-stripping only, no real transform), which is what
  // `npm test` runs on — a test importing ApiError directly (lib/api/ehr-integration.test.ts) failed
  // to even parse until this changed. Behavior is identical.
  constructor(
    code: string,
    message: string,
    status: number,
    details?: ApiErrorDetail[],
    labelKey?: string,
    data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.labelKey = labelKey;
    this.data = data;
  }
}
