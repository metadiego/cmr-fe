# HANDOFF BE — Sembrar `reports`/`additional_actions` en `formAcciones` del servicio láser

> Pequeño gap de DATO (no de código). FE ya listo y desplegado; el botón "Formatos" es data-driven
> y aparece SOLO si el servicio declara acciones. Hoy no aparece porque el dato no está sembrado.

## Verificado en prod (GET /servicios, clave `laser`)
`formAcciones` actual = `{ "campos": [{ "en":"asistido","tipo":"numero","clave":"aplicadas","labelKey":"fd.col.aplicadas","requerido":true }] }`
→ **solo `campos`** (medición). No trae `reports` ni `additional_actions`, así que `serviceHasReports()` da false y el FE no pinta el botón.

## Lo que el FE consume (contrato del handoff be-laser-acciones-formato)
El FE lee `servicio.formAcciones` y espera, ADEMÁS de `campos`:
```jsonc
{
  "campos": [ ... ],                      // se conserva igual (medición)
  "title": "Formatos",                    // opcional (o titleKey)
  "reports": [
    { "id": "hilt", "name": "Terapia HILT", "labelKey": "frontdesk.formatoHiltTitle",
      "editable_fields": [ { "name": "session", "type": "numero" }, { "name": "areas", "type": "numero" } ] },
    { "id": "mls",  "name": "Terapia MLS",  "labelKey": "frontdesk.formatoMlsTitle",
      "editable_fields": [ { "name": "session", "type": "numero" }, { "name": "areas", "type": "numero" } ] }
  ],
  "additional_actions": [
    { "id": "historial", "type": "modal", "target": "historial", "labelKey": "frontdesk.historial" }
  ]
}
```
- `reports[].id` debe ser `hilt` / `mls` (el FE despacha el formato por ese id → GET /laser/formato/{id}).
- `additional_actions` con `target:"historial"` abre el modal de historial (ya existe en el FE).
- Sembrar en Bayamón y Caguas (o global). NO tocar `campos`.

## Resultado esperado
Con eso sembrado, en cada fila de láser del frontdesk aparece "Formatos" (menú ···) → HILT/MLS
(subform Sesión/Áreas → formato imprimible con firma) + "Historial Completo". Todo ya construido en el FE
(commits de esta sesión). El catálogo de parámetros (/laser/parametros) ya alimenta el formato.
