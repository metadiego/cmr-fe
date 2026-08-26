# Handoff BE → FE: Editor de Rol unificado (pestaña opcional, para probar antes de reemplazar)

> Pedido del dueño (25-ago-2026): hoy la administración de roles está partida en 3 pestañas
> separadas (`roles`, `permisos`, `menu` en `/admin`) y se siente muy compleja. Quiere UNA sola
> pantalla: elegir un rol → ver TODAS las opciones del menú → por cada una, marcar si se ve
> (mostrar/ocultar) y qué puede hacer con ella (leer/crear/editar/borrar — solo los verbos que de
> verdad existan para esa pantalla, no un checklist fijo de 6).

## Cómo se construye: pestaña NUEVA, no reemplazo todavía

**No tocar `roles`, `permisos` ni `menu` por ahora.** Agregar una séptima pestaña en
`app/(app)/admin/page.tsx` (junto a las que ya están: `users`, `centers`, `theme`, `roles`,
`permisos`, `menu`, `pending`), por ejemplo `editor-rol` con label "Editor de Rol (beta)". El dueño
la va a revisar visualmente y decidir si funciona como quiere; **solo si aprueba, se borran las
tres pestañas viejas y esta queda como la única**. Así se prueba sin arriesgar lo que ya funciona.

## El BE no cambia — todo esto ya existe

Cero endpoints nuevos. El cliente ya tiene TODO lo necesario en `lib/api/rbac.ts`:

- `getRoles()` — para el selector de rol.
- `getRoleMenu(rolId)` — trae CADA ítem del menú con `allowed: boolean` (si está en la lista blanca
  de ese rol) y `requiresPermiso` (el permiso que ese ítem exige, ej. `"servicios.config"`).
- `getPermisos()` — el catálogo COMPLETO de permisos (`clave`, ej. `"servicios.read"`,
  `"servicios.update"`, `"facturacion.create"`…).
- `setRoleMenu(rolId, claves: string[])` — guarda la lista blanca (reemplaza completa).
- `getRolePermisos(rolId)` / `setRolePermisos(rolId, claves: string[])` — guarda los permisos
  concedidos al rol (reemplaza completa).

## Diseño de la pantalla

1. **Selector de rol** arriba (dropdown, como ya existe en `RbacSettings`).
2. **Una fila por ítem de menú**, agrupadas visualmente por su `parentClave` (mismos grupos que ya
   se ven en el nav: Agenda y pacientes, Facturación y caja, Inventario…). Por fila:
   - Nombre del ítem (su `labelKey`/label).
   - Un interruptor **Visible/Oculto** — es exactamente `allowed` en `getRoleMenu`.
   - Checkboxes de **verbos**, calculados así: tomar el módulo del `requiresPermiso` del ítem (todo
     antes del primer `.` — `"servicios.config"` → módulo `servicios`), filtrar `getPermisos()` por
     ese prefijo, y mostrar un checkbox por cada acción que EXISTA en el catálogo para ese módulo
     (`servicios.read`, `servicios.update`… — si el módulo no tiene `.delete`, no se muestra el
     checkbox de borrar). Marcado = esa clave está en `getRolePermisos(rolId)`.
   - Si un ítem no tiene `requiresPermiso` (ej. un grupo `g-agenda`, o un ítem sin permiso —
     `home`, `dashboard`), la fila solo muestra el interruptor Visible/Oculto, sin verbos.
3. **Un solo botón Guardar**: junta todos los "Visible" marcados → `setRoleMenu`; junta todas las
   claves de verbo marcadas → `setRolePermisos`. Dos llamadas, un solo clic — el usuario no debe
   notar que son dos endpoints por dentro.

## Qué NO hace esta pantalla (queda en las otras, por ahora)

- Crear/borrar roles — sigue en la pestaña `roles`.
- Crear/editar el catálogo de permisos o de ítems de menú — sigue en `permisos`/`menu`.
- Asignar un usuario a un rol, o las excepciones por persona — pantallas aparte (ver
  `docs/specs/clonar-usuario-al-crear.md` en `cmr-be`, spec relacionada).

## Qué se considera terminado

- La pestaña nueva existe, opcional, sin tocar las 3 viejas.
- Elegir un rol real (ej. `facturacion`) y ver su estado actual reflejado correctamente (visible +
  verbos marcados = lo que ya tiene hoy).
- Cambiar algo y Guardar produce el mismo resultado que hacerlo hoy por las 2 pantallas viejas
  (verificable comparando `getRoleMenu`/`getRolePermisos` antes/después).
- El dueño lo revisa en pantalla y dice si reemplaza las 3 pestañas viejas o se ajusta primero.

## Referencia

- `app/(app)/admin/page.tsx` — dónde viven las pestañas actuales.
- `components/admin/rbac-settings.tsx`, `permisos-catalogo.tsx`, `menu-admin.tsx` — las 3 pantallas
  que esta unifica (sin tocarlas todavía).
- `lib/api/rbac.ts` — todo el cliente ya existe, ver funciones listadas arriba.
