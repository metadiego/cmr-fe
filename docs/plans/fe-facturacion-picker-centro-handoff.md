# Handoff FE — Picker de CENTRO antes de facturar (admins)

> **De:** BE (cmr-be). **Para:** cmr-fe. **Fecha:** 2026-07-14. **BE ya listo — NO hay hueco de BE.**
> Empezamos por **Facturación GENERAL**. Cuando funcione, se replica **igual** en **Consultas**.

## El problema que resuelve
La facturación es **multi-tenant**: el finder de paciente, el catálogo y la creación de factura
**filtran por el centro activo** (`X-Tenant-ID`). Un **admin** puede entrar sin un centro fijado
(o con un centro basura tipo "Por desarrollar") → el finder sale **"Sin resultados"** aunque el
paciente exista, porque está en otro centro. (No es un bug del BE: los pacientes viven por centro —
Bayamón ~160k, Caguas ~29k.)

**Fix (FE):** al entrar a facturar, si el principal puede ver varios centros, **exigir elegir el
centro primero** (un picker), y usar ESE centro como `X-Tenant-ID` en TODA la sesión de factura.

## Regla del gate (cuándo se muestra el picker)
1. Al montar la pantalla de **Facturación General** (`/facturacion/general`), leer `GET /auth/me`.
2. Traer los centros elegibles con `GET /auth/me/centros`.
3. Decidir:
   - **1 solo centro** (clínico normal o admin con 1 allowed) → **auto-seleccionar**, NO mostrar picker.
   - **>1 centro** (admin/master) y **sin centro válido activo** → **mostrar picker y BLOQUEAR** el
     finder de paciente hasta que elija.
   - Ya hay un centro válido fijado (uno de los de `me/centros`) → seguir directo.
   - ⚠️ Si el centro activo NO está en `me/centros` (p.ej. "Por desarrollar"), tratarlo como **no
     válido** → mostrar picker.
4. Al elegir un centro en el picker → fijarlo como el `X-Tenant-ID` de la sesión de factura y
   desbloquear el finder. Ofrecer "cambiar centro" (vuelve al picker, reinicia la venta en curso).

## Endpoints (todos ya existen, base `/api/v1`)
| Uso | Endpoint | Notas |
|---|---|---|
| Perfil + flags | `GET /auth/me` | trae `isMaster`, `allowedClinicIds: string[]`, `activeClinicId` |
| Centros del picker | `GET /auth/me/centros` | master → **todos**; si no → solo permitidos; **con `nombre`** |
| Buscar paciente | `GET /facturas/buscar-paciente?q=` | filtra por `X-Tenant-ID`; sin q lista por centro |
| Catálogo | `GET /facturas/catalogo` | precios por `X-Tenant-ID` (por centro) |
| Crear borrador | `POST /facturas` | usa el centro activo; **400** "Selecciona un centro" si no hay |

- `GET /auth/me/centros` devuelve `[{ id, nombre, codigo, activo, ... }]` — arma el picker con
  `id` (value) + `nombre` (label). **No** cruces `allowedClinicIds` contra `/centros` a mano;
  este endpoint ya hace ese join.

## Lo CRÍTICO — mismo `X-Tenant-ID` en toda la sesión
El centro elegido en el picker debe ir en `X-Tenant-ID` en **cada** llamada de la venta:
`buscar-paciente`, `catalogo`, `POST /facturas`, `items`, `emitir`, `pagos`, etc. Si a mitad de flujo
el header cambia (o se pierde), el precio y el paciente saldrían de otro centro. Fijarlo una vez por
sesión de factura (no depender del selector global del header, que el usuario puede mover).

## Garantías del BE (para que confíes)
- El finder **funciona** (probado local): con `X-Tenant-ID` = Caguas devuelve los pacientes; sin el
  centro correcto sale vacío por diseño (aislamiento por centro).
- `POST /facturas` **no** deja crear sin centro: si el admin no fijó centro y no se puede inferir,
  responde **400 `Selecciona un centro`**. El picker evita que se llegue a ese 400.

## Fuera de alcance (por ahora)
- Consultas: **mismo picker**, se hace DESPUÉS de que General funcione (misma regla, mismo
  `GET /auth/me/centros`, mismo bloqueo del finder). No tocar el shortcut "Facturar Consulta" del AP-board.
- El selector de centro global del header se queda como está; el picker es un **gate propio del flujo
  de factura** (no reemplaza al del header).

## UI (ref moderna)
Picker simple centrado antes del finder: título "Selecciona el centro", lista de tarjetas/opciones
(una por centro de `me/centros`), acción continuar. Si hay 1 → saltar. Estilo shadcn/POS coherente
con la pantalla de "Facturación general" ya existente.
