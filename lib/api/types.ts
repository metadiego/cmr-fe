// Mirrors cmr-be's response/error envelopes (see CLAUDE.md request pipeline).

export interface ApiMeta {
  tenant?: string;
  timestamp: string;
  requestId: string;
  pagination?: { total: number; page: number; limit: number };
  // Non-fatal warnings the BE attaches to a successful write (e.g. an
  // appointment created despite an overlap when the policy is "advertir").
  advertencias?: ApiWarning[];
  // Avisos no bloqueantes de una escritura exitosa (p. ej. cupo excedido al agendar,
  // BE PR #168). El FE los muestra como toast traducido por `labelKey`.
  warnings?: ApiWarning[];
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
  error: {
    code: string;
    message: string;
    labelKey?: string;
    details?: ApiErrorDetail[];
  };
  meta: ApiMeta;
}

// Thrown by the API client on any non-2xx response.
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: ApiErrorDetail[],
    public readonly labelKey?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
