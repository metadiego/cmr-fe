// Mirrors cmr-be's response/error envelopes (see CLAUDE.md request pipeline).

export interface ApiMeta {
  tenant?: string;
  timestamp: string;
  requestId: string;
  pagination?: { total: number; page: number; limit: number };
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
  error: { code: string; message: string; details?: ApiErrorDetail[] };
  meta: ApiMeta;
}

// Thrown by the API client on any non-2xx response.
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}
