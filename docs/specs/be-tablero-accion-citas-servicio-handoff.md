# Handoff BE — Registrar UNA acción de riel "Citas de servicio" (hooks) en el tablero servicios

> **Fecha:** 2026-07-23 · **Origen:** FE cmr-fe · **Destino:** cmr-be (registro `tableros.acciones`)
> **Status:** SOLICITADO. Es un cambio de DATO (PUT /tableros/:id), sin código.

## Contexto

El dueño rechazó los 4 botones sembrados antes (`volver`, `calendario_paciente`, `calendario_dia`,
`filtrar_paciente`) por saturar el header. Ahora quiere el riel de hooks con **UN solo botón**:
**"Citas de servicio"**, que abre la vista /citas (pestaña Servicios) para consultar/crear, y esa
vista ya trae su botón **Volver** al origen.

## FE — ya implementado (prod)

- Riel de acciones en el toolbar del tablero servicios: **data-driven** (`tableros.acciones`, slot
  `toolbar`, ordenado por `orden`), los botones se deslizan uno al lado del otro (scroll si sobran).
- El FE pinta **solo** las acciones cuyo `handler` sabe ejecutar (`HANDLERS_FE`). Hoy soporta:
  - **`abrir_citas_servicio`** → navega a `/citas?tab=servicios&volver=<ruta actual>`.
- Por eso, mientras el registro tenga los 4 viejos, el riel queda VACÍO (no reaparecen); en cuanto se
  registre la acción de abajo, aparece el único botón. i18n `tb.acc.citas_servicio` = "Citas de servicio".

## Lo que se pide (BE) — editar el registro por DATO

En `tableros.acciones` del board **servicios** (`PUT /tableros/:id`), dejar SOLO:
```jsonc
{
  "clave": "citas_servicio",
  "labelKey": "tb.acc.citas_servicio",
  "icon": "calendar",
  "slot": "toolbar",
  "orden": 0,
  "handler": "abrir_citas_servicio",
  "requierePermiso": "citas.read"   // opcional; RBAC cosmético
}
```
- Quitar (o `visible:false`) las 4 acciones anteriores (`volver`, `calendario_paciente`,
  `calendario_dia`, `filtrar_paciente`) que el dueño rechazó.
- Confirmar que persiste y aparece en `GET /tableros` → registro `servicios.acciones`.

## Aceptación

1. `GET /tableros` → `servicios.acciones` contiene solo `citas_servicio` (handler `abrir_citas_servicio`).
2. En el frontdesk aparece un único botón "Citas de servicio" en el riel; al pulsarlo abre
   /citas?tab=servicios con el botón Volver que regresa al frontdesk.
3. Si más adelante se quiere otro botón, se agrega otra acción con un `handler` que el FE soporte
   (se registra el handler en el FE y el BE lo enchufa por dato).
