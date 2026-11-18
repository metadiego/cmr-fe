import { normalizarPermiso } from "./normalizar-permiso.ts"

// Permission keys moved to English and four merged into another (BE PR metadiego/cmr-be#620,
// owner 18-nov-2026; handoff docs/specs/permission-keys-in-english-handoff-fe.md). Until that BE
// release /auth/me returns the old keys, after it the new ones: a key and its other names are the
// same permission, both ways, so every check works before and after the night. Copied from the BE map
// (src/core/auth/permission-key-renames.ts); `atencion.read` is the earlier frontdesk rename.
const OLD_TO_NEW: Readonly<Record<string, string>> = {
  "ahora-mismo.config": "right_now.config",
  "ahora-mismo.ingest": "right_now.ingest",
  "ahora-mismo.read": "right_now.read",
  "alertas.config": "alerts.config",
  "alertas.create": "alerts.create",
  "alertas.read": "alerts.read",
  "alertas.resolver": "alerts.resolve",
  "alertas.update": "alerts.update",
  "atencion.read": "frontdesk.read",
  "auditoria.purgar": "audit.purge",
  "auditoria.read": "audit.read",
  "caja.cerrar": "billing.close",
  "caja.count_mode": "billing.count_mode",
  "caja.create": "billing.create",
  "caja.past_day.modify": "billing.past_day.modify",
  "caja.reabrir": "billing.reopen",
  "caja.read": "billing.read",
  "caja.scan": "billing.scan",
  "caja.sign_as_manager": "billing.sign_as_manager",
  "caja.update": "billing.update",
  "caja.ver_todos": "billing.view_all",
  "calendario.absences": "calendar.absences",
  "calendario.config": "calendar.config",
  "calendario.create": "calendar.create",
  "calendario.delete": "calendar.delete",
  "calendario.read": "calendar.read",
  "calendario.update": "calendar.update",
  "captacion.read": "acquisition.read",
  "cash.write": "billing.update",
  "cash_attachment.delete": "billing.attachment.delete",
  "centro.fiscal.write": "centers.fiscal.write",
  "centros.cambiar": "centers.switch",
  "centros.create": "centers.create",
  "centros.read": "centers.read",
  "centros.update": "centers.update",
  "citas.config": "appointments.config",
  "citas.config.global": "appointments.config.global",
  "citas.create": "appointments.create",
  "citas.multicentro": "appointments.multi_center",
  "citas.read": "appointments.read",
  "citas.reparar": "appointments.repair",
  "citas.retroactivo": "appointments.retroactive",
  "citas.update": "appointments.update",
  "clientes.read": "patients.read",
  "compras.planificar": "purchases.plan",
  "configuracion.panel": "settings.panel",
  "consulta.read": "invoice.division.consulta",
  "ehr-integration.config": "ehr_integration.config",
  "ehr-integration.read": "ehr_integration.read",
  "estadisticas.multicentro": "statistics.multi_center",
  "estadisticas.read": "statistics.read",
  "factura.anular": "invoice.void",
  "factura.columnas": "invoice.columns",
  "factura.create": "invoice.create",
  "factura.delete": "invoice.delete",
  "factura.descuento.grupo": "invoice.discount.group",
  "factura.devolucion.anular": "invoice.refund.void",
  "factura.devolver": "invoice.refund",
  "factura.division.*": "invoice.division.*",
  "factura.division.consulta": "invoice.division.consulta",
  "factura.division.general": "invoice.division.general",
  "factura.kit_agregar": "invoice.add_kit",
  "factura.pago.anular": "invoice.payment.void",
  "factura.read": "invoice.read",
  "factura.refund.repair": "invoice.refund.repair",
  "factura.reopen": "invoice.reopen",
  "factura.reparar": "invoice.repair",
  "factura.retroactivo": "invoice.retroactive",
  "factura.transferir": "invoice.transfer",
  "factura.update": "invoice.update",
  "formatos.config": "formats.config",
  "formatos.read": "formats.read",
  "frontdesk.disponibilidad.editar": "frontdesk.availability.edit",
  "frontdesk.reparar": "frontdesk.repair",
  "inventario.ajustar": "inventory.adjust",
  "inventario.cerrar": "inventory.close",
  "inventario.create": "inventory.create",
  "inventario.delete": "inventory.delete",
  "inventario.read": "inventory.read",
  "inventario.recibir": "inventory.receive",
  "inventario.regla": "inventory.rule",
  "inventario.retroactivo": "inventory.retroactive",
  "inventario.scale": "inventory.scale",
  "inventario.transferir": "inventory.transfer",
  "inventario.update": "inventory.update",
  "invoice_edit.issued_same_day": "invoice.edit.issued_same_day",
  "invoice_reopen.any_date": "invoice.reopen.any_date",
  "menu.desarrollo": "menu.development",
  "notificaciones.config": "notifications.config",
  "notificaciones.create": "notifications.create",
  "notificaciones.read": "notifications.read",
  "numeracion.arranque": "numbering.start",
  "pacientes.cartera.traspasar": "patients.portfolio.transfer",
  "pacientes.config": "patients.config",
  "pacientes.create": "patients.create",
  "pacientes.delete": "patients.delete",
  "pacientes.merge": "patients.merge",
  "pacientes.prioridad_flags.admin": "patients.priority_flags.admin",
  "pacientes.prioridad_flags.write": "patients.priority_flags.write",
  "pacientes.read": "patients.read",
  "pacientes.update": "patients.update",
  "panel.aceptar": "panel.accept",
  "panel.notificar": "panel.notify",
  "personal.create": "staff.create",
  "personal.delete": "staff.delete",
  "personal.read": "staff.read",
  "personal.update": "staff.update",
  "precios.create": "prices.create",
  "precios.delete": "prices.delete",
  "precios.read": "prices.read",
  "precios.update": "prices.update",
  "print-hub.delete": "print_hub.delete",
  "print-hub.process": "print_hub.process",
  "print-hub.read": "print_hub.read",
  "print-hub.update": "print_hub.update",
  "profiles.codigo_acceso": "profiles.access_code",
  "reportes.grupo.read": "reports.group.read",
  "resources.update": "resources.config",
  "scheduling-bridge.config": "scheduling_bridge.config",
  "scheduling-bridge.read": "scheduling_bridge.read",
  "scheduling-bridge.run": "scheduling_bridge.run",
  "servicios.config": "services.config",
  "servicios.create": "services.create",
  "servicios.delete": "services.delete",
  "servicios.multicentro": "services.multi_center",
  "servicios.read": "services.read",
  "servicios.update": "services.update",
  "tablero.admin": "board.admin",
  "tablero.config": "board.config",
  "tablero.create": "board.create",
  "tablero.read": "board.read",
  "tablero.update": "board.update",
  "tratamiento.cambio_protocolo": "treatment.protocol_change",
}

