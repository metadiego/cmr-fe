# HANDOFF BE — Reactivar (uncancel) una sesión CANCELADA: segunda oportunidad

> Competencia BE (motor de tableros / transiciones). Principio del dueño: **nada rígido**; los humanos
> se equivocan (cancelan por error) y el sistema debe permitir **reparar y reasistir**, no dejar un
> callejón sin salida. El FE ya muestra el flujo de una cancelada (sus sellos) — falta la vía de vuelta.

## Qué se necesita
Una **transición data-driven desde `cancelada`** que devuelva la sesión a un estado activo para poder
retomar el flujo (y reasistir si aplica). Como cualquier otra transición del tablero `servicios`:

- `clave`: p. ej. **`reactivar`** (labelKey `servicios.accion.reactivar`).
- `desdeEstados`: `["cancelada"]`.
- `aEstado`: el estado al que vuelve. Propuesta: **`pendiente`** (reinicia el flujo, conserva paciente/
  disponibilidad) — o `presente`/`en_terapia` si el negocio prefiere retomar donde estaba. Decidir el dueño.
- `limpia`: lo que corresponda (p. ej. `fechanul`/motivo de anulación); **NO** borrar el paciente ni el
  paquete/disponibilidad (la idea es recuperar, no perder).
- `permiso`: configurable (p. ej. `frontdesk.reparar` o uno nuevo `frontdesk.reactivar`).
- `confirmar: true` (pregunta antes, es una acción de reparación).
- Aparecer en `GET /tablero/definicion?tablero=servicios` como el resto (el FE la pinta sola, sin código).

## Efecto esperado (FE, ya listo)
El FE renderiza las transiciones del BE de forma genérica. En cuanto `reactivar` exista con
`desdeEstados:["cancelada"]`, la fila cancelada ofrecerá la acción (en el menú/flujo, según `slot`),
la sesión vuelve a estado activo y el usuario puede avanzar/reasistir. Sin hardcode en el FE.

## Nota
Si la cancelación revirtió inventario/paquete (anular factura), definir si `reactivar` re-provisiona o
si solo aplica cuando no hubo reversa de stock. Es decisión de negocio + BE; el FE solo consume el estado
y las transiciones resultantes. Ver `no-rigido-reparable-segunda-oportunidad` (memoria FE).
