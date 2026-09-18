# Backfill BE — citas de Atención en `programada` → `confirmada`

**Reporte del dueño (18-sep-2026):** las citas futuras que ya existen (dadas desde Atención antes del
fix del FE) están en `programada` y por eso no aparecen en el tablero de Atención. Hay que
actualizarlas a `confirmada`.

## Contexto (regla acordada)

Una cita dada en el módulo de **Atención** (`/boards/atencion`: botón «Add appointment» y el «Nueva
cita» del modal de asistido) es **directa con la persona presente en la clínica** → nace
**`confirmada`**, no `programada`. `programada` es de las citas del **call-center**
(`/scheduling/...`). El FE ya lo corরige de aquí en adelante:

- `components/tablero/nueva-cita-modal.tsx` y `components/tablero/agregar-cita-modal.tsx` ahora mandan
  `status: "confirmada"` siempre (commits `7f8746e` y anteriores).

Faltan las que **ya existían** en `programada`.

## Backfill pedido (competencia BE — dato, no lo hace el FE por bulk)

Poner en `confirmada` las citas que nacieron en Atención y quedaron en `programada`. El origen se
distingue por **`canal`** (verificado en el BE):

- `createCita` hace `canal: dto.canal ?? 'atencion'` (`citas.service.ts:984,1091`) → las de Atención
  quedan `canal = 'atencion'`.
- El call-center crea con `canal = 'callcenter'` (`replicar-jornada-legacy.ts:406`).

**Scope exacto (no tocar el call-center):**

```
UPDATE citas
   SET estado = 'confirmada'
 WHERE estado = 'programada'
   AND canal  = 'atencion'
```

Sugerencia: acotarlo a `fecha >= CURRENT_DATE` (las futuras, que es lo reportado) si se prefiere no
tocar históricos; a criterio del BE. **NO** incluir `canal = 'callcenter'` — esas `programada` son
legítimas (agendadas por teléfono, aún sin confirmar).

Caso concreto reportado: las 3 citas del **2026-10-01** en Caguas (récords que veníamos usando:
VALLES 84687, CONCEPCION, y la de récord 111) son `canal='atencion'` + `programada` → deben quedar
`confirmada` y entonces aparecen en el tablero de Atención del 1-oct.

Hacerlo como migración idempotente o script de datos, como prefiera el BE. El FE no hace este cambio
por bulk (dato = BE; sin seeds/SQL desde el FE).

## Cómo se sabe el origen (canal) — y una salvedad

- **Tablero de Atención** (`nueva-cita-modal.tsx`, `agregar-cita-modal.tsx`): NO mandan `canal` → el BE
  lo deja en `'atencion'` (default de `createCita`). Fiable: lo dado en Atención siempre es `atencion`.
- **Agenda / call-center** (`components/citas/cita-form-sheet.tsx`): tiene un **selector de canal**
  (`channel`) que **por defecto es `'atencion'`** y el usuario puede cambiar a `'callcenter'`.

**Salvedad para el backfill:** si un operador de call-center creó en la agenda y dejó el canal en el
default (`atencion`), esa cita quedaría marcada `canal='atencion'` aunque sea del call-center, y el
backfill la pasaría a `confirmada`. Dos opciones a decidir por el dueño/BE:
1. Aceptarlo (el volumen de esos casos suele ser bajo y una cita del call-center marcada como Atención
   confirmándose no es grave), o
2. Antes del backfill, cambiar el **default del selector en `cita-form-sheet.tsx` a `'callcenter'`**
   (es el formulario del módulo de agenda/call-center) para que `canal` sea 100% fiable de aquí en
   adelante. Ese cambio de default sí es del FE; avisar y lo hago.

## Corrección (verificado): el canal SÍ es fiable entre las dos vías

Aclaración del dueño: «call-center» = módulo `/scheduling/appointments/...`; «atención» =
`/boards/atencion`.

- **Scheduling** crea con `components/agenda/cita-modal.tsx` (`CitaModal`), que manda
  **`channel: "callcenter"`** (línea 188). → esas citas quedan `canal='callcenter'`. Verificado.
- **Atención** crea con `nueva-cita-modal.tsx` / `agregar-cita-modal.tsx`, que NO mandan canal → BE
  default `canal='atencion'`.

La salvedad anterior era por `components/citas/cita-form-sheet.tsx` (selector con default `atencion`),
pero ese componente **no lo importa nadie** (sin uso en ningún flujo vivo), así que no aplica.

**Conclusión:** el backfill `estado='programada' AND canal='atencion' → 'confirmada'` es seguro: NO
toca las del call-center (`canal='callcenter'`). No hace falta cambiar defaults en el FE.
