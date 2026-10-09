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
- Impresora: la **de la mesa de pruebas** — Epson TM-T20II en la Mac `192.130.80.199`, cola
  `EPSON_TM_T20II`, por IPP. Verificado: ticket impreso desde el servidor.
- **Próximo cambio:** la caja `192.130.80.100` (Windows), impresora compartida como
  `EPSON TM-T20II Receipt5` (foto en `.personal/PHOTO-2026-10-09-10-30-49.jpg`).
  **Lista para usarse (9-oct, verificado con ticket impreso por el servicio):** la caja tiene el
  usuario local `cmrprint` y su credencial está en el servidor
  (`C:\ProgramData\cmr-print-hub\smb-credentials\192.130.80.100`). Para cambiar a ella: en la app,
  impresora = `192.130.80.100`, **Detectar**, cola `EPSON TM-T20II Receipt5`. Cada caja Windows nueva
  necesita lo mismo: runbook §3.1.

## Lo de todos los días

- **¿Está vivo?** `https://<IP del servidor>:8943/health`.
- **Navegador nuevo:** abrir una vez `https://<IP del servidor>:8943/` y aceptar el certificado.
- **Actualizar el hub:** runbook §6 (`scripts/upgrade-windows.ps1`).
