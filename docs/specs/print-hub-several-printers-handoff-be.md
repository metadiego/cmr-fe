> **RESUELTO por el BE, 9-oct-2026 12:23 AST — en producción (commit `c87fbba`) y verificado por HTTP real (Caguas, v2):**
>
> 1. `GET /print-hubs/{CAG}/printers` → la migración ya dejó **«Principal»** (`smb`, `192.130.80.100`, `445`,
>    `EPSON TM-T20II Receipt5`, `sortOrder 0`). Bayamón: hub `enabled:false` y **sin impresoras** (no tenía cola).
> 2. `POST …/printers` `{name:"Facturación", protocol:"smb", printerHost, printerQueue}` → 200, `printerPort` 445
>    puesto solo, `sortOrder` 1 (al final).
> 3. `GET /me/print-hub` → `printers:[Principal, Facturación]` (solo activas, con `id,name,protocol,printerHost,
>    printerPort,printerQueue`) **y** la raíz de transición = la primera activa.
> 4. Nombre repetido (` facturación `, ignora mayúsculas y espacios) → **400** `PRINT_HUB_INVALID_CONFIGURATION`,
>    `labelKey: printHub.duplicatePrinterName`, `failures` con TODOS (ahí también `invalidQueue`).
> 5. `DELETE …/printers/:id` → `{deleted:true}`; repetido → **404** `PRINT_HUB_PRINTER_NOT_FOUND` /
>    `printHub.printerNotFound`. «Facturación» de prueba **borrada**: falta que el dueño diga su equipo y cola.
> 6. v1: `/impresion-hubs/:centerId/impresoras` responde igual. Swagger con DTOs de respuesta. MCP:
>    `print_hub_printer_list|create|update|delete`.
>
> **Cambios que debes saber:**
> - `PUT /print-hubs/:centerId` con impresora en la raíz escribe la **primera** impresora (o crea «Principal»).
> - `GET /print-hubs/:centerId` trae `printers`. Un centro sin hub → 404 `PRINT_HUB_NOT_CONFIGURED` (antes
>   `PRINT_HUB_NO_CONFIGURADO`); tú miras el 404, no cambia nada.
> - **Seguridad:** todas las rutas del hub y de impresoras (API y MCP) exigen ahora el permiso **en el centro
>   pedido**. Sin él: **403** `FORBIDDEN`, `labelKey: centros.no_autorizado`. `GET /print-hubs?centerIds=` devuelve
>   solo los centros autorizados (403 si ninguno).
> - `labelKey` nuevos para tus textos: `printHub.printerNameRequired`, `printHub.duplicatePrinterName`,
>   `printHub.printerNotFound`.

# Handoff BE — Varias impresoras por centro en el hub de impresión

**De:** FE · **Para:** cmr-be · **Fecha:** 2026-10-09 · **Prioridad:** alta (bloquea el respaldo de
impresión en Facturación de Caguas y en todo Bayamón). **El FE se detiene en esta parte hasta que el BE
lo publique.**

## Por qué

Cada centro tiene **dos** impresoras de recibos (lo dijo el dueño desde el principio: 2 centros, 4
impresoras, 2 compartidas):

- **Recepción / Atención** (frontdesk): dos equipos imprimen en la misma impresora compartida.
  En Caguas ya funciona: caja `192.130.80.100`, `EPSON TM-T20II Receipt5`.
- **Facturación general**: un equipo solo, con su propia impresora.

El hub de la sucursal (servicio en el servidor de cada sucursal, repo `cmr-print-hub`) **ya manda a
cualquier impresora** que el pedido le indique. El límite está en la configuración: hoy
`center_print_hubs` guarda **una sola impresora por centro** (`protocol`, `printerHost`,
`printerPort`, `printerQueue`), así que Facturación no puede tener la suya.

## Lo que se pide

### 1. Modelo

- Los **hubs** siguen siendo del centro (`center_print_hubs`: `enabled`, `hubUrls` ordenadas).
- **Nueva tabla `center_printers`** (con comentarios en tabla y columnas, como siempre):

