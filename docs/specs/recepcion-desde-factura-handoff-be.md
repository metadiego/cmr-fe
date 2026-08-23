# FE — Recibir una compra desde el papel del proveedor (foto/pegado + emparejar)

Backend desplegado y probado en producción. Faltan las dos pantallas.

## De qué va

Se le hace una foto (o se pega el texto) de la factura o el packing list del proveedor, el sistema
resuelve las líneas que puede y **una persona empareja el resto**. Nada entra al inventario hasta que
se confirma.

Lo importante: **el emparejamiento se recuerda**. El proveedor llama «BAMBOO DTX LMN-GNG 600» a lo que
nosotros llamamos «BAMBOO DETOX LEMON-GINGER 600G»; la primera compra hay que emparejarla casi entera,
la segunda llega resuelta sola. Eso ahorra el trabajo de verdad, no el OCR.

## Paso 1 — emparejar

```
POST /api/v1/inventario/recepciones/emparejar
{ "proveedorId": "…",              // opcional, pero SIN él no hay alias que recordar
  "lineas": [ { "texto": "BAMBOO DTX LMN-GNG 600", "cantidad": 12, "costoUnitario": 8.75,
                "numeroLote": "L-1", "fechaVencimiento": "2027-06-30" } ] }
```

Respuesta:

```jsonc
{
  "listas": 1, "porRevisar": 2,          // lo primero que se mira al abrir
  "lineas": [{
    "texto": "chtmx300 CHITOMAX 300 CAPS",
    "productoId": "…", "origen": "sku",  // alias | sku | null
    "confirmado": true,                   // true = se puede recibir tal cual
    "sugerencias": [{ "productoId": "…", "nombre": "…", "confianza": 0.67 }],
    "cantidad": 6, "costoUnitario": null, "numeroLote": null, "fechaVencimiento": null
  }]
}
```

- `confirmado: true` → resuelta por el alias del proveedor o porque el SKU venía en el texto.
- `confirmado: false` → **sugerir no es decidir**: la fila necesita que alguien elija. Si
  `sugerencias` viene vacío, no se parecía a nada; mejor eso que un disparate que se acepte sin mirar.
- Lo que el papel no traía viene en `null` para que se teclee.
- No escribe nada.

## Paso 2 — confirmar

```
POST /api/v1/inventario/recepciones/confirmar
{ "almacenId": "…", "proveedorId": "…", "numeroFacturaCompra": "F-118", "notas": "…",
  "lineas": [ { "productoId": "…", "texto": "BAMBOO DTX LMN-GNG 600", "cantidad": 12,
                "costoUnitario": 8.75, "numeroLote": "L-1", "fechaVencimiento": "2027-06-30" } ] }
```

- **Manda el `texto` original en cada línea**: es lo que se aprende como alias de ese proveedor. Sin
  él, la próxima factura vuelve a pedir el mismo trabajo.
- Exige que TODAS las líneas tengan producto; si falta una, responde 400 y no recibe nada.
- Recibe por el mismo camino que la recepción por packing list: una transacción, todo o nada.
- Devuelve `{ documentoId, lineas, aliasAprendidos }`.

Permiso de los dos: `inventario.recibir`.

## Las pantallas

**Paso 1, revisar.** Tabla con una fila por línea del papel. Arriba, el contador: «12 listas, 3 por
revisar». Las que necesitan atención primero — que el usuario no tenga que buscarlas. En cada una,
el texto del proveedor a la izquierda y el selector de producto a la derecha, con las sugerencias ya
puestas y su confianza visible. Cantidad, costo, lote y vencimiento editables en la misma fila.

**Paso 2, confirmar.** La cabecera común (almacén, proveedor, nº de factura, fecha) y el total, con un
solo botón. Al guardar, enseña cuántos alias aprendió: es lo que le dice al usuario que la próxima vez
será más rápido.

## De dónde salen las líneas

El endpoint recibe las líneas **ya extraídas**. Hoy hay dos formas sin depender de nadie: pegar el
texto de la factura, o leerla en el navegador. El OCR con servicio de visión queda detrás de una
interfaz en el backend y se enchufa cuando se decida el proveedor — sin tocar estas pantallas.

## Lo que el backend NO hace, a propósito

- No adivina cantidades ni costos: lo que no venga claro, en blanco.
- No crea productos. Si el papel trae algo que no está en el catálogo, avisa: dar de alta un producto
  es una decisión, no el efecto secundario de una foto.
- No escribe stock sin confirmación humana. Nunca.
