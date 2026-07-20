# Spec FE — Cuadre de Caja (CONSULTA / GENERAL, por cajero + consolidado)

> **Fecha:** 2026-07-20 · **Status:** IMPLEMENTADO (FE) · **Repo:** cmr-fe
> Plan de referencia: `.personal/PLAN-CUADRE-CAJA-FE.md`. Dependencia BE (§2 del plan): **ya
> desplegada** — verificado en `cmr-be/src/modules/caja/*` y en el OpenAPI de producción
> (`AbrirCuadreDto.division/usuarioId`, `GET reportes/dia?division&usuarioId`, desglose por cajero).
> Por eso el FE **NO asume** campos: el schema se regeneró (`npm run gen:api`) desde ese BE.

## 1. Objetivo

Interfaz de cuadre/cierre de caja que **no mezcla** facturación de **consulta** (`factura.citaId != null`)
con **general** (`citaId == null`), y que separa el trabajo **por cajero**, con un **consolidado** de
gerencia que une a todos los cajeros de una división sin combinar divisiones.

## 2. Fuente de verdad (BE — verificado, no asumido)

- `GET /api/v1/caja/reportes/dia?fecha=&division=&usuarioId=` →
  `{ fecha, division, usuarioId, ventas, devoluciones, anulaciones, porMetodo: Record<clave,number>,
  porGrupo: Record<clave,number>, porCajero?: [{usuarioId, total}] }`. `porCajero` solo viene si se
  pasa `division`. RBAC: un cajero solo ve el suyo; gerencia (`admin|super_admin|gerente`) ve otros y el
  consolidado (el controller degrada `usuarioId` a `user.id` si no es gerencia).
- `GET /api/v1/caja/denominaciones?monedaId=` → `DenominacionEntity[]` (orden ASC, valor DESC).
- `GET /api/v1/caja/grupos` → `GrupoMetodoPagoEntity[]` (grupos configurables de método de pago).
- `POST /api/v1/caja/cuadres` (`AbrirCuadreDto`: `division` **obligatoria**, `usuarioId?`, `fecha?`,
  `monedaId?`, `pettyDeclarado?`) → `CuadreCajaEntity`. Idempotente: retoma el abierto de esa
  (división × cajero)/día. `usuarioId` omitido = propio; `null` = consolidado (gerencia).
- `GET /api/v1/caja/cuadres/:id` → `CuadreCajaEntity + conteo[]`.
- `POST /api/v1/caja/cuadres/:id/conteo` (`ContarCuadreDto`: `{conteos:[{denominacionId,cantidad}]}`).
- `POST /api/v1/caja/cuadres/:id/cerrar` (`@Permissions('caja.cerrar')`) → snapshot + diferencia.

`diferencia = (efectivoContado − pettyDeclarado) − efectivoEsperado`, con `efectivoEsperado` = Σ de las
formas `esEfectivo` sobre `totalesPorMetodo` (todo lo calcula el BE; el FE **no** recomputa el cierre).

## 3. Estándares aplicados

| Estándar | Cómo se cumple |
|---|---|
| **NUNCA ASUMIR / investigar** | Se leyó el código real de `cmr-be/src/modules/caja` y el OpenAPI de prod; el schema FE se regeneró. |
| **API-First** | Todo I/O por `lib/api/caja.ts` (usa `apiFetch` + X-Tenant-ID). Tipos desde `schema.d.ts`. |
| **NO mezclar** | Toda llamada lleva `division`; tabs Consulta/General independientes; el FE nunca suma entre divisiones. |
| **Configurable / sin hardcode** | Denominaciones, grupos y monedas del BE. Nada de billetes/métodos hardcodeados. |
| **Multi-tenant** | `useCentroGate` fija X-Tenant-ID de la sesión (mismo patrón que facturación). |
| **RBAC** | `useCan('caja.cerrar')` (cosmético) para Cerrar; selector de cajero/consolidado solo si gerencia. |
| **i18n** | Claves en inglés bajo `caja.*` en `messages/{es,en}.json`. Sin texto hardcodeado. |
| **NO DUPLICAR** | Un solo `conteo-denominaciones` reusado por ambas divisiones (parametrizado); util de moneda única. |
| **TDD** | Helpers puros `lib/caja/totales.ts` con `lib/caja/totales.test.ts` (`node --test`, sin deps nuevas). |
| **UI moderna (2026)** | Conteo asistido por denominación (mayor→menor, `cantidad×valor` en vivo) + panel esperado-vs-contado con variación. Fuentes en el plan. |
| **Menú** | `/caja` en `NAV_MANIFEST` → cae en el grupo **"En desarrollo"** (tiene UI). |

## 4. Componentes

- `app/(app)/caja/page.tsx` — server; renderiza `<CuadreCaja/>`.
- `components/caja/cuadre-caja.tsx` — tabs `CONSULTA|GENERAL` + selector de alcance (cajero fijo / gerencia
  elige cajero o "Todos (consolidado)"); orquesta abrir/contar/cerrar por `(division, usuarioId|null)`.
- `components/caja/conteo-denominaciones.tsx` — grilla de denominaciones, total contado en vivo.
- `components/caja/resumen-esperado.tsx` — totales por método, esperado, petty, contado, diferencia; Cerrar.
- `components/caja/desglose-cajeros.tsx` — solo gerencia; tabla por cajero (de `porCajero`).
- `lib/caja/totales.ts` (+ test) — `totalConteo`, `variacion`, `ordenarDenominaciones`, `money`.

## 5. Fuera de alcance

Turnos/gavetas físicas múltiples por centro; hardware contador de billetes; cambios de política fiscal
(`esEfectivo` y catálogos ya son configurables en el BE).
