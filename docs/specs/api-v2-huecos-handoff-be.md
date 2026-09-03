# API v2 — huecos que encontró el frontend al migrar (handoff BE)

El FE migró **todo** a `/api/v2` (inglés). Durante la migración salieron endpoints y campos que
todavía NO tienen versión inglesa. Nada bloquea al FE hoy (se aplicaron los carriles/decisiones de
abajo), pero conviene cerrarlos para retirar los parches temporales.

## 1. Bloqueantes: endpoints SIN v2 (dan 404 bajo `/api/v2`) — el FE los llama por `/api/v1`

Verificado en prod (2026-09-03): responden 200 en v1 y 404 en v2.

- **`/auditoria/*`** (`facetas`, `resumen`, `purgar`, listado). Controlador solo v1. El FE los llama
  con `apiFetchV1` (lib/api/auditoria.ts) y lee los campos en español. → Publicar `/api/v2/audit*`
  (o alias inglés del controlador) y avisar para quitar el carril v1.
- **`/me/centros-donde-puedo`** (getCentrosDondePuedo). Ni la ruta española ni `allowed-centers`
  existen bajo v2 (ambas 404). El FE la llama por `apiFetchV1` (lib/api/centers.ts). Es el selector de
  centro por pantalla (`useCentroPantalla`), se usa en muchas vistas. → Publicar v2 (`allowed-centers`,
  query `permiso`→`permissionSlug`).

## 2. Traducción incompleta que rompería datos bajo v2

- **Alertas `{ data, unread }`**: `data` es bolsa OPACA, así que las alertas de dentro NO se traducen
  (llegan en español) aunque `AlertaEntity` sí esté en inglés. La campana consume campos ingleses. →
  Sacar esa `data` de la opacidad o aplanar la respuesta.
- **festivos `scope`**: el DTO nombra el campo `scope`, pero el middleware v2 traduce la clave entrante
  `scope`→`alcance`, y el DTO ya no la ve (no hay clave que sobreviva). GET funciona; fijar scope global
  al crear, no. → Meter `scope` en `NUNCA_SE_TRADUCEN` o renombrar el campo del DTO a `alcance`.
- **`?limite`** (`pacientes/.../preparacion` usa `@Query('limite')`) y **`?anio`** (holidays): `limit`
  está en `NUNCA_SE_TRADUCEN` (no produce `limite`) y `anio` no está en el mapa → el FE sigue mandando
  `limite`/`anio` en español. Alinear (usar `limit`/`year` en el DTO, o añadir al mapa).

## 3. SSE sin alias inglés (funcionan, pero la ruta queda en español bajo v2)

`@Sse('tablero/stream')` y `@Sse('comunicaciones/alertas/stream')` no declaran `board/stream` /
`communications/alerts/stream`. El FE los llama como `/api/v2/tablero/stream` y
`/api/v2/communications/alertas/stream` (probados 200). Añadir el alias inglés por consistencia.

## 4. Campos que la v2 devuelve en ESPAÑOL (no están en `CAMPOS_EN_INGLES`)

Los subagentes los dejaron en español a propósito (el interceptor los pasa tal cual + warning). Conviene
añadirlos al mapa del BE (`src/core/api-ingles/campos.ts`) para que la v2 sea 100% inglés. Notables por
dominio:

- **facturas/caja**: `sucursal`, `formaPagoNombre`, `emisor`, `esLlave`, `empresa`, `emitidaEn`,
  `componentes`, `neto`, `cobrado`, `devuelto`, `bruto`, `exonerado`, `fondoInicial`, `cajeros`,
  `porMetodo`, `porGrupo`, `porCajero`, `conceptoLabelKeys`, `accionSugerida`, `dentroVentanaAnulacion`.
- **inventario**: `rutas`, `veces`, `estimados`, `avisos`, `consumido`, `remanente`, `porcentajeUsado`,
  `agotado`, `excedido`, `almacenNombre`, `unidadClave`, `bajoMinimo`, `rinde`, `equivalencias`,
  `comprometido`, `dañado`, `disponible`, `existencias`, `poCantidades`, `promedio`, `pedir`,
  `productoNombre`, `criterio1`, `criterio2`, `politicaRemanente`.
- **citas/agenda/frontdesk**: `notasDia`, `franjas`, `tipoClave`, `tipoNombre`, `cupo`, `vacios`,
  `totalCitas`, `atendidas`, `noShow`, `servicioNombre`, `productoNombre`, `staffNombre`,
  `personalNombre`, `actorNombre`, `sesionNumero`, `areas`, `paqueteOrigenIds`, `multiplicadores`.
- **estadísticas/paneles**: `porServicio`, `participaciones`, `posicion`, `porcentaje`,
  `serviciosActivos`, `porTerapia`, `insumo`, `megagrupoClave`, `cuadra`, `seccion`, `pacienteNombre`,
  `estatus`, `contadores`, `ordenes`, `miEstado`.
- **auth/me**: `idiomasDisponibles` (queda en español bajo v2; el resto de /auth/me ya en inglés).
- **staff**: `centroIds` (body de asignar centros), `rolClave`, `tipoAsignacion` (InvitePayload).

## Lo que YA quedó bien (para tu tranquilidad)

`/api/v2/menu` y `/me/menu` devuelven `slug`/`permissionSlug`/`parentSlug` (la barra funciona);
`/invoices`, `/patients`, `/inventory/*`, `/appointments`, `/board/*`, `/cash/*`, `/statistics/*`,
`/holidays` responden 200 con campos en inglés; los SSE abren; los cuerpos POST/PUT y query params van
en inglés. tsc/lint/tests/build del FE en verde.
