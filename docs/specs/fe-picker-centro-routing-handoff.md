# Handoff FE — Fix del picker de centro (routing + saltar si centro asignado)

**Es 100% FE. El BE ya expone todo lo necesario; no requiere cambios.** Dos problemas a resolver:

## Problema 1 — Routing inconsistente ("Facturar aquí" va a veces a la lista, a veces a crear)
El destino debe ser **determinista**: seleccionar un centro → **lista de Facturas de ese centro**
(imagen 2/3), NUNCA directo a "crear factura". Desde la lista, el botón **"Nueva venta"** abre el POS.
- Revisar el `onClick`/`href` de "Facturar aquí": debe navegar SIEMPRE a la ruta de la **lista**
  (`/facturacion/general?centro=<clinicId>` o equivalente), pasando el `clinicId` seleccionado.
- Causa típica del azar: dos handlers/links solapados, o un `router.push` que compite con un `<Link>`.
  Dejar UN solo navegador al destino de lista.
- Al seleccionar centro, **fijar `X-Tenant-ID = clinicId`** para toda la sesión de facturación.

## Problema 2 — Usuarios con centro asignado NO deben ver el picker
Deben entrar **directo** a su centro. El BE ya lo permite:

`GET /api/v1/auth/me` →
```jsonc
{ "isMaster": false, "accessMode": "operativo",
  "allowedClinicIds": ["<id>"],        // centros que puede facturar
  "activeClinicId": "<id|null>", "roles": [...], "permissions": [...] }
```
`GET /api/v1/auth/me/centros` → `[{ id, nombre, ... }]` (los centros del usuario, con nombre).

**Regla FE (data-driven, sin hardcode):**
- `centros.length === 1` → **saltar el picker**: auto-seleccionar ese centro (set `X-Tenant-ID`) y navegar directo a su lista de Facturas.
- `centros.length > 1` (admin/supervisor multi-centro) → **mostrar el picker** (imagen 1).
- `centros.length === 0` → estado vacío ("sin centro asignado, contacta al admin"), no picker.

No decidir por rol hardcodeado; decidir por la **cantidad de centros** que devuelve `me/centros`. Así el
admin con varios ve picker y el usuario de un centro entra directo, sin lógica especial por rol.

## Aceptación
- Usuario de 1 centro: entra directo a la lista de su centro (sin picker).
- Admin multi-centro: ve el picker; "Facturar aquí" SIEMPRE abre la **lista** del centro elegido (no crea).
- "Nueva venta" (en la lista) es el único camino a crear factura.
- El `X-Tenant-ID` queda fijado al centro elegido toda la sesión.
