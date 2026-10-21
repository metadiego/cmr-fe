# Webhook del EHR en la pantalla de configuración — handoff BE → FE

**Fecha:** 2026-10-21 · **BE:** `1f54d81`, `f1e241a`, `6f67869` (en producción) · **Spec BE:**
`cmr-be/docs/specs/eventos-del-ehr-webhook.md`

## Qué

El EHR ya nos manda eventos de los movimientos del paciente a **una URL única para los dos
centros**, firmados con un secreto compartido. Ese secreto es configuración: el dueño lo quiere
editable desde la pantalla, no solo por API.

## Lo que hay que añadir en `app/(app)/configuration/ehr-integration/page.tsx`

Una sección **«Eventos del EHR (webhook)»**, por centro, igual que la contraseña del usuario de
servicio:

1. **URL para el EHR**, solo de lectura y con botón «Copiar»:
   `https://api.centrodemedicinaregenerativa.com/api/v1/ehr-integration/events`. Es la misma para los
   dos centros; el centro sale de la llave del paciente (BAY-… / CAG-…).
2. **Secreto compartido**, campo de **solo escritura**, igual que `servicePassword`:
   - La lectura (`GET /api/v2/ehr-integration/config`) **nunca** trae el secreto. Trae
     `webhookSecretSet: true|false` y `webhookPath`. Respuesta real de producción del 20-oct:
     `webhookSecretSet: true`, `webhookPath: "/api/v1/ehr-integration/events/<centro>"`.
   - Para guardarlo: `PUT /api/v2/ehr-integration/config` con `{ "webhookSecret": "…" }`, que
     devuelve la config con `webhookSecretSet: true`. `""` lo borra; sin secreto, el centro no
     acepta eventos.
   - Estado visible: «Configurado ✓» o «Sin configurar». Un botón «Cambiar» abre el campo vacío.
   - Va en **los dos centros**, con el mismo secreto. Ofrecer «aplicar a los dos centros», que son
     dos PUT, uno por `X-Tenant-ID`.
3. **Últimos eventos recibidos** (opcional, recomendado): `GET /api/v2/ehr-integration/events?limit=20`
   (permiso `ehr-integration.read`), con fecha (`receivedAt`), tipo (`eventType`), récord
   (`patientRecord`) y si se ligó al paciente (`patientId`). Sirve para ver que el EHR está mandando.

## Pruebas que pide

- La pantalla nunca muestra el secreto, ni siquiera después de guardarlo.
- Guardar → `webhookSecretSet: true` → se ve «Configurado ✓».
- Copiar la URL copia exactamente la de arriba.
