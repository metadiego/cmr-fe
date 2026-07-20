# Handoff BE — Roster de cajeros para el selector del Cuadre de Caja

> **Fecha:** 2026-07-20 · **Origen:** FE cmr-fe (Cuadre de Caja) · **Destino:** cmr-be módulo `caja`
> **Status:** SOLICITADO (bloquea la selección de cajero para gerencia).

## Problema

El selector "Cajero" del cuadre necesita el **roster completo de cajeros**, pero hoy el FE solo tiene:
- `reportes/dia.porCajero` → **solo** los que **facturaron ese día** (con `usuarioId` de auth + nombre).
- `GET /profiles` → devuelve `id/email/nombre/apellido/...` pero **NO** el `authUserId`, así que su `id`
  (perfilId) **no** se puede usar como `usuarioId` del cuadre (el pago sella el **auth user id**,
  `RequestContext.id`, no el perfilId).

Resultado: en un día sin facturación (o para revisar a un cajero que aún no facturó) el selector queda
vacío salvo "Todos (consolidado)" y "Mi caja". Administradores/Supervisores/Gerentes/Sub‑gerentes
necesitan ver y revisar el cuadre de **cualquier** cajero, no solo los que ya facturaron.

## Lo que se pide (una de estas dos opciones)

**Opción A (preferida) — endpoint dedicado:**
`GET /api/v1/caja/cajeros` → `Array<{ usuarioId: string; nombre: string; activo?: boolean }>`
- `usuarioId` = **auth user id** (el MISMO que usa `pago.usuarioId` / `cuadres_caja.usuarioId` /
  el `usuarioId` de `AbrirCuadreDto`), para que el FE lo pase tal cual a abrir/reporte.
- `nombre` = nombre completo resuelto (reusar el helper `nombresCajeros` que ya existe en
  `caja.service.ts`).
- Alcance (RBAC): gerencia (`admin/super_admin/gerente` y sub‑gerente si aplica) ve **todos**; un
  cajero ve **solo el suyo** (o 403/lista de 1). `@Roles(...)` como en el resto del módulo.
- Universo: usuarios con rol de facturación/recepción (los que pueden ser cajeros). Configurable, sin
  hardcode de logins.
- Swagger tipado (hoy varias respuestas de caja salen como `Record<string,never>`; tipar esta).

**Opción B — exponer `authUserId` en `GET /profiles`:**
Agregar `authUserId` a `PerfilResponseDto` + un filtro por rol (`?rol=facturacion,recepcion`). El FE
construiría el roster desde ahí. Menos limpio (mezcla auth con perfiles) pero reutiliza un endpoint.

## Qué hace el FE mientras tanto (ya entregado)

- Selector: "Todos (consolidado)" + "Mi caja" (el propio `me.id`) + los cajeros con actividad del día
  (`porCajero`). Con el endpoint anterior, el FE poblará el **roster completo** para gerencia.
- Consolidado = UNIÓN (Σ) del efectivo contado y el fondo de todos los cuadres del día.
- Editar fechas anteriores: bloqueado por defecto, configurable por RBAC (`caja.retroactivo`).
