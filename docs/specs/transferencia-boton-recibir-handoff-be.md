# FE — El botón «Aprobar recepción» no hace nada (y dos nombres sin resolver)

Probado el 22-ago con la cuenta de gerente de Caguas, en el detalle de la transferencia
`86c9d93c-7e7b-47cf-a25e-37d3dc86719f`. **El backend recibe bien**: la misma llamada, hecha a mano,
dejó la transferencia en `recibida` y el stock entró en Caguas (4, 3 y 2 unidades). El botón de la
pantalla no.

## 1. El botón no aplica la recepción

Sospecha principal, y es de una sola letra: el desplegable dice «Devolver al origen» y el DTO del
backend espera exactamente

```
politicaRemanente: 'devolver_origen' | 'merma'
```

Con `'devolver'` (o cualquier otro valor) la petición se rechaza con **400**, porque el
`ValidationPipe` global va con `whitelist + forbidNonWhitelisted`: un valor fuera del enum, o un
campo que el DTO no declara, tumban la llamada entera.

El cuerpo que el backend acepta, verificado:

```jsonc
POST /api/v1/inventario/transferencias/:id/recibir
{
  "items": [{ "itemId": "…", "cantidadRecibida": 4 }],   // omitirlo = recepción TOTAL
  "politicaRemanente": "devolver_origen"                  // o "merma"
}
```

Campos permitidos: `actorId` (opcional; el backend usa el usuario de la sesión si no va), `items` y
`politicaRemanente`. Nada más.

**Por favor, enseña el error.** Ahora mismo el botón se pulsa y no pasa nada visible: ni toast, ni
mensaje, ni el detalle del 400. Sea cual sea la causa, el usuario tiene que enterarse de que falló.

## 2. Dos nombres salen como identificadores

En la misma pantalla:

- El título es `ef6f87b0-cfb8-4d33-84c6-9ce51848f8e1 → CMR Caguas`: el centro **origen** sale como
  UUID. El destino sí resuelve.
- Una línea del detalle muestra `8458bf2d-fe51-4cfc-9413-34aa28084a5b` en vez de «YERBA MATE 120
  CAPS». Las otras dos líneas sí traen el nombre.

Si al backend le falta mandar alguno de esos nombres en el detalle de la transferencia, dímelo y lo
añado — pero míralo primero, porque el producto se resuelve en dos de las tres líneas, así que el
dato parece estar.
