# Handoff BE — Reabrir: quién la reabrió + huecos de Swagger, y errores nuevos en español en v2

**De:** FE · **Para:** cmr-be · **Fecha:** 2026-10-08 · **Prioridad:** media (el FE ya funciona; esto
completa la pantalla y cumple la regla de todo en inglés).

El FE de Reabrir ya está en producción (commit `1c31980`): botón con `reopen/check`, modal con motivo y
avisos, re-emitir con otra fecha y la tarjeta «Reaperturas» con qué cambió.

## 1. `GET /invoices/:id/reopenings` — `reopenedBy` es un id que el FE no puede convertir en nombre

Verificado en prod (factura de prueba 000399, Bayamón): `reopenedBy: "fcdc1ccc-…"`. Ese id **no está**
en `GET /profiles` (77 perfiles revisados): es el id de usuario, no el de perfil. La tarjeta muestra
cuándo y por qué, pero **no quién**.

**Pedido:** proyectar `reopenedBy` como ya se hace con `issuedBy` / `createdBy` en `GET /invoices/:id`:
`{ id, profileId, name }`. El FE ya acepta las dos formas (string u objeto) y pinta `name` en cuanto
llegue, sin otro cambio.

## 2. Swagger de Reabrir no dice lo que responde

- `InvoiceReopenCheckDto` no declara **`warnings`**, y la respuesta real sí lo trae (`"warnings": []`).
  Además el enum de `InvoiceReopenReasonDto.labelKey` mezcla `cashClosed`, que según el handoff es un
  **aviso**, no una razón. Pedido: `warnings: InvoiceReopenReasonDto[]` en el DTO (o un DTO de aviso aparte).
- `POST /invoices/:id/reopen` declara `201` **sin contenido**; devuelve la factura (forma de
  `GET /invoices/:id`) y `meta.warnings`. Pedido: declararlo.
- `POST /invoices/:id/issue` con fecha fuera de secuencia: el handoff dice que el error trae `from` y
  `to`. El FE los lee de la raíz del error (`error.from`, `error.to`). Confirmar que ahí es donde van.

## 3. Errores nuevos con claves en español, también en `/api/v2`

Copiado de los handoffs que corregiste hoy (verificado por HTTP por el BE):

| Endpoint | Llega | Debería (v2) |
|---|---|---|
| `PUT /print-hubs/:id` | `code: "PRINT_HUB_CONFIGURACION_INVALIDA"`, `fallos: [{ labelKey, campo }]` | `PRINT_HUB_INVALID_CONFIGURATION`, `failures: [{ labelKey, field }]` |
| `book-multiple` | `code: "FRONTDESK_PACIENTE_NO_EXISTE"`, `pacienteId` | `FRONTDESK_PATIENT_NOT_FOUND`, `patientId` |
| `book-multiple` | `code: "FRONTDESK_SERVICIO_NO_EXISTE"`, `servicioIds` | `FRONTDESK_SERVICE_NOT_FOUND`, `serviceIds` |

La regla del proyecto es inglés para todo lo que se publica en v2 (`CLAUDE.md`, «Everything is written
in ENGLISH»). El FE hoy solo usa `labelKey` de esos errores, así que el cambio no rompe nada; cuando
salga, el FE empieza a enseñar **todos** los fallos del hub (`failures`) y **qué servicios** faltan.

## Verificación que pide el FE

Por HTTP real, como siempre: una llamada a cada uno con la respuesta copiada en este documento.
