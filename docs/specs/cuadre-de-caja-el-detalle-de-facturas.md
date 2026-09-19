# Cuadre de caja: pintar el detalle de facturación (lista de facturas)

**Pedido del dueño (18-sep-2026):** en el cuadre —en pantalla y al imprimir— tiene que verse el
**detalle de la facturación: la lista de las facturas hechas**. Referencia: los cuadres del legado
`cma` (láser, sueros, productos, consultas) siempre listan sus documentos. **No se replican esos
cuatro cuadres**: los nuestros siguen siendo dos, consulta y facturación general.

## El BE ya lo sirve (verificado en producción)

Los dos endpoints del cuadre traen el detalle:

- `GET /api/v1/caja/reportes/dia?fecha=&division=&usuarioId=` (ya lo traía)
- `GET /api/v1/caja/cuadres/:id` — **nuevo**: el cuadre guardado, que es el que se abre y se imprime

Ambos devuelven:

| clave | qué es |
|---|---|
| `documentos` | la **lista de facturas**: `numero`, `paciente`, `record`, `formaPago` (siglas: EF, TJ…), `total`, `estado`, `usuario {id, nombre}` |
| `devolucionesDetalle` | las devoluciones del día |
| `tributario` | las tres partidas para contabilidad |

Ejemplo real (25-ago, consulta, Caguas): `documentos` trae **25** facturas, con su cajero en cada
una (Erikamari Rodriguez, Berkaira Concepcion).

Acotado a la **fecha, la división y el cajero del cuadre**: el cuadre de un cajero enseña lo que
cobró él, el consolidado enseña el día entero de su división. Si un cuadre sale con `documentos: []`
no es un fallo: es que ese cajero no cobró nada ese día (caso comprobado: el cuadre `40d5583c` del
25-ago lo abrió alguien que no cobró; las 25 facturas son de otros dos cajeros).

## Lo que falta (FE)

Pintar `documentos` en la pantalla del cuadre y en la hoja que se imprime, como una tabla:
**Factura · Récord · Paciente · Forma de pago · Total** (y el cajero cuando la vista no está ya
acotada a uno). Debajo, `devolucionesDetalle` si hay, y el bloque `tributario` que ya se imprime.

## Aviso de `/api/v2`

En v2 estas claves **siguen llegando en español**: `documentos`, `devolucionesDetalle`, `tributario`,
`porMetodo`, `porGrupo`, `porCajero`, `pendientes`, `conteoEfectivo`, y `formaPago` dentro de cada
documento (dentro del documento sí van en inglés `number`, `patient`, `medicalRecordNumber`,
`total`, `status`, `user`). Traducirlas toca todos los endpoints que usan esas claves, así que se
hace aparte, con su propio cambio y aviso. Leedlas en español por ahora.
