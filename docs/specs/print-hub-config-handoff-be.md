> **RESUELTO por el BE, 8-oct-2026 — en producción y verificado por HTTP real.**
>
> **Rutas** (v1 en español, v2 en inglés, mismo controlador):
> - `GET /api/v2/print-hubs?centerIds=a,b` · `GET|PUT|DELETE /api/v2/print-hubs/:centerId`
>   (v1: `/api/v1/impresion-hubs/...`). Permisos `print-hub.read|update|delete`.
> - `GET /api/v2/me/print-hub` (v1: `/api/v1/me/impresion-hub`) — por `X-Tenant-ID`, **sin**
>   permiso de administración. Centro sin configurar → `enabled: false`, no un error.
>
> **Respuesta REAL de `/api/v2/me/print-hub`, Caguas:**
> `{ "enabled": true, "hubUrls": ["https://192.130.80.172:8943/print-raw"], "protocol": "ipp",
> "printerHost": "192.130.80.199", "printerPort": 631, "printerQueue": "EPSON_TM_T20II" }`
> Bayamón: `enabled: false` (su config estaba a medias: solo el puerto). La fila de admin trae además
> `id`, `clinicId`, `createdAt`, `updatedAt`, `updatedBy`.
>
> **Validación verificada por HTTP** (8-oct 16:51, tras un segundo despliegue: el primero perdía la
> lista por el camino): URL `pepe` + cola `mala;cola` → 400
> `{ code: "PRINT_HUB_CONFIGURACION_INVALIDA", labelKey: "printHub.invalidUrl", fallos: [
> { labelKey: "printHub.invalidUrl", campo: "hubUrls" }, { labelKey: "printHub.invalidQueue", campo: "printerQueue" } ] }`
> — `labelKey` es el primero, `fallos` trae TODOS. La configuración de Caguas no se tocó. Otras claves:
> `printHub.invalidUrl`, `printHub.invalidProtocol`, `printHub.invalidPort`, `printHub.notFound`.
>
> **MCP**: `print_hub_list`, `print_hub_get`, `print_hub_set`, `print_hub_delete`.
>
> **⚠ Ya migrado y la clave `printHub` YA se borró del sobre de preferencias** (Caguas y Bayamón).
> Desde ahora el botón de respaldo del FE en prod **no sale en ningún centro** hasta que leas
> `GET /me/print-hub`. Es el paso que te toca: cambiar la pantalla y el botón a estos endpoints y
> regenerar tipos (`gen:api`).
>
> Razón completa: `cmr-be/docs/specs/el-hub-de-impresion-es-configuracion.md`.

# Handoff BE — Configuración del hub de impresión por centro (API + MCP + Swagger)

**De:** FE · **Para:** cmr-be · **Fecha:** 2026-10-08 · **Estado:** FE detenido en esta parte hasta que
el BE lo publique (el resto ya funciona en prod, ver "Lo que hay hoy").

## Por qué

El respaldo de impresión ESC/POS (botón "Respaldo: imprimir por el hub" en el visor del recibo) ya
funciona de punta a punta y está verificado en papel (8-oct-2026). Su configuración por centro vive
hoy en el **sobre libre de preferencias** (`preferences` capa `centro`, clave `printHub`), que se
eligió para no tocar el BE. Eso incumple los estatutos: no tiene endpoint propio, ni DTO, ni Swagger,
ni herramienta MCP, ni comentarios en DB, ni RBAC propio, ni auditoría. El dueño pidió que **todo sea
vía API, MCP y Swagger, bilingüe, con todas las reglas**, y que se **siga controlando desde la misma
UI** (Configuración → Apariencia corporativa → Por centro → "Hub de respaldo para imprimir").

## Lo que hay hoy (FE, en prod — para que el BE sepa qué reemplaza)

- Forma guardada en `preferences` capa `centro`, clave `printHub`:
  `{ url, protocol: "ipp"|"smb", printerHost, printerPort, printerQueue }`.
- Lectura para la cajera: `GET /me/preferences` con `X-Tenant-ID` del centro de la factura →
  `layers.center.printHub` (no exige permiso de admin).
- Escritura: `PUT /preferences/center/:id` (exige `preferences.update`).
- Centros configurados hoy: **Caguas** (y el laboratorio del dueño). Al migrar, copiar lo que haya.
- El hub en sí (`/opt/cmr-print-hub/hub.py` en dev-server) NO es del BE y no cambia con esto. Contrato
  del hub: `POST /print-raw?protocol=&host=&port=&queue=`, `GET /discover?host=`, `GET /` (salud).

## Lo que se pide

### 1. Tabla `center_print_hubs` (una fila por centro)

Nombres de tabla, columnas y **comentarios en inglés**, comentario en la tabla y en cada columna:

