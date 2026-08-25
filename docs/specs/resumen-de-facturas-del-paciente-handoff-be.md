# FE — Lo que suma el paciente hoy (para no cobrar con calculadora)

Backend hecho, probado y con 20 pruebas. Falta el panel.

## El problema real

La clínica arma las facturas de un paciente **por separado**, como en el legado: una de láser, otra de
suero, otra de productos. Así trabaja y así se queda. Lo que hay que quitar es el último paso: al
cobrar, el usuario **suma los totales con una calculadora**.

Palabras del dueño (24-ago-2026): «si tiene tres, cuatro, cinco facturas, no importa las que tenga,
que le salga el total de cada una de ellas y el total general».

## El endpoint

```
GET /api/v1/facturas/resumen-paciente?pacienteId=<uuid>&desde=&hasta=
```

- `pacienteId` obligatorio. `desde`/`hasta` opcionales en formato `YYYY-MM-DD`; **sin ellas, hoy**,
  que es el caso real: el paciente que está en el mostrador ahora.
- Permiso: `factura.read`, el mismo con el que ya se ve la factura.
- Solo **facturación general** (láser, suero, productos). Las consultas son otro departamento y no
  aparecen, aunque el paciente tenga una el mismo día.

```jsonc
{
  "pacienteId": "…", "desde": "2026-08-24", "hasta": "2026-08-24",
  "facturas": [
    { "id": "…", "referencia": "000282", "estado": "emitida",
      "conceptoLabelKeys": ["grupo.laser"],
      "total": 2640, "devuelto": 0, "neto": 2640, "cobrado": 2640, "pendiente": 0, "cuenta": true },
    { "id": "…", "referencia": "P-000041", "estado": "borrador",
      "conceptoLabelKeys": ["grupo.productos"],
      "total": 220.11, "devuelto": 0, "neto": 220.11, "cobrado": 0, "pendiente": 220.11, "cuenta": true }
  ],
  "totalGeneral": 2860.11, "totalDevuelto": 0,
  "totalCobrado": 2640, "totalPendiente": 220.11,
  "anuladasExcluidas": 0
}
```

## Lo que hay que saber para pintarlo bien

- **`referencia` es un solo campo.** El nº de factura si está emitida; el de presupuesto si es
  borrador; «borrador» si no tiene ninguno. La pantalla no decide nada.
- **`conceptoLabelKeys` son claves de traducción**, no texto: `["grupo.laser","grupo.productos"]` se
  pinta como «Láser, Productos» con el diccionario. Puede venir `factura.sin_lineas` (factura vacía) o
  `factura.sin_grupo`.
- **Lo que suma es `neto`, no `total`.** Devolver no baja el importe de la factura, así que una
  devuelta del todo tiene `total 10603.29` y `neto 0`. Si se pinta `total` en la columna de sumar, el
  pie no cuadrará con las filas. Enseña `total` solo si además enseñas `devuelto`.
- **`cuenta: false`** marca la fila que se ve pero no suma (las anuladas). Píntala apagada o tachada;
  `anuladasExcluidas` dice cuántas hay, y es lo que explica un total que a ojo no cuadra.
- **El pie cuadra con las filas**: `totalPendiente` es la suma de los `pendiente`. Se puede mostrar
  cualquiera de los dos sin que se contradigan, incluso con un sobrepago.

## Errores que hay que tratar

| Situación | Respuesta | Qué enseñar |
|---|---|---|
| Admin sin centro elegido | 400 `RESUMEN_CENTRO_REQUERIDO` | «Elige el centro» — un total que mezcle centros es un cobro equivocado |
| Rango de más de 31 días | 400 `RESUMEN_RANGO_DEMASIADO_AMPLIO` | Manda al listado de facturas, que es el del histórico |
| Fecha mal formada | 400 de validación | El campo, no un error genérico |

Los mensajes traen `labelKey`, así que se traducen como el resto.

## El panel

Un panel **plegable** dentro de la pantalla de factura (`/facturacion/<id>`), cerrado por defecto:
quien no lo necesita no lo ve. Al abrirlo, una fila por factura —referencia, estado, concepto y su
importe— y al pie el total general, lo cobrado y lo pendiente.

Dos detalles que se agradecen en el mostrador:

- **marcar la fila de la factura en la que se está**, para no perderse entre cuatro;
- **poder saltar a otra** desde su fila: el usuario va a querer abrir la de al lado para cobrarla.

Con una sola factura el panel sigue teniendo sentido: ver «total general 220.11» confirma que no hay
nada más pendiente de ese paciente hoy.

## Segunda puerta

Por MCP, la herramienta `resumen_facturas_del_paciente` hace lo mismo con el mismo permiso.
