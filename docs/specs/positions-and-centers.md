# Handoff FE — Puestos y Centros (FE-1)

Backend: `cmr-be` rama `feat/positions-and-centers` (BE-1). Spec de negocio:
`cmr-be/docs/specs/positions-and-centers.md`; plan y ensayos: `cmr-be/docs/plans/positions-and-centers.md`.
Decisiones del dueño (26-nov-2026): **un solo concepto, el puesto, y se tiene EN un centro**; los centros
de una persona son los centros donde tiene un puesto. Sustituye a Cargo, Responsabilidades, Centros de
servicio, Acceso › Rol(es) y Acceso › Centros.

## 1. Lo que sirve el BE (v2, también v1 en `/puestos`)

| Método | Ruta | Permiso | Respuesta |
|---|---|---|---|
| GET | `/positions` | `staff.read` | `[{ id, slug, name, labelKey, allCenters, permissions, fullAccess }]` — `permissions` = cuántos lleva (0 = solo dice qué hace la persona y la pone en esos selectores); `fullAccess` = admin |
| GET | `/staff/:id/positions` | `staff.read` (404 si la ficha no se puede leer) | `{ primary: string \| null, positions: [{ position, labelKey, permissions, centerIds: string[] \| null }] }` — `centerIds: null` = en todos (solo admin) |
| PUT | `/staff/:id/positions` | `staff.update` + reglas abajo | igual que el GET, ya guardado |

Cuerpo del PUT: `{ positions: [{ position: 'billing', centerIds: ['<bay>', '<cag>'] }, { position: 'admin' }], primary?: 'billing' }`.
Es la lista **COMPLETA**: lo que no va, se quita.

Reglas (las mismas que antes, ahora por lo que CAMBIA):
- Cada centro tocado (añadido o quitado) exige `staff.update` en ese centro → si no, **403**.
- Un puesto que **lleva permisos** (`permissions > 0`) es un cambio de acceso: solo un administrador
  (`me.isAdmin`) → si no, **403** `positions.accessChangeNeedsAdmin`. Los de 0 permisos (médico, enfermera,
  técnico, cajero, contabilidad, otro) los cambia quien tenga `staff.update`, como antes los centros de servicio.
- `admin` va en todos los centros (`centerIds` omitido) y pide confirmación: **428** →
  repetir con `X-Confirm-Action: rbac.admin.grant` (o `rbac.admin.revoke`). Nunca deja el sistema sin admin (409).
- `labelKey` es `positions.<slug>`: añadir las claves en `messages/es.json` y `en.json`
  (`admin`, `manager`, `appointments` = «Operadora», `frontdesk` = «Recepción», `billing`, `inventory`,
  `doctor`, `nurse`, `technician`, `cashier`, `accounting`, `other`, `nursing`, `nursing_panel`,
  `facturacion-inventario`, `read_only`). Sin clave conocida → mostrar `name`.

Sigue funcionando mientras tanto (BE-1 escribe también en los puestos): `POST/DELETE /profiles/:id/roles`,
`/profiles/:id/assignments`, `PUT /staff/:id/centers`, `GET /staff/job-titles`. FE-1 deja de usarlos;
BE-2 los retira.

## 2. La ficha de personal (Configuración › Personal › persona)

Hoy (`app/(app)/configuration/staff/page.tsx`, `components/personal/ficha-editor.tsx`,
`staff-record-sections.tsx`, `components/admin/user-access-panel.tsx`, `access-dialog.tsx`,
`access-por-centro-tab.tsx`, `profile-centros-dialog.tsx`):

**Quitar**: Cargo (select), Responsabilidades (chips), Centros de servicio (`CentrosDePersona`), y del
bloque «Acceso al sistema» las insignias Rol(es)/Centro(s), el botón «Centros» (`ProfileCentrosDialog`)
y las pestañas Roles y Por centro del sheet «Accesos» (`RolesTab`, `AccessPorCentroTab`).

**Poner** una sección **«Puestos»**: una fila por centro (Bayamón, Caguas) con los chips de puestos
de `GET /positions` marcados según `GET /staff/:id/positions`; uno marcado como **principal** (es la
etiqueta de la persona). Guardar = `PUT` con la lista completa (mismo `useSaveSection` del resto de la
ficha). `admin` no va por centro: un interruptor aparte, solo visible para administradores.
- Los chips que llevan permisos se ven distintos (p. ej. un candado) y quedan deshabilitados para quien
  no es admin, con el motivo escrito (regla 8: nunca un botón gris sin decir por qué).
- Los centros de la persona = las filas con al menos un puesto. No hay otro sitio donde poner centros.

**Se queda** en «Accesos» solo la pestaña **Excepciones** (y la vista previa del menú).

La lista de la izquierda (`staff-list.tsx`): debajo del nombre, la etiqueta del puesto principal
(`positions.<slug>`); las insignias de centro = centros donde tiene un puesto. Unificar las tres
copias del helper de etiqueta (`ficha-editor.tsx:55`, `staff-list.tsx:33`, `column-config-dialog.tsx:456`)
en una sola, y quitar el slug crudo de `invite-dialog.tsx:315`.

**Invitar** (`give-access-dialog.tsx`, `invite-dialog.tsx`): correo + puestos por centro (el mismo
selector), en vez de un rol + un centro.

## 3. Selector de centro y menú (owner, 26-nov; maqueta claude.ai/artifact/1fmXwp9RjMWTdB1KSQHyqJ)

- El selector de arriba (segmentado, #162) ofrece los centros de la persona (`/auth/me/centers`;
  `/operational` queda como alias hasta BE-2). Una sola fuente: `useCentroGate` y los 27 usos de
  `getMyCentros` leen lo mismo.
- **El menú es el mismo en cualquier vista**: toda pantalla que la persona puede usar en al menos uno de
  sus centros. No cambia con el centro activo.
- Cada pantalla muestra solo los centros donde se tiene su permiso de lectura; si falta uno, una nota
  («Solo Bayamón: en Caguas no tienes acceso a Inventario»), no desaparecer del menú.
- Las acciones de cada fila se resuelven en el centro de la fila (como hoy, `heldInCenter`).
- «Ambos» mantiene la regla del 05-nov (`centers.combined`).

## 4. Selectores de personas (médicos, enfermeras, técnicos)

Sin cambio en FE-1: siguen leyendo lo que leían. El BE mantiene esas columnas al día cuando cambian los
puestos. En BE-2 los selectores pasan a leer puestos; el FE no tendrá que tocar nada salvo lo que diga
ese handoff.

## 5. Hecho cuando

- La ficha muestra y guarda Puestos; ya no hay Cargo, Responsabilidades, Centros de servicio ni Rol(es).
- Un no-admin no puede marcar un puesto con permisos (y ve por qué); un admin sí; admin pide confirmación.
- El menú no cambia al cambiar de centro; las pantallas avisan del centro sin acceso.
- i18n en es y en; tests en `lib/` (helper de etiqueta, armado del cuerpo del PUT, qué chips se habilitan).
- Visto en navegador: claro/oscuro, escritorio/375px, con un admin y con un gerente de un centro.
