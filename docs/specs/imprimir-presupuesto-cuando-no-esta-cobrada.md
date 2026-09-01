# El papel tiene que decir PRESUPUESTO cuando no está cobrada

> Handoff **BE → FE**. Fecha: 2026-08-20. Estado: el BE ya está construido y probado; falta la pantalla.
> Spec del BE: `cmr-be/docs/specs/sin-cobrar-es-presupuesto.md`.

## La regla del dueño

> «SI NO se ha cancelado con monto o en 0 —es decir que no le hayan dado un descuento de 100%— NO debe
> ni descontar de inventario, ni pasar a emitida, ni generar un correlativo. SOLO QUE SE IMPRIMA COMO
> PRESUPUESTO Y PODRÍA TENER UN NÚMERO CORRELATIVO DE PRESUPUESTO.»

Cancelada = no queda nada por cobrar: pagada del todo (con uno o varios pagos, cualquier forma) **o**
total 0 por cortesía / 100% de descuento. Pagada a medias **no** es cancelada.

## Lo que cambió en el BE (ya desplegado)

1. **La regla ya no es opcional.** `facturacion.exigirCobroAntesDeEmitir` nace **encendida**: un
   borrador con saldo pendiente **no se emite**, ni al pulsar Emitir ni al imprimir. Antes estaba
   apagada porque la pantalla no cobraba borradores; ya lo hace, así que se encendió.
2. **`POST /facturas/:id/imprimir` dice QUÉ documento es.** Campo nuevo `documento`, y el correlativo
   del presupuesto cuando toca:

```jsonc
// borrador con saldo → es un PRESUPUESTO
{ "documento": "presupuesto", "numeroPresupuesto": "P-000042",
  "emitida": false, "motivo": "factura.no_emitida_pendiente_pago",
  "pendiente": 150.00, "factura": { "numero": null, "estado": "borrador", … } }

// borrador saldado (o cortesía a total 0) → FACTURA, y queda emitida
{ "documento": "factura", "emitida": true, "factura": { "numero": "000627", … } }

// ya emitida → reimpresión, no renumera
{ "documento": "factura", "emitida": false, "factura": { … } }
```

El número de presupuesto se asigna la **primera** vez y se **reusa** al reimprimir: pedir el mismo
presupuesto diez veces no consume diez números. Y se **conserva** si el borrador acaba cobrado y
emitido, así que una factura puede traer los dos números.

3. **Series de numeración por API** (para la pantalla de configuración):

| verbo | ruta | qué |
|---|---|---|
| `GET` | `/facturas/series` | series del centro: `default` (facturas), `devolucion`, `presupuesto`, con `prefijo`, `padding` y `proximo` |
| `GET` | `/facturas/series/:serie` | una |
| `PUT` | `/facturas/series/:serie` | cambia `prefijo` y `padding` (admin, super_admin, gerente) |

`proximo` es de solo lectura: moverlo abre huecos o repite un correlativo ya entregado. Escribir exige
centro elegido (`X-Tenant-ID`).

## Lo que hay que construir en el FE

### 1. El documento impreso

Cuando la respuesta traiga `documento: "presupuesto"`:

- **Título: PRESUPUESTO**, no «Factura». Es lo único que impide que el paciente se lleve un papel que
  parece una factura con un número que no es de factura.
- **El número que se imprime es `numeroPresupuesto`**, etiquetado como presupuesto. `factura.numero` es
  `null` y no debe aparecer ningún hueco donde iría.
- **Pie de presupuesto**, no el de factura. Ya está sembrado y es distinto (ver
  `cmr-be/docs/specs/factura-impresion-fe-handoff.md`: el `pieFactura` del MSSQL es justamente el de
  presupuesto; el de factura lleva la política de devoluciones).
- Conviene que el papel diga lo que falta por cobrar (`pendiente`): es una cotización, no un recibo.

Con `documento: "factura"` el papel es el de hoy, sin cambios.

### 2. La pantalla de la factura

- El botón Emitir ya se deshabilita con saldo pendiente y muestra cuánto falta: **eso se queda**.
- El botón de imprimir **no** se bloquea nunca. Pero el texto debería decir la verdad: con saldo
  pendiente, «Imprimir presupuesto»; saldado, «Imprimir factura». Y el aviso posterior igual: hoy un
  toast que diga «factura impresa» sería mentira.
- Tras imprimir un presupuesto, enseñar su número en la pantalla (junto al estado borrador), para que
  el mostrador pueda referirse a él por teléfono.

### 3. La configuración de la numeración

Pantalla de Configuración → una sección de **numeración**: la tabla de series del centro con su prefijo,
su padding y una vista previa del próximo número (`P-000043`). Editable el prefijo y el padding;
`proximo` se muestra y no se toca. Es CRUD de una API que ya existe: no debe quedar solo en el BE.

## Cumple, como todo lo demás

API-First · MCP (las dos capacidades ya están: `list_series_numeracion`,
`actualizar_serie_numeracion`) · Swagger · configurable, sin hardcode · multi-tenant · RBAC ·
comentarios en tabla y campos · spec y plan antes de código · TDD · migración drift-clean · i18n con
`labelKey`, nunca cadenas quemadas · sin secretos · UI para todo CRUD de la API · el endpoint correcto,
no el más cómodo · no duplicar código · nunca asumir: verificar en pantalla con `/qa`.

## Qué es «terminado»

- Un borrador con saldo se imprime y el papel dice PRESUPUESTO con su número; en la pantalla la factura
  sigue en borrador, sin número.
- Se reimprime y sale **el mismo** número de presupuesto.
- Se cobra del todo, se imprime, y sale la FACTURA con su número; el número de presupuesto sigue visible
  en la ficha.
- Una cortesía a total 0 se imprime como factura de un clic.
- La numeración de presupuestos se puede cambiar a `PRE-2026-0001` desde la pantalla de configuración,
  sin desplegar nada.
