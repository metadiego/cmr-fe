# Handoff BE — Reabrir: quién la reabrió + huecos de Swagger, y errores nuevos en español en v2

**De:** FE · **Para:** cmr-be · **Fecha:** 2026-10-08 · **Prioridad:** el punto 4 es **ALTA** (pantallas
rotas en producción); el resto media.

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

## 4. ALTA — tipos de precio e impuestos no existen en `/api/v2` (404 en producción)

Visto en el navegador real sobre `cmr-fe-gamma` (factura de Bayamón, 8-oct 18:38) y comprobado por HTTP
con el mismo token y `X-Tenant-ID` de Bayamón:

| Ruta | Respuesta |
|---|---|
| `GET /api/v2/prices/types` | **404** `Cannot GET` |
| `GET /api/v2/prices/taxes` | **404** `Cannot GET` |
| `GET /api/v2/precios/tipos`, `/api/v2/precios/impuestos` | 404 |
| `GET /api/v1/precios/tipos`, `/api/v1/precios/impuestos` | **200** |

El Swagger tampoco las publica en v2 (solo `/api/v1/precios/impuestos`). El FE las llama en v2 desde la
pantalla de la factura (listas de precio e impuestos de cada línea), la venta general, Derivar precios
y Listas de precio (`lib/api/precios.ts`: `listTiposPrecio`, `listImpuestos`, `createTipoPrecio`,
`updateTipoPrecio`).

**Pedido:** publicar en v2 `GET/POST /prices/types`, `PUT /prices/types/:id` y `GET /prices/taxes`
(los nombres que el FE ya usa), en inglés como el resto de v2. El FE **no** las mueve al carril v1
(regla 6 de `cmr-fe/CLAUDE.md`: ese carril es solo para `/auditoria/*` y `/me/centros-donde-puedo`);
si preferís otros nombres, decidlo aquí y el FE los cambia el mismo día.

## Verificación que pide el FE

Por HTTP real, como siempre: una llamada a cada uno con la respuesta copiada en este documento.
