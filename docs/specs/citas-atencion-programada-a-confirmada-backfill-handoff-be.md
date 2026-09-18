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
