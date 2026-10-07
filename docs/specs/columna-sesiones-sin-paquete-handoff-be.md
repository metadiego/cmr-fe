# Handoff BE — la columna Sesiones no se puede tocar cuando el paciente no tiene paquete

## El hallazgo (verificado en vivo, no supuesto)

Reclamo real de usuarios: en Frontdesk → Servicios, la columna **Sesión** (`fd_sesiones`, el X/Y)
no se puede editar/corregir. Confirmado por qué, en código y en producción real:

```
GET /api/v2/frontdesk/tablero?service=laser → columna fd_sesiones: { "editable": false, ... }
```

`fd_sesiones` viene `editable:false` SIEMPRE (no es una condición de React, es el dato del propio
tablero) — el único camino para tocarla es el diálogo **"Corregir disponibilidad"** (ícono lápiz,
permiso `frontdesk.disponibilidad.editar`), que llama `ajustarDisponibilidad(paqueteId, {totalSessions})`.
Ese diálogo solo aparece **por cada paquete que YA existe** en `disp.paquetes` — si el paciente
**no tiene ningún paquete** (verificado con un caso real, Bayamón/Láser: `packageId: null`,
`consumedPackages: null`), el popover de saldo solo muestra "Sin paquetes pendientes" y **no ofrece
ninguna forma de fijar o corregir un número de sesión**, ni para el lápiz de corrección ni de
ninguna otra manera.

Esto contradice la misma regla que ya aplica a `fd_aplicadas` (que sí funciona, lo verificamos en
vivo hoy: se puede escribir cualquier valor y el BE lo guarda sin bloquear, paquete o no) —
`docs/specs/frontdesk-servicios-disponibilidad.md`/`frontdesk-consumo-por-dosis.md`: "avisar, nunca
bloquear", la realidad clínica manda sobre el inventario.

## El pedido

Que se pueda fijar/corregir un número de sesión en la columna `fd_sesiones` **aunque el paciente no
tenga ningún paquete asignado** — igual que ya funciona para `fd_aplicadas`. No importa el mecanismo
exacto (decisión del BE), pero alguna de estas sirve:

1. `ajustarDisponibilidad` (o un endpoint nuevo equivalente) acepta un `packageId` nulo/ausente y
   CREA el registro necesario en vez de exigir uno existente.
2. `fd_sesiones` pasa a `editable:true` con un binding simple (como ya es `fd_aplicadas`), y el FE
   lo escribe por el camino genérico (`POST /tablero/celda`) sin pasar por el diálogo de corrección.
3. Cualquier otro mecanismo que el BE prefiera — el requisito es el RESULTADO: nunca un "no se puede
   tocar este número" por falta de paquete.

## Dos requisitos explícitos del dueño, agregados 07-oct-2026

- **Configurable POR SERVICIO**, no un interruptor global: cada servicio decide si `fd_sesiones` se
  puede corregir sin paquete (dato en la configuración del servicio, como ya existen otros
  interruptores por servicio — p. ej. `pushesToEhrOnPresente` — mismo patrón, no hardcode).
- **Aplicar TODAS las reglas ya establecidas** para una escritura sin saldo, no solo "dejar pasar":
  - Avisar (ámbar/visible), nunca bloquear.
  - Dejar el registro **en negativo** si corresponde, nunca rechazar la operación.
  - **Log de quién lo hizo y cuándo** (actor + timestamp), igual que ya exige
    `docs/specs/frontdesk-servicios-disponibilidad.md` para una entrega sin saldo.
  - Mismo criterio exacto que ya cumple `fd_aplicadas` hoy — no una versión reducida.

## No-scope

- No se pide cambiar el comportamiento de `fd_aplicadas` (ya funciona bien, verificado hoy en vivo
  sobre un paciente real: cambié 3→5→3 sin ningún bloqueo).
- No se pide tocar el diálogo "Corregir disponibilidad" para los casos donde SÍ hay paquete — ese
  camino ya funciona.

## Contexto

Pedido explícito del dueño, 07-oct-2026, tras reclamos reales de usuarios. Verificado en vivo contra
producción (Bayamón, Láser, paciente real con récord 102822) antes de escribir este handoff.
