# HANDOFF BE — Los BORRADORES no aparecen en la lista de facturas: les falta FECHA

**Reportado por el dueño (20-ago):** «las facturas en estado borrador no se ven en la lista». Verificado
por HTTP contra producción. La causa es de datos + filtrado del BE, y la decisión del dueño es clara:
**un borrador debe tener la fecha de CUÁNDO SE HIZO**, para llevar registro y poder rastrearlo en cualquier
momento.

## El detalle exacto de lo que pasa (con evidencia)

La lista de facturas del FE se pinta con `GET /api/v1/facturas/tablero`, y trabaja **por día** (abre
filtrando HOY; el usuario puede cambiar el rango). Ese endpoint filtra por `desde`/`hasta` **sobre la
columna `fecha`**. El problema: **un borrador tiene `fecha: null`** — la `fecha` solo se rellena al
EMITIR. Como `null` no cae en ningún rango, **cualquier filtro de fecha borra los borradores de la lista**.

Medido en producción (Caguas, contexto general), con el mismo token:

```
GET /facturas?estado=borrador                      → 5+ borradores, todos con  fecha = ""  (null)
GET /facturas/tablero  (SIN desde/hasta)           → 11 borradores entre 200 filas   ✅ aparecen
GET /facturas/tablero?desde=2026-08-01&hasta=08-20 → 0 borradores                     ❌ desaparecen
GET /facturas/tablero?estado=borrador&desde&hasta  → 0                                ❌
GET /facturas/tablero?estado=borrador  (sin fechas)→ 35                               ✅
```

O sea: los borradores existen y el tablero sabe pintarlos; se pierden **solo** cuando se aplica el rango
de fechas, porque no tienen `fecha`. La lista abre con el rango en HOY → el usuario nunca los ve.

## Lo que pide el dueño

> El borrador debe tener **la fecha de cuando se hizo** (su creación), para llevar un registro y poder
> rastrearlo en cualquier momento.

El dato **ya existe**: cada factura tiene `createdAt` (fecha de creación). Lo que falta es que esa fecha
cuente para el borrador, en vez de dejar `fecha` en null hasta la emisión.

## Qué se pide del BE (elige la que respete mejor el modelo; documenta en Swagger para `gen:api`)

1. **Preferida — el borrador nace con fecha de creación.** Rellenar `fecha` al CREAR la factura (= día de
   creación), no solo al emitir. Al emitir, si el negocio necesita la fecha de emisión aparte, guárdala en
   su propio campo (`fechaEmision`/`emitidaEn`, que ya existe) y deja `fecha` como la fecha del documento.
   Así el borrador tiene fecha desde el minuto uno y se rastrea por ella.
2. **Alternativa — el tablero usa `createdAt` como fecha efectiva del borrador.** Si `fecha` es null
   (borrador), que `GET /facturas/tablero` filtre y muestre por `createdAt`. Menos invasiva, pero deja el
   `fecha=null` crudo en la entidad; conviene igual exponer la fecha de creación en la fila para mostrarla.

En ambos casos, la **regla de aceptación**: un borrador creado el día X aparece en la lista cuando el
rango incluye X, con su fecha visible en la columna Fecha (no vacía), y se puede rastrear por esa fecha.

## Comprobación (la hará el FE, sin adivinar)

- `GET /facturas/tablero?contexto=general&desde=<hoy>&hasta=<hoy>` con un borrador creado hoy → **la fila
  del borrador aparece**, con `fac_fecha` = su fecha de creación (no vacía).
- Cambiar el rango a días pasados donde hubo borradores → aparecen esos, no los de hoy.
- La `fecha` de emisión de una factura ya emitida NO cambia por esto (si se separó en su propio campo).

## Nota FE

El FE no cambia su lógica: ya pide el tablero con el rango y pinta `fac_fecha`. En cuanto el borrador
traiga fecha (de creación), se verá y se filtrará solo. Si el BE prefiere que el FE haga un arreglo
provisional (consultar los borradores sin fecha aparte y fijarlos arriba), se puede, pero es un parche:
la fuente de verdad debe ser que el borrador tenga su fecha.
