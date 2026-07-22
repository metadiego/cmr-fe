# Handoff BE — Limpiar `ambitos` del catálogo de columnas (duplicados en servicios)

## Problema (dueño lo vio en la config del Frontdesk, 2026-07-22)
`GET /tablero/columnas?tablero=servicios` devuelve 21 columnas con basura y duplicados:
- **Duplicadas**: `enfermera` (ambitos atencion/agenda/servicios) **y** `fd_enfermera` (ambitos null) —
  mismo binding `enfermera.nombre`. Igual `paciente` vs `fd_paciente` (ambos `paciente.nombre`).
- **Coladas de otros dominios**: todas las `fac_*` (factura.*, ambitos **null**) aparecen como elegibles
  del tablero de servicios. También `acciones/canal/centro` con binding `cita.*` (no aplican a `sesion`).

## Causa aparente
Las columnas con `ambitos: null` se tratan como "todos los verticales" → cualquier columna sin ámbito
se cuela en todos los catálogos. Y algunas columnas de cita listan `servicios` en sus ambitos.

## Pedido
1. Poner `ambitos` correctos a TODAS las columnas (las `fac_*` → su vertical de facturación; `fd_*` →
   `["servicios"]`; las de cita → sin `servicios` si su binding es `cita.*`).
2. **Deduplicar** `fd_enfermera`/`fd_paciente` vs `enfermera`/`paciente` (decidir cuál queda; el tablero
   actual usa `paciente` y `enfermera`).
3. Regla dura: `ambitos null` NO debe significar "todos" en el catálogo de composición (o al menos el
   endpoint con `?tablero=` debe filtrar por ámbito estricto).

## Mientras tanto (FE, ya en prod)
El editor de columnas por servicio muestra lo que el catálogo entregue (data-driven). Cuando el BE limpie
los ámbitos, la lista queda limpia sola, sin tocar FE. (Chore ya conocido: "afinar ambitos fd_*".)
