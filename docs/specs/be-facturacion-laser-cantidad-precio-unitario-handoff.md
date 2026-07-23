# Handoff BE — Facturación general: línea láser multiplica de más y precio no es unitario

## Síntoma (verificado en prod, factura general, producto TD12)
"Terapia del dolor (12 Sesiones) MLS": al agregar con cantidad 12, áreas 1, días 12 →
la línea queda **cantidad 144** y **total $7,200**, cuando debería ser **12 × precio unitario = $600**.

## Causa raíz (DATOS del BE, no FE) — evidencia
`GET /facturacion/columnas?productoId=<TD12>` devuelve los roles de columna:
- `areas` → **`multiplicador`**
- `dias`  → **`multiplicador`**  ← ESTE es el problema
- `cantidad` → cantidad, `precio` → precio.

Con `dias` como multiplicador, el motor calcula `cantidad efectiva = cantidad × áreas × días =
12 × 1 × 12 = 144`. El dueño es explícito: **la cantidad NO se multiplica por los días** (en láser
sesión = cantidad = días = nº de visitas; los días son informativos, no multiplican).

Además: `GET /precios/catalogo?q=TD12` → **precio 600**, que es el **TOTAL del pack de 12**, no el
**unitario**. El dueño pide **precio UNITARIO por sesión** (en el legacy existe ese unitario; aquí sería
600/12 = **50**), de modo que `total = cantidad(12) × unitario(50) = 600`.

## Lo que el BE debe corregir
1. **`dias` → rol `informativo`** (NO `multiplicador`) para los productos de láser/packs (TD*). Así la
   cantidad efectiva deja de multiplicarse por los días. (Se muestra "12 Días" como dato, no multiplica.)
2. **Precio UNITARIO por sesión** en el catálogo/lista de esos packs (tomar el unitario del legacy). El
   `precioUnitario` que expone `/precios/catalogo` y `/facturas/catalogo` debe ser POR SESIÓN, no el total
   del pack. El total de la línea lo sigue calculando el BE = `cantidad × precioUnitario`.
3. **Confirmar el rol de `areas`**: el dueño solo objetó los días. Si "áreas" debe multiplicar el cargo
   (más áreas = más costo) déjalo `multiplicador`; si es informativo, cámbialo también. Necesitamos tu
   confirmación del modelo de cobro por áreas.

## FE — sin cambios pendientes (ya correcto)
El FE ya: prefija `cantidad = diasTratamiento` (TD12→12), captura áreas/días, y muestra el total que
proyecta el BE. En cuanto (1) y (2) estén en los datos del BE, la línea queda 12 × 50 = $600 sin tocar FE.

## Aceptación
- Agregar TD12 → cantidad 12, precio unitario 50, total $600 (no 144 / $7,200).
- TD10 → 10 × unitario; TD06 → 6 × unitario; etc. (proporcional al nº de sesiones del pack).
