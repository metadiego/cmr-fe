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

// El PAYLOAD que sale al BE va en INGLÉS (API v2): el estado del formulario
// (BulkFormValues) es interno del FE y sigue en español, pero aquí se traduce al
// enviar (name/sortOrder/billingGroupId/productId/requiresTechnician/requiresNurse;
// color y badge se dicen igual). Antes salía en español bajo un cast y el BE v2 lo
// ignoraba en silencio. Ver docs/specs/api-v2-en-ingles.md.
export type BulkDirtyPayload = {
  name?: string;
  color?: string;
  sortOrder?: number;
  billingGroupId?: string | null;
  productId?: string | null;
  requiresTechnician?: boolean;
  requiresNurse?: boolean;
  badge?: boolean;
};

export function payloadBulkDirty(
  inicial: BulkFormValues,
  actual: BulkFormValues,
): BulkDirtyPayload {
  const out: BulkDirtyPayload = {};
  if (actual.nombre.trim() !== inicial.nombre.trim() && actual.nombre.trim()) {
    out.name = actual.nombre.trim();
  }
  if (actual.color !== inicial.color) out.color = actual.color;
  if (actual.orden.trim() !== inicial.orden.trim()) {
    const n = Number(actual.orden);
    if (actual.orden.trim() && Number.isFinite(n)) out.sortOrder = n;
  }
  if (actual.grupoFacturacionId !== inicial.grupoFacturacionId) {
    out.billingGroupId = actual.grupoFacturacionId || null;
  }
  if (actual.productoId !== inicial.productoId) {
    out.productId = actual.productoId || null;
  }
  if (actual.requiereTecnico !== inicial.requiereTecnico) {
    out.requiresTechnician = actual.requiereTecnico;
  }
  if (actual.requiereEnfermera !== inicial.requiereEnfermera) {
    out.requiresNurse = actual.requiereEnfermera;
  }
  if (actual.badge !== inicial.badge) out.badge = actual.badge;
  return out;
}
