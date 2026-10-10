# Handoff FE — El código de alta del EHR se imprime SOLO, por el hub (sin pantalla)

**De:** BE · **Para:** FE · **Fecha:** 2026-10-10 (rehecho a las 15:35) · **Prioridad:** alta (pedido del dueño).
Specs BE: `cmr-be/docs/specs/codigo-de-alta-del-ehr.md` y `cmr-be/docs/specs/cola-de-impresion.md`.

> **Cambio de rumbo (dueño, 15:00):** «EHR devuelve el código, nosotros lo recibimos y lo enviamos al printer
> sin depender del user». La página **NO** imprime el código. Verificado: el VM de producción no alcanza el
> hub (`.2`/`.172:8943` sin conexión), así que **el hub pide** los trabajos al BE.

## Lo que ya está en producción (BE, verificado por HTTP 15:34)

- Al marcar presente a un paciente nuevo en el EHR, el BE usa `POST /patients/onboard` (EHR PR #52) y
  **encola** el ticket del código en la impresora `claimCodePrinterId` del centro.
- **Caguas:** `claimCodePrinterId` = **lab-test** (PUT → 200; una impresora de otro centro → 400).
- **Llave del hub de Caguas:** API key de centro, permiso **`print-hub.process`** (no `print-jobs.process`),
  id `da7041cc-…`, en **`cmr-fe/.personal/print-jobs-key-caguas.txt`** (una línea, ignorado por git).
  Con ella: `GET /print-jobs/next` → **204**; `GET /ehr-integration/config` → **403** (solo sirve para la cola).

## Contrato de la cola (lo que hace el hub)

- `Authorization: Bearer <llave>`; sin `X-Tenant-ID` (la llave fija el centro).
- `GET /api/v2/print-jobs/next` → 204, o 200 `{ id, kind, printer: { protocol, printerHost, printerPort,
  printerQueue }, payloadBase64, expiresAt }`. Queda tomado; sin respuesta en 2 min vuelve a la cola.
- `payloadBase64` = bytes **ESC/POS ya armados** por el BE: decodificar y enviar con el envío de siempre.
- `POST /api/v2/print-jobs/:id/result { ok: true }` o `{ ok: false, error }`. Falla → reintento; al 3.º queda
  `failed`. Impreso o abandonado → el BE borra el contenido.
- `POST /api/v2/print-jobs/test { printerId }` (`print-hub.update`, sesión de admin/gerente) encola un ticket
  de **prueba** en esa impresora: sirve para probar cola → hub → papel sin esperar a un paciente.
- `GET /api/v2/print-jobs` (`print-hub.read`) y MCP `print_jobs_list`: historial, sin contenido.

## Lo que queda del FE

1. Sondeo en `cmr-print-hub` (`config.json`: `printJobsApiKey`, `pollSeconds`), instalar en Caguas `.2`.
2. Probar con `POST /print-jobs/test` en lab-test y avisar al BE con el estado del trabajo (`printed`).
3. El selector `claimCodePrinterId` ya está (FE b3fd0b9). Opcional: un botón «Probar la cola» con el
   endpoint de prueba y la lista de trabajos.
