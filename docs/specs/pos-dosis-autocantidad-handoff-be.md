# Handoff BE — Autocálculo Dosis→Cantidad en el POS (Facturación General)

**Contexto.** En la grilla de Facturación General, cuando una línea de producto tiene columna **Dosis**,
al escribir la dosis (cápsulas/pastillas por día) el sistema debe pre-llenar la **Cantidad** (potes/frascos/envases)
sugerida, igual que el CMA/CMR viejo. La cantidad queda **editable** (el cajero la puede sobrescribir).

## Fórmula (ya implementada en el FE)

```
cantidadSugerida = Math.ceil( (dosis × diasTratamiento) / capsulasPorUnidad )
```

- `dosis` = cápsulas/pastillas por día (la escribe el cajero; va en `item.meta.dosis`, informativo).
- `capsulasPorUnidad` = cuántas cápsulas/pastillas trae **un envase** (en el legacy: `NTPRODUCTOS.CapsulasXUni`).
- `diasTratamiento` = duración del tratamiento (legacy: constante 30). **Configurable, no hardcodear.**
- `Math.ceil` = no se vende medio pote → redondea hacia arriba.

### Verificado contra el legacy (ANDROGRAPHIS 120 CAPS, capsulasPorUnidad=120, días=30)
| Dosis | ceil(dosis×30/120) | Cantidad |
|------|--------------------|----------|
| 1    | ceil(0.25)         | **1**    |
| 5    | ceil(1.25)         | **2**    |
| 12   | ceil(3.00)         | **3**    |

## Lo que necesito del BE (único bloqueo)

`GET /facturas/catalogo` debe devolver, **por producto**, estos 2 campos (opcionales; `null` = el FE no autocalcula y deja la Cantidad manual, sin romper):

| Campo | Tipo | Origen sugerido | Nota |
|---|---|---|---|
| `capsulasPorUnidad` | `number \| null` | `NTPRODUCTOS.CapsulasXUni` (o mapear desde `producto.contenido` si aplica) | cápsulas/pastillas por envase |
| `diasTratamiento` | `number \| null` | config de facturación (default 30) o atributo por producto | **NO** hardcodear 30 en el server como fuente única |

- El FE ya lee `capsulasPorUnidad` (con alias `unidadesPorEnvase`) y `diasTratamiento` del catálogo; hoy vienen `undefined` → autocálculo inactivo (Cantidad manual). En cuanto el BE los exponga, el autocálculo se enciende solo. **No requiere cambios adicionales en el FE.**
- Comentar los campos en la entidad/DB (norma de comentarios en Fields/DB).

## Fuera de alcance (ya resuelto en el FE)
- El resto de la fila (Precio por lista, Descuento proporcional, **IVU sobre neto por línea**, Subtotal = precio×cant − desc + IVU) ya está y verificado con `scripts/pos-e2e.sh`.
- `dosis` viaja en `item.meta.dosis` (informativo); `cantidad` (envases) es lo que se factura.