| columna | tipo | comentario sugerido |
|---|---|---|
| `id` | uuid pk | Primary key. |
| `clinic_id` | uuid fk, unique | Center this backup print configuration belongs to (one row per center). |
| `enabled` | boolean default false | Whether the backup print button is offered for this center's invoices. |
| `hub_urls` | text[] not null | Ordered hub endpoints tried in turn (e.g. central hub, then a local hub on the printer's machine). Each `https://host:port/print-raw`. |
| `protocol` | varchar(8) check in ('ipp','smb') | How the hub reaches the printer: `ipp` = CUPS on Linux/macOS, `smb` = printer shared from Windows. |
| `printer_host` | varchar(255) | IP or hostname of the machine the printer is plugged into and shared from. |
| `printer_port` | integer check 1..65535 | Port of that machine's print service (631 for ipp, 445 for smb). |
| `printer_queue` | varchar(127) | CUPS queue name (ipp) or Windows share name (smb). |
| `created_at`, `updated_at`, `updated_by` | estándar | Auditing. |

`hub_urls` es una **lista ordenada** a propósito: ver punto 5 (hub caído).

### 2. Endpoints (`/api/v2`, inglés, con `/api/v1` si es el patrón del módulo)

- `GET /print-hubs?centerIds=a,b` — lista de configuraciones de los centros pedidos (o de todos los
  que el usuario alcanza si se omite). Permiso `print-hub.read`. **Recibe el array de centros como
  parámetro** (estatuto "permisos por centro").
- `GET /print-hubs/:centerId` — una. Permiso `print-hub.read`.
- `PUT /print-hubs/:centerId` — crea o reemplaza (upsert). Permiso `print-hub.update`. Validación:
  URLs `https://` o `http://` bien formadas (al menos una si `enabled`), `protocol` del enum, puerto
  1..65535, `printer_queue` `^[A-Za-z0-9_.$ -]{1,127}$` (la misma regex que usa el hub).
- `DELETE /print-hubs/:centerId` — quita la configuración. Permiso `print-hub.delete`.
- **Lectura para imprimir sin permiso de admin**: `GET /me/print-hub` resuelto por `X-Tenant-ID`
  (el centro de la factura), que devuelve solo lo necesario para imprimir (`enabled`, `hubUrls`,
  `protocol`, `printerHost`, `printerPort`, `printerQueue`) a cualquier usuario con acceso a ese
  centro. Alternativa aceptable: incluirlo en la respuesta de `GET /invoices/:id` como
  `printHub` — lo que el BE prefiera, pero que la cajera NO necesite `print-hub.read`.

### 3. RBAC y menú

- Permisos nuevos en el catálogo: `print-hub.read`, `print-hub.update`, `print-hub.delete`, con su
  descripción bilingüe; asignados a admin/super_admin por defecto.
- No hace falta ítem de menú: se edita dentro de Configuración → Apariencia corporativa (el FE ya
  tiene la pantalla).

### 4. Swagger + MCP + i18n

- DTOs con `@ApiProperty` y **descripciones bilingües** (es/en), ejemplos reales
  (`https://192.130.80.172:8943/print-raw`, `192.130.80.181`, `631`, `TM-T20II-RAW`).
- Herramientas MCP en inglés, siguiendo `src/modules/mcp/tools/ehr-integration.tools.ts` (mismo tipo
  de config por centro): `print_hub_list`, `print_hub_get`, `print_hub_set`, `print_hub_delete`, con
  los mismos permisos que los endpoints y `centerIds` opcional.
- Errores con `labelKey` (p. ej. `printHub.invalidUrl`, `printHub.invalidQueue`,
  `printHub.notFound`) para que el FE los traduzca.
- Auditoría de cada PUT/DELETE en la bitácora como el resto de configuraciones.

### 5. Hub caído → la PC dueña de la impresora sigue imprimiendo (resiliencia)

Pedido del dueño: si el hub central (otro servidor, hoy vía VPN) se cae, la PC que TIENE la
impresora conectada debe poder seguir imprimiendo por USB/ESC-POS. Diseño acordado del lado FE:

- `hub_urls` ordenada: `[hub central, hub local]`. El FE intenta cada una en orden y se queda con la
  primera que responde. Un "hub local" es el mismo programa del hub corriendo en la PC que tiene la
  impresora (`https://localhost:8943/print-raw` desde esa PC); desde las otras PCs esa entrada
  simplemente no responde y se pasa a la siguiente / se informa el error.
- El BE solo tiene que **guardar y devolver la lista en orden**; el intento en cascada es del FE.

### 6. Migración de lo existente

Script/migración que copie `preferences.config.printHub` (capa centro) a `center_print_hubs`
(`url` → `hub_urls[0]`, `enabled = true` si la config está completa) y luego **borre la clave
`printHub` del sobre** (y la vieja `impresionHub` si quedó). Avisar al FE cuando esté en prod: el FE
cambia la pantalla y el botón a los nuevos endpoints en el mismo deploy y regenera tipos (`gen:api`).

## Lo que hace el FE cuando esto esté

- `components/configuracion/print-hub-settings.tsx`: leer/escribir con `GET/PUT /print-hubs/:id`,
  interruptor "Activado", lista ordenada de URLs de hub (añadir/quitar/reordenar), mismo Detectar /
  Comprobar / Imprimir prueba.
- Botón del visor: `GET /me/print-hub` (o `invoice.printHub`); se muestra solo si `enabled` y completo;
  intenta cada `hubUrls` en orden.
- Tipos desde `components["schemas"]` (no a mano).

## Criterio de aceptación (verificable por HTTP)

1. `PUT /print-hubs/<caguas>` con datos válidos → 200 y `GET` devuelve lo mismo.
2. Cola con `;` → 400 `labelKey printHub.invalidQueue`.
3. Usuario sin `print-hub.read` → `GET /print-hubs` 403, pero `GET /me/print-hub` con `X-Tenant-ID`
   de su centro → 200.
4. Herramientas MCP listadas y con los mismos permisos.
5. Swagger muestra los 5 endpoints con descripciones en ambos idiomas.
