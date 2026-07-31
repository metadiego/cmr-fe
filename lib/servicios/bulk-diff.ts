// Payload "dirty-only" para la edición multicentro (Aplicar a todos los centros).
//
// Regla (fix del review del PR #2): al bulk SOLO van los campos que el usuario
// CAMBIÓ respecto al estado inicial del formulario. Nunca se envía el form
// completo sembrado desde el centro representativo — eso aplanaba diferencias
// legítimas entre centros (p. ej. `orden`) que el usuario nunca tocó.
//
// Limpiar grupo/producto (valor inicial → vacío) envía `null` EXPLÍCITO: el BE
// lo acepta para desanclar en todos los centros (undefined = "sin cambio").
// `orden` es NOT NULL en el BE: vacío o no numérico se OMITE (no hay "limpiar").

export type BulkFormValues = {
  nombre: string;
  color: string;
  orden: string;
  grupoFacturacionId: string;
  productoId: string;
  requiereTecnico: boolean;
  requiereEnfermera: boolean;
  badge: boolean;
};

export type BulkDirtyPayload = {
  nombre?: string;
  color?: string;
  orden?: number;
  grupoFacturacionId?: string | null;
  productoId?: string | null;
  requiereTecnico?: boolean;
  requiereEnfermera?: boolean;
  badge?: boolean;
};

export function payloadBulkDirty(
  inicial: BulkFormValues,
  actual: BulkFormValues,
): BulkDirtyPayload {
  const out: BulkDirtyPayload = {};
  if (actual.nombre.trim() !== inicial.nombre.trim() && actual.nombre.trim()) {
    out.nombre = actual.nombre.trim();
  }
  if (actual.color !== inicial.color) out.color = actual.color;
  if (actual.orden.trim() !== inicial.orden.trim()) {
    const n = Number(actual.orden);
    if (actual.orden.trim() && Number.isFinite(n)) out.orden = n;
  }
  if (actual.grupoFacturacionId !== inicial.grupoFacturacionId) {
    out.grupoFacturacionId = actual.grupoFacturacionId || null;
  }
  if (actual.productoId !== inicial.productoId) {
    out.productoId = actual.productoId || null;
  }
  if (actual.requiereTecnico !== inicial.requiereTecnico) {
    out.requiereTecnico = actual.requiereTecnico;
  }
  if (actual.requiereEnfermera !== inicial.requiereEnfermera) {
    out.requiereEnfermera = actual.requiereEnfermera;
  }
  if (actual.badge !== inicial.badge) out.badge = actual.badge;
  return out;
}
