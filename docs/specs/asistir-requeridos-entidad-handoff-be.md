# HANDOFF BE — Requeridos antes de "asistido" que viven en la ENTIDAD (no en el form de acciones)

> Regla del dueño (vitc/sueroterapia y cualquier servicio análogo): antes de `asistido` deben estar
> **dosis, enfermera y sesión** (cantidad opcional). Esos datos YA están en la sesión; falta validarlos
> en la transición contra la ENTIDAD, no contra el form de acciones.

## Qué pasó (verificado en prod)
- Marqué `dosis/enfermera/sesiones` como `requerido` en `servicio.formAcciones.campos` (vitc).
- Al asistir, el BE respondió: `VALIDATION_ERROR · form de acciones inválido: 'dosis' es requerido; 'enfermera' es requerido; 'sesiones' es requerido`.
- Causa: el BE valida `formAcciones.campos` contra el **form de acciones (`sesion.datos[clave]`)**. Pero
  `dosis` vive en `sesion.productoAplicadoId`, `enfermera` en `sesion.enfermeraId`, y `sesion(es)` es la
  disponibilidad/paquete — **ninguno está en `datos`** → el BE los pide en el form y nunca llegan, aunque
  la entidad SÍ los tenga (confirmado: `productoAplicadoId` y `enfermeraId` seteados, `fd_sesiones = 1/1`).
- **Revertí** la config: vitc vuelve a `campos:[{cantidad, requerido:false}]` (asistir desbloqueado).

## Lo que se necesita (BE)
El guard de la transición a `asistido` debe poder exigir campos que viven en la ENTIDAD, no solo en el
form. Opción data-driven (preferida): que un `campo` de `formAcciones.campos` (o una config equivalente)
acepte un **`binding`** y el validador lo resuelva contra la sesión:
```jsonc
{ "en": "asistido", "clave": "dosis",     "requerido": true, "binding": "sesion.productoAplicadoId" }
{ "en": "asistido", "clave": "enfermera", "requerido": true, "binding": "sesion.enfermeraId" }
{ "en": "asistido", "clave": "sesiones",  "requerido": true, "binding": "disponibilidad" }  // pendiente>0
{ "en": "asistido", "clave": "cantidad",  "requerido": false } // sigue siendo del form (datos)
```
- Si hay `binding`, validar contra ese campo de la entidad (o la disponibilidad); si no, contra `datos[clave]` (como hoy).
- Mensaje de error igual de claro (labelKey por campo). Genérico: sirve para cualquier servicio/columna.
- Sin `binding` no debe romperse (compat con la config actual, p. ej. láser `aplicadas` en datos).

## FE (ya listo)
El FE ya valida en la fila de forma genérica: considera lleno un requerido si su valor está en
`datos[clave]` **o** en `fila[fd_<clave>]`/`fila[fd_<clave>__valor]` (selects de entidad: dosis→
productoAplicadoId, enfermera→enfermeraId). Cuando el BE acepte el `binding`, vuelvo a marcar
`dosis/enfermera/sesiones` requeridos en vitc (por API) y queda bloqueado de punta a punta.
