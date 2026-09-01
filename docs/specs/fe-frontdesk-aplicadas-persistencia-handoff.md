# Handoff FE — "aplicadas" no persiste desde el UI (el BE SÍ persiste — evidencia E2E en prod)

> **Fecha:** 2026-07-23 · **Origen:** BE (E2E verificado en prod) · **Destino:** FE cmr-fe
> **Status:** SOLICITADO · **Prioridad:** alta (bloquea capturar el campo requerido para asistir).

## 1. Evidencia (prod, 2026-07-23 — el BE queda descartado)

Vía la MISMA API que usa el board (`POST /tablero/celda`, tablero `laser`, columna `fd_aplicadas`,
binding `sesion.datos.aplicadas`, editable=true):
```
escribir 5 → 201 OK
GET /frontdesk/tablero (releído) → fd_aplicadas = 5   ← PERSISTE y se proyecta
```
(Dato de prueba limpiado después.) `guardarDatos` valida contra `servicio.formAcciones` y emite evento
`datos` append-only — intacto.

## 2. Dónde buscar (FE)

El valor se escribe desde la celda del board y "no persiste" al refrescar. Sospechosos en
`frontdesk-board.tsx` / celda editable:
1. **Respuesta fuera de orden** (patrón ya documentado en be-frontdesk-tecnico-live-vacio-handoff §7):
   un GET en vuelo anterior pisa el valor recién guardado. Aplicar el mismo guard (descartar respuestas
   obsoletas / AbortController antes del refetch).
2. **Estado local/pin optimista** (`pendSelect`/`pinCelda`): si el pin se limpia al refetch sin que el
   fetch traiga aún el valor, o si el input numérico no dispara el `editarCelda` (onBlur vs onChange /
   debounce perdido), el valor "desaparece".
3. Verificar que la celda de medición envía `{tablero, entidadId, columna, valor}` a `/tablero/celda`
   (no a un endpoint viejo) y que el `valor` numérico no viaja como string vacío.

## 3. Criterio de aceptación

Capturar `aplicadas` en una fila de láser → recargar la página → el valor sigue; y el botón ASISTIDO
pasa a habilitado (la validación de requeridos lo usa). Sin reglas nuevas en el cliente.
