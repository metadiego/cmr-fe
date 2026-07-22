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

---

## ✅ ENTREGADO POR EL BE (2026-07-22, PR #142)
1. **Ámbitos corregidos POR API** (local y prod, 16 columnas c/u): `fac_*` → `["facturacion"]`;
   `fd_*` y `med_*` → `["servicios"]`. Las de cita nunca declararon `servicios` (se colaban por el null).
2. **Dedupe**: `fd_enfermera`/`fd_paciente` inactivas (sin uso en composición); quedan `enfermera`/`paciente`.
3. **Regla dura EN CÓDIGO**: `GET /tablero/columnas?tablero=` ahora es ESTRICTO — solo columnas ACTIVAS
   cuyo `ambitos` declara ese tablero (null ya NO es "todos"). El catálogo completo (sin param) intacto.
El editor de servicios queda limpio solo (data-driven), sin tocar FE.

---

## ⚠️ VERIFICACIÓN FE EN PROD (2026-07-22, después del PR #142) — queda un resto
`GET /tablero/columnas?tablero=servicios` (Bayamón) devuelve 19 columnas:
- ✔ Las `fac_*` YA NO aparecen. ✔ Las `med_*` y `fd_dosis` están.
- ⚠️ **`fd_enfermera` y `fd_paciente` SIGUEN apareciendo** — el punto 2 decía que quedaban inactivas y el
  endpoint estricto solo devuelve activas; en prod siguen saliendo (¿la desactivación no corrió en prod, o
  el filtro estricto no excluye inactivas?).
- ⚠️ `acciones`, `canal`, `centro` (binding `cita.*`) siguen listadas para `servicios` — sus ambitos
  declaran `servicios` pero su binding no resuelve para `sesion`. Confirmar si es intencional o quitarles
  el ámbito `servicios`.

---

## ✅ RESUELTO EL RESTO (BE, 2026-07-22 — verificado EN VIVO en prod)
- **fd_enfermera / fd_paciente**: estaban `activo:false` en prod y el endpoint estricto YA las excluye —
  la verificación FE corrió ANTES de que el deploy del PR #142 terminara (timing, no bug). Confirmado en
  vivo: ya NO aparecen.
- **acciones / canal / centro**: sus `ambitos` en prod sí declaraban `servicios` (data vieja) — NO era
  intencional (binding `cita.*` no resuelve para `sesion`). Corregidas POR API → `["atencion","agenda"]`.
- **Resultado en vivo** `GET /tablero/columnas?tablero=servicios` (prod): **14 columnas**, todas de
  servicios: enfermera, paciente, record, telefono, fd_acciones, fd_dosis, fd_estado, fd_sesiones,
  fd_tecnico, med_dosis, med_frecuencia, med_minutos, med_nivel, med_pulsos. Catálogo limpio.
- Regla permanente ya en código (PR #142): estricto + solo activas; toda columna nueva debe declarar
  `ambitos` (fd_dosis/med_* ya los llevan). "De una vez y para siempre": el filtro es del motor, no data-fix.
