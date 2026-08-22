# Handoff BE — nombres resueltos en el detalle de la transferencia

> FE → BE. Fecha: 2026-08-22. Sale de `transferencia-boton-recibir-handoff-be.md` (punto 2, los
> nombres que salían como UUID en la pantalla de recibir).

## Qué se arregló en el FE (ya hecho)
- **Centro ORIGEN** salía como UUID porque `GET /auth/me/centros` (del usuario destino) no incluye el
  centro ajeno. El FE ahora resuelve el nombre uniendo `me/centros` + `GET /inventario/transferencias/
  destinos`. Ya sale bien.
- **Producto** de una línea salía como UUID: el FE lo resolvía contra el catálogo `GET /inventario/
  productos`, que viene **paginado (limit 100)** — si el producto no cae en esa página, no hay nombre.

## Pedido (la fuente correcta)
Que `GET /api/v1/inventario/transferencias/:id` traiga los nombres ya resueltos en el propio detalle,
sin que el FE tenga que cargar catálogos:

```jsonc
{
  "transferencia": {
    "…": "…",
    "clinicOrigenNombre": "CMR Bayamon",   // ← deseable
    "clinicDestinoNombre": "CMR Caguas"     // ← deseable
  },
  "items": [
    { "id":"…", "productoId":"…", "productoNombre":"YERBA MATE 120 CAPS", "cantidad":4, "cantidadRecibida":null }
    //                             ↑ NUEVO: nombre resuelto por línea
  ]
}
```

El FE ya CONSUME `items[].productoNombre` si viene (cae al catálogo y luego al id si no). Con el nombre
por línea dejamos de depender del catálogo paginado y ninguna línea vuelve a salir como UUID. Los
nombres de centro también, para no depender de dos endpoints extra.

## Nota sobre el botón «Aprobar recepción» (punto 1 del handoff original)
Revisado el código actual del FE: el desplegable YA envía el enum correcto
(`politicaRemanente: 'devolver_origen' | 'merma'`), el payload es `{items:[{itemId,cantidadRecibida}],
politicaRemanente}`, y los errores se muestran con toast (`apiErrorMessage`). El botón «Aprobar» se
deshabilita si hay líneas inválidas. Es decir, en esta versión del FE el punto 1 ya está correcto —
si volviera a fallar, sería un caso puntual a reproducir, no el valor del enum.