// Indexed by the normalized key (normalizar-permiso.ts), so a casing/separator typo still finds its
// other names, as `can()` has always tolerated.
const NOW_BY_KEY = new Map(Object.entries(OLD_TO_NEW).map(([old, now]) => [normalizarPermiso(old), now]))
const OLD_BY_NOW = Object.entries(OLD_TO_NEW).reduce((acc, [old, now]) => {
  const k = normalizarPermiso(now)
  acc.set(k, [...(acc.get(k) ?? []), old])
  return acc
}, new Map<string, string[]>())

/** Every name a permission goes by: itself, its English name, and the old names that became it. */
export function permissionAliases(key: string): string[] {
  const now = NOW_BY_KEY.get(normalizarPermiso(key)) ?? key
  return [...new Set([key, now, ...(OLD_BY_NOW.get(normalizarPermiso(now)) ?? [])])]
}

/**
 * Whether `permissions` (from /auth/me) holds `key` under any of its names. `*` holds everything.
 * Matched normalized (normalizar-permiso.ts), as `can()` always was. Cosmetic: the BE enforces.
 */
export function holdsPermission(permissions: readonly string[], key: string): boolean {
  if (permissions.includes("*")) return true
  const wanted = new Set(permissionAliases(key).map(normalizarPermiso))
  return permissions.some((p) => wanted.has(normalizarPermiso(p)))
}
