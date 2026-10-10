# Handoff BE — falta el reporte "LASER INTRAVENOSO" solo en Sueroterapia Vit C

## Contexto

Mismo pedido de homologación que `laser-hilt-mls-homologacion-handoff-be.md`, ahora para
Sueroterapia Vit C. El modal legacy de esa terapia ofrece 3 reportes:
**VITAMINA C**, **VITAMINA C - LASER INTRAVENOSO**, y **LASER INTRAVENOSO** (solo). Referencias en
`.personal/formatos-legacy/`: `Sueroterapia Vit C.pdf`, `Sueroterapia Vit C con Laser
Intravenoso.pdf`, `Laser Intravenoso.pdf`.

## Verificado en vivo (prod, servicio `vitc`)

`servicio.formActions.reports` hoy solo tiene **2** entradas: `terapia_vitamina_c` y
`terapia_vitamina_c_laser_iv`. Falta la tercera (Láser Intravenoso solo).

Los dos existentes SÍ están bien armados — comparados campo por campo contra sus PDF de
referencia:

- `GET /formats/terapia_vitamina_c/assembly` → `layout:"campos"`, campos FECHA/NOMBRE DEL
  PACIENTE/RECORD #/SESION #/DOSIS (GM), en ese orden exacto. Coincide 100% con `Sueroterapia Vit
  C.pdf`.
- `GET /formats/terapia_vitamina_c_laser_iv/assembly` → columnas FECHA/RED/GREEN/BLUE/YELLOW/
  INFRA/ULTRA, `porPagina:2`, array `sessions`. Coincide con `Sueroterapia Vit C con Laser
  Intravenoso.pdf` — **salvo un bug que ya se arregló del lado FE** (ver abajo).

## Bug ya arreglado del lado FE (mismo patrón que HILT)

`layout` viene como **`"sesiones"`** (español), no `"sessions"` como esperaba el FE
(`formato-generico.tsx`), así que el multipágina-por-sesión **nunca se activaba** — cualquier
formato con `layout:"sessions"` (Vit C+Láser IV incluido) caía al layout de rejilla por defecto en
vez de las 2 sesiones por página de la referencia. Ya se agregó `|| d.layout === "sesiones"` como
fallback defensivo (mismo criterio que `patologia`/`pathology` en el handoff de HILT). El arreglo
real sigue siendo del BE: traducir ese valor igual que ya debería pasar con el resto del contrato.

## El pedido

Agregar un tercer report al `formActions.reports` de `vitc` — mismo patrón que
`terapia_vitamina_c_laser_iv` pero **sin** el campo Dosis Vitamina C, y sin esa columna en el
header (el PDF `Laser Intravenoso.pdf` solo trae NOMBRE DEL PACIENTE + RECORD # arriba, luego
SESION # en su propia línea — no "DOSIS VITAMINA C : ... / SESION # : ..." como el combinado). Clave
sugerida: `laser_intravenoso` (o la que el BE prefiera), `layout` igual al de
`terapia_vitamina_c_laser_iv` (con la traducción corregida esta vez: `"sessions"`), mismas columnas
FECHA/RED/GREEN/BLUE/YELLOW/INFRA/ULTRA, `porPagina:2`.

## No-scope

- `terapia_vitamina_c` y `terapia_vitamina_c_laser_iv` no se tocan — ya están correctos (el layout
  del segundo solo necesita el fix de traducción ya descrito).

## Contexto

Pedido explícito del dueño, 09-oct-2026, mismo lote que el handoff de HILT/MLS — "estos formatos y
todos los formatos van a imprimir dependiendo del número de sesiones [...] si son 2 sesiones solo
imprimirás 2, y así" confirma que el mecanismo esperado es exactamente el `layout:"sessions"` /
`porPagina` que el FE YA soporta (usado hoy por `terapia_vitamina_c_laser_iv`) — no hace falta
nada nuevo del lado FE para esta tercera entrada, solo que el BE la registre.
