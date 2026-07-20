# Handoff BE — Endpoint "roster de cajeros" para el Cuadre de Caja

> **Fecha:** 2026-07-20 · **Origen:** FE cmr-fe (Cuadre de Caja) · **Destino:** cmr-be módulo `caja`
> **Status:** SOLICITADO · **Prioridad:** alta (bloquea la selección de cajero para gerencia)
> Sigue los estándares del repo: API-First, Swagger tipado, RBAC, multi-tenant, configurable,
> comentarios en DB/fields, spec→plan→TDD, sin hardcode, sin secretos, NO asumir.

---

## 1. Contexto y problema (verificado en código, no asumido)

La pantalla de cuadre (`/caja/consulta`, `/caja/general`) tiene un selector **"Cajero"**. Hoy el FE
solo puede poblarlo con dos fuentes, y ninguna sirve para el requerimiento:

1. `GET /api/v1/caja/reportes/dia?...&division=` → campo `porCajero: [{usuarioId, nombre, total}]`.
   **Limitación:** `desglosePorCajero()` (en `caja.service.ts`) arma esa lista **solo con quienes
   tuvieron pagos ese día** (`pagosService.listarRangoPorDivision`). En un día sin facturación, o para
   revisar a un cajero que aún no facturó, viene **vacía**.
2. `GET /api/v1/profiles` → `PerfilResponseDto { id, email, nombre, apellido, estado, accessMode,
   isMaster, avatarUrl, createdAt }`. **Limitación:** NO expone el `authUserId`. Su `id` es el
   **perfilId**, y el cuadre usa el **auth user id** (ver §2). Por eso no se puede mapear perfil →
   cajero del cuadre.

**Requerimiento del negocio:** Administradores, Supervisores, Gerentes y Sub-gerentes deben poder
**seleccionar y revisar el cuadre de CUALQUIER cajero** (no solo de quienes facturaron ese día). Un
cajero normal solo puede verse a sí mismo.

---

## 2. Dato crítico: qué `usuarioId` esperamos (para no romper el enlace)

El identificador de cajero en TODO el módulo caja es el **auth user id** (`RequestContext.id`), NO el
perfilId ni el personalId. Evidencia en el código actual del BE:

- `caja.controller.ts` → `abrir()` sella `actorId: user.id` (auth id).
- `AbrirCuadreDto.usuarioId` y `cuadres_caja.usuarioId` usan ese mismo id.
- `pagos.usuarioId` = `actorId ?? user.id` (auth id) → es lo que agrupa `desglosePorCajero`.
- `desglosePorCajero()` ya resuelve nombres con el helper **`nombresCajeros([...authIds])`**.

⇒ El nuevo endpoint DEBE devolver ese **mismo auth user id** como `usuarioId`, para que el FE lo pase
tal cual a `GET /caja/reportes/dia?usuarioId=`, `GET /caja/cuadres?usuarioId=` y `POST /caja/cuadres`
(`AbrirCuadreDto.usuarioId`). Si devuelven otro id (perfilId/personalId), el enlace se rompe.

---

## 3. Endpoint solicitado (Opción A — preferida)

### Request
```
GET /api/v1/caja/cajeros
Authorization: Bearer <token>
X-Tenant-ID: <clinicId>            // multi-tenant, como el resto del módulo
Query (todos opcionales):
  q?: string                        // filtro por nombre (búsqueda incremental), case-insensitive
  activo?: boolean                  // default true → solo cajeros activos
```

### Response 200 — `application/json`
```jsonc
[
  { "usuarioId": "a1b2c3d4-....", "nombre": "Laesi Martinez Delgado", "activo": true },
  { "usuarioId": "e5f6g7h8-....", "nombre": "Edgardo Rivera",         "activo": true }
]
```

### Contrato de campos (tipar en Swagger — hoy varias respuestas de caja salen `Record<string,never>`)
- `usuarioId: string` — **auth user id** (ver §2). Formato uuid. **Obligatorio.**
- `nombre: string` — nombre completo ya resuelto (`[nombre, apellido].join(' ')`), reusando
  **`nombresCajeros`** (NO duplicar la resolución). Fallback: email si no hay nombre.
- `activo: boolean` — si el usuario/cuenta está activo. Permite ocultar bajas sin borrarlas.

