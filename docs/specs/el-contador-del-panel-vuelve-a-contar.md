# El contador del panel de enfermería vuelve a contar

**BE:** desplegado y verificado en producción el 1-oct-2026 (commit `466601c`).
**FE:** pendiente — 3 nombres de campo en `lib/api/paneles.ts` y 2 lecturas en componentes.

## Lo que pasaba

El panel marcaba **0** avisos para la enfermera que acababa de aceptar uno. El contador del BE
siempre dijo **1**: lo que fallaba era que `/api/v2` renombraba la **clave de la sección**
(`vitales`) como si fuera un nombre de campo (`vitals`), mientras la sección sigue llamándose
`vitales` en su propia `clave`. La pantalla pide `porSeccion[seccion.clave]`, no encontraba nada, y
`undefined ?? 0` pinta un cero creíble.

Razón completa: `cmr-be/docs/specs/una-bolsa-por-algo-lleva-datos-en-sus-claves.md`.

## Lo que cambia en /api/v2 (v1 no cambia en nada)

| Antes (español, por un hueco del glosario) | Ahora |
|---|---|
| `definicion.contadores` | `definicion.counters` |
| `definicion.estatus` | `definicion.statuses` |
| `contador.porSeccion` | `contador.bySection` |

Y, lo importante: **las claves de `bySection` vuelven a ser la `clave` de la sección**
(`vitales`, `intravenoso`), que es lo que trae `sections[].clave`. Ya emparejan.

Verificado dos veces contra producción, con la respuesta real:

```
GET /api/v2/panels/enfermeria/counters
→ [{"staffId":"0f339904-…","total":1,"bySection":{"vitales":1}}]

GET /api/v2/panels/enfermeria/definition
→ claves: panel, sections, staff, statuses, counters
→ sections[].clave: vitales, intravenoso
→ counters: [{"staffId":"0f339904-…","total":1,"bySection":{"vitales":1}}]
```

## Qué tocar en el FE

1. `lib/api/paneles.ts`
   - `PanelContador`: `porSeccion` → `bySection` (el comentario de encima ya no aplica: ahora el
     nombre del campo SÍ se traduce y sus claves NO; esa es la regla nueva del BE).
   - `PanelDefinicion`: `estatus` → `statuses`, `contadores` → `counters`.
2. `components/paneles/panel-enfermeria.tsx`
   - línea ~120: `def?.contadores` → `def?.counters`.
   - líneas ~162, ~188, ~193: `cont.porSeccion` → `cont.bySection` (la indexación por `s.clave` se
     queda igual — ahora sí casa).
3. `components/paneles/panel-secciones-admin.tsx`
   - línea ~126: `c.porSeccion?.[claveSeccion]` → `c.bySection?.[claveSeccion]`.

Nada más: el resto de la pantalla no cambia.

## Lo que sigue en español y NO es este cambio

`PanelNotificacion` espera `seccion`, `pacienteNombre` y `servicioNombre`, que hoy **el BE no
envía** (ver el handoff `panel-aviso-enriquecido`). Cuando se enriquezcan, saldrán ya en inglés.
