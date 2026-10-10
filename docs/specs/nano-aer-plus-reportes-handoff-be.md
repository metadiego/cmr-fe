# Handoff BE — registrar los 2 reportes de NANO (servicio `nano`)

## Contexto

Mismo patrón de homologación que `laser-hilt-mls-homologacion-handoff-be.md` y
`laser-intravenoso-reporte-faltante-handoff-be.md`. El dueño agregó 2 PDFs de referencia nuevos a
`.personal/formatos-legacy/`: **Terapia de Nano Aer Plus.pdf** y **Nano + Láser Intravenoso.pdf**
(legacy muestra el modal "Nano Aer Plus" con exactamente esos 2 reportes).

## Verificado en vivo (prod, servicio `nano`)

`GET /servicios?limit=100` (Bayamón y Caguas) → el servicio existe:

- `slug: "nano"`, `name: "NANO"`, `requiresNurse: true`, `requiresTechnician: false` (coincide con
  el PDF: la firma es "ENFERMERO(A)", no hay campo de técnico).
- `formActions.reports: []` — **vacío en ambos centros**. No hace falta nada más del lado BE para
  que el motor funcione: ya está probado con `vitc` (`terapia_vitamina_c_laser_iv`,
  `laser_intravenoso`), solo falta registrar las 2 entradas en `nano`.

## El pedido — 2 reports nuevos en `nano.formActions.reports`

Ambos con `layout: "sesiones"` (el motor genérico `GenericFormatoRender`/`SesionesFormato` ya lo
soporta, sin cambios de FE necesarios).

### 1. "Terapia de Nano Aer Plus" (sin láser)

Referencia: `Terapia de Nano Aer Plus.pdf`. Estructura:

- `fields`: `paciente` (label `"NOMBRE DEL PACIENTE:"`) + `record` (label `"RECORD #:"`) — **sin**
  fecha en la cabecera (el PDF no la trae).
- `columns`: **una sola** — `fecha` (label `"FECHA"`). Nada de RED/GREEN/BLUE/etc.
- `porPagina: 2` (el PDF de referencia trae 2 sesiones por página).
- Clave sugerida: `nano_terapia` (o la que el BE prefiera).

### 2. "Nano + Láser Intravenoso" (combinado)

Referencia: `Nano + Láser Intravenoso.pdf`. Título `"TERAPIA DE NANO AER PLUS · LÁSER
INTRAVENOSO"`. Estructura:

- `fields`: `paciente` + `record` + **un tercer campo `fecha`** (label `"FECHA:"`, la fecha de la
  cita/visita — NO la de cada sesión). Este PDF SÍ trae fecha en la cabecera, a diferencia del
  anterior y a diferencia de `terapia_vitamina_c_laser_iv`/`laser_intravenoso` (que no la traen).
  El FE ya pinta `fields` tal cual venga (ver nota de FE más abajo) — agregar o no ese campo decide
  si aparece, no hace falta avisar al FE.
- `columns`: las mismas 7 que `terapia_vitamina_c_laser_iv`/`laser_intravenoso` — FECHA / RED /
  GREEN / BLUE / YELLOW / INFRA / ULTRA.
- `porPagina: 2`.
- Clave sugerida: `nano_laser_iv`.

## Contrato de `sessions[]` — confirmado, no asumir lo contrario

Verificado en vivo contra `GET /formats/terapia_laser_iv/assembly`: cada entrada de `sessions[]` es
`{ "session": "1/2", "date": "2026-10-09", "notes": ["",""] }` — **en inglés** (`session`/`date`/
`notes`), no `sesion`/`fecha`/`notas`. El FE tuvo un bug real por asumir los nombres en español sin
comprobarlo (ya corregido, commit `5f2b958`); usar los mismos nombres para `nano_terapia` y
`nano_laser_iv`.

**El motor imprime exactamente tantos bloques de sesión como entradas traiga `sessions[]`** — pedido
explícito y repetido del dueño ("recuerda siempre lo de las sesiones, imprimir siempre la
cantidad"). Si el paciente tiene 2 sesiones totales, `sessions` debe traer las 2 (no solo la de
hoy), igual que ya funciona en `terapia_vitamina_c` (12 sesiones del paciente de referencia). Si se
registra con solo la sesión actual, el reporte imprimirá de menos y se verá como un bug de nuevo.

## Nota de FE (ya hecho, no requiere nada del BE)

El header de `layout:"sesiones"` ahora pinta `fields` tal cual lo mande el BE (mismo mecanismo que
`layout:"campos"`), en vez de un campo fijo de paciente/record — así que agregar el tercer campo
`fecha` en `nano_laser_iv` alcanza para que aparezca, sin tocar código de nuevo (commit `92d384a`).

## No-scope

- No se toca nada de `vitc`, `hilt`, `mls` — ya están correctos.
