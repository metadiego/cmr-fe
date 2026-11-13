# Handoff FE — limpieza del control de acceso

Para `cmr-fe`. Lo escribe el BE (PR metadiego/cmr-be#557, pasos 1-7). Spec del BE:
`docs/specs/access-control-cleanup.md`; plan: `docs/plans/access-control-cleanup.md`.

Copiar a `cmr-fe/docs/specs/access-control-cleanup.md` cuando se trabaje en el FE.

## 0. Resumen

| Cuándo | Qué necesita el FE | Obligatorio |
|---|---|---|
| Antes de desplegar #557 | Entender las claves de rol nuevas (§3) | **Sí** |
| Antes de desplegar #557 | Aceptar `frontdesk_consultation` como tablero de la pestaña Consulta (§4) | **Sí** |
| Cuando quiera | Usar `isAdmin` en vez de `isMaster`/`accessMode` (§1) | No |
| Cuando quiera | Manejar las respuestas nuevas de la gestión de accesos (§2) | Recomendado |

Nada de la API actual se quita: mismas rutas y mismos campos. Las claves viejas que cambian (rol, el
tablero `atencion`, el permiso `atencion.read`, el canal `atencion`) se siguen aceptando en la entrada para
siempre; lo que cambia es lo que el BE **devuelve**.

## 1. `isAdmin` (paso 1)

- `GET /auth/me` devuelve `isAdmin: boolean`. Es la única señal de «acceso total», venga de donde venga
  (rol `admin`, `is_master` o la cuenta de emergencia). El `whoami` de MCP ya lo traía.
- `isMaster` y `accessMode` se siguen devolviendo. A partir del paso 6 se calculan:
  `isMaster = isAdmin`, `accessMode = 'admin' | 'operativo'`. `accessMode` se sigue aceptando en las
  peticiones (invite/editar perfil) y se ignora.
- Sitios del FE que leen `isMaster`/`accessMode` (revisión del 11-nov): `lib/centros-scope.ts:14`,
  `hooks/use-me.ts:19`, `components/calendario/calendario.tsx:87`,
  `app/(app)/configuration/audit/page.tsx:12,21`, `components/app-shell.tsx:81`,
  `components/admin/theme-settings.tsx:34`, `components/admin/users-list.tsx:133,180,213,236`. Pasarlos a
  `isAdmin` cuando se toquen.
- Un usuario con el rol `admin` (global) ve ahora los dos centros sin `is_master`.

## 2. Gestión de accesos (paso 2)

Usuarios, roles, permisos y API keys exigen **acceso total**. Respuestas nuevas:

| Situación | Respuesta | Qué hacer en pantalla |
|---|---|---|
| Quien llama no es admin | 403 `FORBIDDEN`, `labelKey: auth.full_access_required` | Ocultar la pantalla de gestión a quien no tenga `isAdmin` |
| Dar el rol `admin` | 428 `ACTION_REQUIRES_CONFIRMATION`, `action: rbac.admin.grant` | El diálogo de confirmación que ya existe; al aceptar, repetir con `X-Confirm-Action: rbac.admin.grant` |
| Quitar el rol `admin` | 428, `action: rbac.admin.revoke` | Igual, con `rbac.admin.revoke` |
| Dar o quitar `admin` con una API key | 403 `labelKey: rbac.adminPersonRequired` | — (solo una persona) |
| `admin` acotado a un centro | 400 `labelKey: rbac.adminIsGlobal` | El interruptor «Administrador» no ofrece centro |
| Quitar/suspender/rechazar al último admin | 409 `CONFLICT`, `labelKey: rbac.lastAdmin` | Mostrar el mensaje |
| Editar la cuenta de un admin sin ser admin | 403 `labelKey: rbac.adminTargetNeedsAdmin` | — |
| Editar el rol `admin` (permisos, «todos los centros», borrar) | 400 `labelKey: rbac.adminRoleFixed` | Mostrar el rol `admin` como solo lectura |
| `'*'` en otro rol o como excepción | 400 `labelKey: rbac.fullAccessOnlyAdmin` | No ofrecer `*` en los selectores de permisos |
| API key de centro con `*` o `profiles.*`/`rbac.*`/`api_keys.*` | 400 `labelKey: apiKeys.clinicKeyTooBroad` | Filtrar esas claves al crear una key de centro |
| API key con permisos que su creador no tiene | 400 `labelKey: apiKeys.beyondCreator` | — |

- `GET /api-keys` devuelve `lastUsedAt` (null = sin uso desde que se registra; resolución de 5 min).
  Sugerido: una columna «Último uso» en la lista de keys para revocar las que nadie usa.
- Opcional (spec §7): un interruptor «Administrador» en el usuario que asigna/quita el rol `admin` global.
- **Adjuntos del cuadre de caja**: subir (`POST …/attachments/upload-url` y `POST …/attachments`) pide ahora
  `cash.write` (antes `caja.read`). Mostrar el botón de adjuntar con `can('cash.write')`.
- **Menú (paso 5)**: `/me/menu` sale solo de los permisos. La pantalla de «menú del rol» (lista blanca) sigue
  respondiendo igual pero ya no cambia lo que la gente ve: conviene ocultarla o avisar de que no tiene efecto.

## 3. Claves de rol en inglés (paso 4b) — OBLIGATORIO antes de desplegar

Tras el despliegue, **las respuestas devuelven la clave nueva** (`roles[].clave` de `GET /profiles`,
`GET /roles`, `roles` de `GET /auth/me` y de `whoami`). Las peticiones aceptan la vieja y la nueva para
siempre. Los nombres visibles (`nombre`) **no cambian**.

| Clave vieja | Clave nueva | Nota |
|---|---|---|
| `admin` | `admin` | igual |
| `gerente` | `manager` | |
| `atencion` | `frontdesk` | se ve como «Recepción»: controla el centro de pacientes y la pestaña de pacientes, el flujo de pacientes por la clínica (decisión del dueño) |
| `recepcion` | `frontdesk` | fusionado (nadie lo tenía) |
| `citas` | `appointments` | |
| `cc_operator` | `appointments` | fusionado (nadie lo tenía) |
| `facturacion` | `billing` | |
| `facturador_consulta` | `billing` | fusionado: sus 3 personas pasan a `billing` |
| `enfermeria` | `nursing` | |
| `inventarios` | `inventory` | |
| `solo_lectura` | `read_only` | |
| `medicos`, `tecnicos`, `presidencia` | — | **retirados**: asignarlos devuelve 404 «Role not found» |

Qué hacer en `cmr-fe` (la revisión del 11-nov contó 37 ficheros que comparan claves de rol):

1. Un único mapa `legacy → nueva` (la tabla de arriba) y una función `roleKey(k)` que normaliza; toda
   comparación de claves de rol pasa por ella. Así el FE funciona **antes y después** del despliegue.
2. No crear roles nuevos con una clave vieja: el BE responde 400.
3. Las alertas por rol (`targets.rolClaves`) se guardan con la clave nueva; enviar la vieja vale.
4. Mejor aún: dejar de comparar claves de rol y mirar permisos o `isAdmin` (§1). Ninguna pantalla debería
   decidir por el nombre de un rol.

Este cambio del FE tiene que estar en producción **antes** de la noche en que se mezcle #557.

## 4. `atencion` se funde en frontdesk (paso 4c) — OBLIGATORIO antes de desplegar

Dueño, 12-nov-2026: «atencion y frontdesk son el mismo trabajo». Spec del BE §4.1.

| Qué | El BE devolvía | El BE devuelve | ¿Acepta lo viejo en la entrada? |
|---|---|---|---|
| Tablero de la pestaña Consulta (`GET /frontdesk/tabs` → `boardSlug`; `tablero.clave` en la definición) | `atencion` | `frontdesk_consultation` | Sí, para siempre (`?tablero=atencion`, `boardSlug: "atencion"`, rutas `/boards/atencion`) |
| Canal de la cita agendada en recepción (`channel`/`canal`) | `atencion` | `frontdesk` | Sí, para siempre (crear, registrar tarde, filtrar) |
| Permiso del tablero | `atencion.read` | `frontdesk.read` | Sí (asignar a un rol o a una key) |
| Ítem de menú `atencion` (`/tablero/atencion`, estaba oculto) | existía | ya no existe | — |

Qué hacer en `cmr-fe`:

1. **Obligatorio**: `components/frontdesk/frontdesk-board.tsx` busca la pestaña con
   `tb.boardSlug === "atencion"`. Tras el despliegue llega `frontdesk_consultation` y, sin cambio, **la
   pestaña Consulta desaparece**. Comparar con las dos claves (o, mejor, con `tb.clave === "consulta"`,
   que no cambia). Igual en cualquier otro sitio que compare un `boardSlug`/`tablero` devuelto.
2. Recomendado (no rompe hoy): las llamadas que mandan `"atencion"` —`GenericBoard tablero="atencion"`
   (`frontdesk-board.tsx`, `patient-desk.tsx`, `consultation-rows.tsx`), `getColumnOptions("atencion", …)`,
   `{ boardSlug: "atencion", … }` en `patient-detail.tsx`, `getDefinicion("atencion", …)` en
   `app/(app)/configuration/staff/page.tsx`— pasan a `frontdesk_consultation`. El BE acepta las dos.
3. Canal: `components/citas/cita-form-sheet.tsx` (`CANALES`, valor inicial) y `components/agenda/cita-modal.tsx`
   (`canal?: "atencion" | "callcenter"`) pasan a `frontdesk`. Donde se pinte o compare el canal de una cita
   (badge «call center» vs «app», informes por canal), tratar `frontdesk` y `atencion` igual.
4. `lib/api/frontdesk.ts` (`boardSlug: "servicios" | "atencion"`), `lib/api/schema.d.ts` (regenerar).
5. Sin cambio: la pestaña sigue saliendo solo si el centro tiene «Mostrar Consulta en Frontdesk»; el
   `labelKey` del tablero sigue siendo `nav.atencion`; el grupo de columnas `flujo_atencion` no cambia.

Este cambio del FE tiene que estar en producción **antes** de la noche en que se mezcle #557.

## 5. Estado en `cmr-fe` (13-nov-2026, rama `feat/access-control-cleanup`)

Un único PR con todo lo que el FE necesita **antes** de la noche de #557. Funciona igual contra el BE de
hoy y contra el de después: compara con los nombres viejos y los nuevos, y **envía los viejos**, que el BE
acepta antes y después.

| Handoff | Qué se hizo | Dónde |
|---|---|---|
| §3 claves de rol | `roleKey`/`hasRole` con el mapa viejo → nuevo; toda comparación de rol pasa por ahí | `lib/access/role-keys.ts` (+ test) |
| §1 `isAdmin` | `isAdmin(me)`: usa `isAdmin` si el BE lo manda; si no, master / modo admin / rol admin | `lib/access/role-keys.ts`, `hooks/use-me.ts`, `lib/centros-scope.ts`, calendario, auditoría |
| §4 pestaña Consulta | se busca con `isConsultationBoard` (`atencion` o `frontdesk_consultation`): **no desaparece** | `lib/frontdesk/consultation-board.ts` (+ test), `frontdesk-board.tsx`, `use-patient-day.ts` |
| §4 llamadas al tablero | una sola constante `CONSULTATION_BOARD` (`"atencion"`) en todas las llamadas | patient-desk, consultation-rows, patient-detail, staff-record-sections |
| §4 canal | el canal `frontdesk` se muestra como `atencion` | `frontdeskChannel`, `franja-tipo-section.tsx` |
| §2 rol admin | el rol Administrador se muestra de solo lectura en los tres editores de permisos | `permisos-dialog.tsx`, `rbac-grid.tsx`, `editor-rol.tsx` |
| §2 `'*'` | nunca se ofrece en un selector de permisos | `getPermisos` en `lib/api/rbac.ts` |
| §2 respuestas nuevas | textos es/en para los `labelKey` nuevos y para la confirmación de dar/quitar admin (el 428 ya lo maneja `apiFetch`) | `messages/es.json`, `messages/en.json` |

Corrección al handoff §4.2: mandar ya `frontdesk_consultation` o el canal `frontdesk` **rompería hoy**: el
BE de antes de #557 no conoce esos nombres. Por eso se envían los viejos hasta después de la noche.

No aplica: no hay pantalla de API keys en el FE (columna «Último uso» y filtro de claves de centro, sin
sitio donde ponerlos).

### Después de la noche de #557 (PR pequeño aparte)

1. Enviar los nombres nuevos: `CONSULTATION_BOARD = "frontdesk_consultation"`, `FRONTDESK_CHANNEL =
   "frontdesk"` y la lista `CANALES` de `cita-form-sheet.tsx`; regenerar `lib/api/schema.d.ts` (`npm run gen:api`).
2. Auditoría: quitar el requisito de rol (`AUDIT_ROLE`): tras #557 basta `auditoria.read`.
3. Adjuntos del cuadre: mostrar el botón solo con `can("cash.write")` (el permiso no existe antes de #557).
4. Pantalla «Menú del rol»: ocultarla o avisar de que ya no cambia lo que la gente ve.
5. `isMaster`/`accessMode` → `isAdmin` en `users-list.tsx`, `theme-settings.tsx`, `app-shell.tsx`; quitar el
   selector de «modo de acceso» de invitar/editar perfil (el BE lo ignora).
