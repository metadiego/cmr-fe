# Handoff BE — Historial de cuadres de caja (ver / editar / imprimir / enviar por email)

> **Fecha:** 2026-07-20 · **Origen:** FE cmr-fe (Cuadre de Caja) · **Destino:** cmr-be módulo `caja`
> **Status:** SOLICITADO (bloquea features FE). El FE ya tiene selector de **fecha** y muestra el
> **reporte del día** de cualquier fecha en solo lectura; lo demás depende de estos endpoints.

## Contexto (verificado en prod OpenAPI 2026-07-20)

Hoy `caja` expone: `GET reportes/dia`, catálogos (`denominaciones`, `grupos`), y del cuadre solo
`GET cuadres/:id`, `POST cuadres` (abrir, idempotente sobre `estado='abierto'`),
`POST cuadres/:id/conteo`, `POST cuadres/:id/cerrar`. **No hay** forma de **listar** ni **recuperar
por (fecha × división × cajero)** un cuadre ya **cerrado**, ni de **reabrir**, **imprimir** o
**enviar por email**. Por eso el FE no puede (sin asumir) ofrecer ver/editar/imprimir/enviar cuadres
anteriores: `POST cuadres` para una fecha pasada **crearía uno nuevo abierto** (footgun) porque no
encuentra abierto y no consulta cerrados.

## Endpoints solicitados (con su spec/plan/TDD/migración, estándares del repo)

1. **Listar / recuperar cuadres**
   `GET /api/v1/caja/cuadres?fecha=&division=&usuarioId=&estado=` →
   `CuadreCajaEntity[]` (o `CuadreConItems[]` con `conteo`). RBAC de alcance: cajero solo los
   suyos; gerencia todos + consolidado (`usuarioId=null`). Es lo que habilita **ver** anteriores.
   - Alternativa mínima: `GET /caja/cuadres/por-clave?fecha&division&usuarioId` → 1 cuadre o 404.

2. **Reabrir (editar)** un cuadre cerrado
   `POST /api/v1/caja/cuadres/:id/reabrir` (`@Permissions('caja.reabrir')`), con auditoría
   (quién/cuándo/por qué). Sin esto, "editar anteriores" no es posible (los cerrados son inmutables).

3. **Datos de impresión / recibo del cuadre**
   Que `GET cuadres/:id` (o un `GET cuadres/:id/recibo`) devuelva el bloque imprimible:
   snapshot `totalesPorMetodo`, `efectivoEsperado`, `efectivoContado`, `pettyDeclarado`,
   `diferencia`, `conteo[]` con `valor` de cada denominación, `cerradoEn`, cajero, división, centro.
   El FE arma el print/PDF (patrón `recibo-termico`) una vez tenga estos campos tipados en Swagger.

4. **Enviar por email**
   `POST /api/v1/caja/cuadres/:id/email` `{ to?: string[] }` (usa plantilla/config del centro).
   El envío y las credenciales viven en el BE (sin secretos en el FE).

## Notas de consistencia

- `totalesPorMetodo` y las respuestas de cuadre hoy salen como `Record<string,never>` en Swagger:
  **tiparlas** para que el FE consuma tipos reales (API-First) y no tipe a mano.
- Todo respeta multi-tenant (`clinicId`) y RBAC ya presentes en el controller.

## Qué hace el FE mientras tanto (ya entregado)

- Selector de **fecha** (`max = hoy`) que recarga `reportes/dia`.
- Fecha = hoy → flujo normal (abrir/contar/cerrar).
- Fecha anterior → **reporte del día en solo lectura** (totales por método + desglose por cajero),
  sin botón de abrir, con nota de que ver/editar/imprimir/enviar anteriores requiere este BE.