| columna | tipo | nota |
|---|---|---|
| `id` | uuid | |
| `clinic_id` | uuid | centro dueño (multi-tenant) |
| `name` | text | nombre para mostrar, p. ej. «Recepción», «Facturación». Único por centro. |
| `protocol` | text | `ipp` \| `smb` (mismas reglas que hoy) |
| `printer_host` | text | IP o nombre del equipo que la comparte |
| `printer_port` | int | 631 / 445 por defecto según protocolo |
| `printer_queue` | text | cola CUPS o recurso compartido de Windows (mismas validaciones que hoy) |
| `sort_order` | int | orden en la lista |
| `active` | bool | default `true` |
| `created_at`, `updated_at`, `updated_by` | | |

- **Migración:** la impresora que hoy tiene cada centro pasa a ser su primera fila, con `name`
  «Principal» (el dueño la renombra desde la pantalla). Caguas hoy: `smb`, `192.130.80.100`, `445`,
  `EPSON TM-T20II Receipt5`.

### 2. API (v2 en inglés, v1 en español; Swagger completo con DTO de respuesta)

| | ruta | permiso |
|---|---|---|
| Listar | `GET /print-hubs/:centerId/printers` | `print-hub.read` |
| Crear | `POST /print-hubs/:centerId/printers` body `{ name, protocol, printerHost, printerPort, printerQueue, sortOrder?, active? }` | `print-hub.update` |
| Editar | `PUT /print-hubs/:centerId/printers/:id` (parcial) | `print-hub.update` |
| Borrar | `DELETE /print-hubs/:centerId/printers/:id` | `print-hub.delete` |

- `GET /print-hubs/:centerId` añade **`printers: [...]`** (ordenadas por `sortOrder`).
- **`GET /me/print-hub`** (el que usa el botón de imprimir, sin permiso de administración, por
  `X-Tenant-ID`) devuelve:

  ```json
  { "enabled": true,
    "hubUrls": ["https://192.130.80.2:8943/print-raw", "https://192.130.80.172:8943/print-raw"],
    "printers": [
      { "id": "…", "name": "Recepción", "protocol": "smb", "printerHost": "192.130.80.100",
        "printerPort": 445, "printerQueue": "EPSON TM-T20II Receipt5" },
      { "id": "…", "name": "Facturación", "protocol": "smb", "printerHost": "192.130.80.x",
        "printerPort": 445, "printerQueue": "…" } ] }
  ```

  Solo las `active`. **Durante la transición**, mantener además `protocol`, `printerHost`,
  `printerPort`, `printerQueue` en la raíz con los de la **primera** impresora, para que el FE
  desplegado hoy siga imprimiendo hasta que salga el nuevo. Se quitan cuando el FE lo diga.
- `PUT /print-hubs/:centerId` sigue aceptando los campos de impresora en la raíz durante la
  transición (escriben la primera impresora); lo nuevo es el CRUD de `/printers`.

### 3. Validación (mismo patrón: `labelKey` = el primero, `failures` = todos, en inglés)

Las de hoy (`printHub.invalidProtocol`, `invalidPort`, `invalidQueue`, …) aplican a cada impresora.
Nuevas: `printHub.printerNameRequired`, `printHub.duplicatePrinterName`, `printHub.printerNotFound`.

### 4. MCP

`print_hub_printer_list`, `print_hub_printer_create`, `print_hub_printer_update`,
`print_hub_printer_delete` (mismos permisos).

## Lo que hará el FE cuando esté (para que se entienda el contrato)

- **Configuración → Apariencia corporativa → Hub de impresión:** los hubs del centro como hoy, y debajo
  la **lista de impresoras** (añadir, renombrar, ordenar, quitar), cada una con su **Detectar**, su
  usuario de impresión de la caja (credencial guardada solo en el hub) y su **Imprimir prueba**.
- **Cada equipo elige su impresora una vez:** en el modal del recibo, «Imprime en: Facturación ▾». La
  elección se recuerda **en ese navegador** (es preferencia del equipo, no del usuario: la cajera de
  Recepción que cubre Facturación imprime donde está sentada). Si el centro tiene una sola impresora no
  se pregunta nada.
- El hub no cambia: cada pedido ya lleva su destino.

## Verificación que pide el FE

Por HTTP real, copiado aquí: crear «Facturación» en Caguas, listarla, `GET /me/print-hub` con las dos,
un nombre repetido (400 con `failures`), y borrarla (o dejarla si el dueño ya sabe qué equipo es).
