# Handoff FE — claves de permiso en inglés

BE: PR metadiego/cmr-be#620 (plan `docs/plans/permission-keys-in-english.md`). **El FE sale ANTES de la
noche del BE**: en cuanto se despliegue el BE, `/auth/me` devuelve las claves nuevas y cada
`can('factura.read')` del FE daría `false` — la pantalla se queda sin botones, no da error.

## 1. Qué cambia en el API (el día del despliegue del BE)

- **Lo que el BE devuelve viene con la clave nueva**: `GET /auth/me` → `permissions`, el menú
  (`requiresPermiso` de cada ítem), `GET /permissions` (`slug`, `module`, `action`), los permisos de un
  rol, las excepciones por persona, las API keys, y el 403 que dice qué permiso falta.
- **Lo que el BE recibe acepta las dos para siempre**: permisos de un rol, excepciones, crear una API
  key, `?permiso=` de «¿en qué centros puedo…?», ítems de menú y tableros. No hay que cambiar nada de
  lo que el FE envía.
- 219 claves → 179: 128 cambian de nombre, 4 se funden en otra, 37 se retiran (no protegían nada).

## 2. Qué tiene que hacer el FE (un solo sitio)

`can(k)` (y `<Can permiso>`, `useCan`, y cualquier `permissions.includes(…)` suelto) debe dar `true` si
el usuario tiene **k o su otro nombre**, en los dos sentidos, para que funcione igual con el BE de hoy
(claves viejas) y con el de mañana (claves nuevas):

```ts
// lib/access/permission-keys.ts — copiar el mapa de abajo tal cual
const OLD_TO_NEW: Record<string, string> = { /* §4 */ };
const NEW_TO_OLD = Object.entries(OLD_TO_NEW).reduce<Record<string, string[]>>(
  (acc, [o, n]) => ((acc[n] ??= []).push(o), acc), {});

/** Every name a key goes by: itself, its new name, and the old names that became it. */
export function permissionAliases(k: string): string[] {
  const n = OLD_TO_NEW[k] ?? k;
  return [...new Set([k, n, ...(NEW_TO_OLD[n] ?? [])])];
}
// can(k) = perms.includes('*') || permissionAliases(k).some((a) => perms.includes(a))
```

Con eso el FE puede, en el mismo PR o después, pasar sus literales a la clave nueva
(`can('invoice.read')`): sigue funcionando con el BE de hoy. Las claves retiradas (§5) no las comprueba
ninguna pantalla hoy (medido en `origin/main` del FE el 18-nov-2026); si alguna aparece, se borra la
comprobación o se cambia por la clave que de verdad protege esa acción.

**Ojo con las agrupaciones por módulo** (editor de roles: `p.module === requiresPermiso.split('.')[0]`):
siguen funcionando porque el menú y el catálogo cambian a la vez, en la misma migración. No hay etiquetas
i18n por clave de permiso en el FE.

## 3. Cómo se comprueba

- Con el BE de hoy (claves viejas): las pantallas igual que antes.
- Contra un BE con #620 (claves nuevas): las mismas pantallas, los mismos botones, para un admin, un
  gerente (`manager`), `billing`, `frontdesk`, `nursing`.
- Lo que SÍ cambia a propósito tras la noche: el rol `billing` ve «Facturación de consultas» y
  «Devoluciones de consultas» en el menú; `facturacion-inventario` y `nursing` ven «Pacientes» (páginas
  que ya podían abrir).

## 4. El mapa (clave vieja → clave nueva)

Incluye las 4 fusiones (`cash.write` → `billing.update`, `consulta.read` → `invoice.division.consulta`,
`clientes.read` → `patients.read`, `resources.update` → `resources.config`) y el renombre anterior
`atencion.read` → `frontdesk.read`.

```json
{
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
  "tratamiento.cambio_protocolo": "treatment.protocol_change"
}
```

## 5. Claves retiradas (no protegían nada)

`alertas.delete`, `auditoria.create`, `auditoria.delete`, `auditoria.update`, `billing.multicenter`, `caja.delete`, `centros.delete`, `citas.delete`, `clientes.create`, `clientes.delete`, `clientes.update`, `consulta.create`, `consulta.delete`, `consulta.update`, `ehr-integration.create`, `ehr-integration.delete`, `ehr-integration.update`, `export.delete`, `export.update`, `mediciones.create`, `mediciones.delete`, `mediciones.read`, `mediciones.update`, `notificaciones.delete`, `notificaciones.update`, `prescripcion.admin`, `prescripcion.create`, `prescripcion.delete`, `prescripcion.read`, `prescripcion.update`, `prescripcion.write`, `resources.create`, `resources.delete`, `scheduling-bridge.create`, `scheduling-bridge.delete`, `scheduling-bridge.update`, `tablero.delete`

