# Hub de impresión — acceso rápido

Ficha corta para ubicarse en un minuto. El detalle está en el runbook del hub:
**`../cmr-print-hub/docs/runbook-servidores-windows.md`** (repo `larciles/cmr-print-hub`, privado).

## Dónde está cada cosa (9-oct-2026)

| | |
|---|---|
| Código del hub | `htdocs/cmr-print-hub` (Go) · GitHub `larciles/cmr-print-hub` |
| Hub de **Caguas** | servidor `192.130.80.2` · servicio Windows `cmr-print-hub` · `https://192.130.80.2:8943/` |
| Hub de **Bayamón** | servidor `192.130.74.115` · servicio Windows `cmr-print-hub` · `https://192.130.74.115:8943/` |
| Hub de emergencia | `dev-server 192.130.80.172:8943` (el viejo en Python, systemd) |
| Datos del hub en cada servidor | `C:\ProgramData\cmr-print-hub\` (`config.json`, certificado, `hub.log`) |
| Configuración por centro | App → Configuración → Apariencia corporativa → Hub de impresión (API `/api/v2/print-hubs/:centerId`) |
| Por qué y qué se descartó | `docs/specs/print-hub-local-agent-spec.md`, `docs/specs/recibo-termico-causa-raiz-y-arreglo.md` |
| Credenciales de los servidores | las tiene el dueño (no se escriben en el repo) |

## Cómo está Caguas ahora

- Hubs: `https://192.130.80.2:8943/print-raw` y, de emergencia, `https://192.130.80.172:8943/print-raw`.
- Impresora (desde el 9-oct 11:44, puesta por el dueño desde la app): la **caja `192.130.80.100`**
  (Windows), por SMB, recurso `EPSON TM-T20II Receipt5`, usuario de impresión `cmrprint` guardado en
  el hub desde la app. Verificado en el registro del hub: login guardado 11:42 y un recibo de
  7592 bytes enviado a la caja 11:49.
- Desde el 9-oct el centro tiene **varias impresoras** (Configuración → Apariencia corporativa →
  «Impresoras de este centro»); cada equipo elige la suya en el recibo («Imprime en»).
  Caguas: **«Principal»** = caja `.100`; **«lab-test»** = Epson de la Mac de pruebas `.199` (IPP,
  `EPSON_TM_T20II`), solo para pruebas.
- **Pendiente:** la impresora real de **Facturación** de Caguas (crear `cmrprint` en ese equipo,
  compartir la impresora, IP) cuando su usuaria dé una ventana de tiempo.

## Lo de todos los días

- **¿Está vivo?** `https://<IP del servidor>:8943/health`.
- **Navegador nuevo:** abrir una vez `https://<IP del servidor>:8943/` y aceptar el certificado.
- **Actualizar el hub:** runbook §6 (`scripts/upgrade-windows.ps1`).