### ¿Quiénes son "cajeros"? (configurable, sin hardcode de logins)
Usuarios con rol de facturación/recepción (los que pueden registrar pagos). Derivarlo de los
**roles/permermisos existentes** (p.ej. roles `recepcion`, `facturacion`, o el permiso que ya usan las
rutas de facturación), NO de una lista fija de logins. Si el negocio prefiere "todos los usuarios del
centro", indíquenlo y lo ajustamos — pero por defecto: quienes pueden facturar.

### RBAC (alcance) — igual criterio que el resto del módulo (`puedeVerOtros`)
- `admin`, `super_admin`, `gerente` (y **sub-gerente** si existe ese rol): devuelve **TODOS** los
  cajeros del centro activo.
- Cualquier otro rol (cajero: `recepcion`/`facturacion`): devuelve **solo su propio** usuario (lista
  de 1 elemento) — así el FE no muestra a otros y el BE no filtra en el cliente.
- Reusar el helper `puedeVerOtros(user)` que ya existe en `caja.controller.ts`.

### Multi-tenant
Acotar por `clinicId` (centro activo, `X-Tenant-ID`), como `listarCuadres`/`totalesPorMetodo`.

### Errores
- 401 sin token. 403 no debería ocurrir (un cajero recibe su lista de 1). 200 con `[]` si no hay
  cajeros en el centro.

---

## 4. Opción B (alternativa, si no quieren endpoint nuevo)

Agregar `authUserId: string` a `PerfilResponseDto` y un filtro por rol en `GET /profiles`
(`?rol=facturacion,recepcion&activo=true`). El FE armaría el roster desde ahí usando `authUserId`
como `usuarioId`. Menos limpio (mezcla auth con perfiles y expone authId en un DTO general), por eso
se prefiere la Opción A.

---

## 5. Cómo lo consumirá el FE (para validar el contrato)

1. Al abrir la pantalla, si el usuario es gerencia → `GET /caja/cajeros` y poblar el selector:
   `"Todos (consolidado)"` + `"Mi caja"` + **cada cajero del roster** (value = `usuarioId`).
2. Al elegir un cajero → `getReporteDia(fecha, division, usuarioId)` + `listarCuadres({fecha,
   division, usuarioId})` para prellenar conteo/inicio; y `POST /caja/cuadres` con ese `usuarioId`
   para abrir/retomar. **Todo usa el `usuarioId` que devuelva este endpoint** (de ahí la criticidad
   de §2).

---

## 6. Criterios de aceptación / TDD sugerido (BE)

1. `GET /caja/cajeros` como **gerente** → lista de todos los cajeros del centro, cada uno con un
   `usuarioId` que **coincide** con el `pago.usuarioId`/`cuadres_caja.usuarioId` de ese usuario.
2. Como **cajero** (`recepcion`) → devuelve **solo** su propio usuario.
3. Multi-tenant: en centro A no aparecen cajeros exclusivos de centro B.
4. `q` filtra por nombre; `activo=false` incluye inactivos.
5. Swagger: respuesta **tipada** (no `Record<string,never>`).
6. El `usuarioId` devuelto, pasado a `POST /caja/cuadres` (`AbrirCuadreDto.usuarioId`) y a
   `GET /caja/reportes/dia?usuarioId=`, abre/lee el cuadre correcto (prueba de integración end-to-end).

---

## 7. Dónde implementarlo (orientación, no imposición)

- `caja.controller.ts`: `@Get('cajeros')` con `@Roles(...)`, reusa `puedeVerOtros(user)`.
- `caja.service.ts`: `listarCajeros({ clinicId, soloUsuarioId?, q?, activo? })`, reusando
  `nombresCajeros` para los nombres y la misma fuente de usuarios/roles que ya alimenta la resolución.
- Migración: probablemente **ninguna** (solo lectura sobre usuarios/roles existentes).

---

## 8. Qué ya hizo el FE (no bloquea, se entrega en paralelo)

- Selector con `"Todos (consolidado)"` + `"Mi caja"` + cajeros con actividad del día (`porCajero`).
  Al llegar `GET /caja/cajeros` se cambia esa fuente por el **roster completo** para gerencia.
- Consolidado = UNIÓN (Σ) del efectivo contado y el fondo de todos los cuadres del día.
- Editar fechas anteriores: bloqueado por defecto, configurable por RBAC (`caja.retroactivo`).
