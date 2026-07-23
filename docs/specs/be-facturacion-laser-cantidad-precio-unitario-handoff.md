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

---

## RESOLUCIÓN BE (2026-07-23)
1. **`dias` → rol `informativo`** aplicado en prod (dato, grupo láser 916522f2). El multiplicador de más
   quedó eliminado: TD12 ahora calcula `cantidad × unitario`, SIN multiplicar por días. Verificado por API:
   TD12 cantidad 12 → total **$840** (12 × 70), ya no 144 / $7,200. **FE sin cambios.**
2. **Precio unitario:** el catálogo resuelve **$70/sesión** (→ 840), no 600 ni 144×. El handoff estimaba
   $50 (600/12). Es un tema de DATO de precio (lista/tenant), NO de código — confirmar con el dueño/legacy
   cuál es el per-sesión correcto (¿50 o 70?) y ajustar el precio del producto/lista por API. Sin assume.
3. **`areas`:** se dejó como `multiplicador` (con default 1 no altera el total). PENDIENTE confirmación del
   dueño: si más áreas cuesta más → queda multiplicador; si es informativo → se cambia igual que `dias`.

## ⚠️ VERIFICACIÓN FE (2026-07-23, tras PR #158) — el precio SIGUE inconsistente
El handoff #158 dice "catálogo TD12 = 50 por sesión (combo)". **En prod NO es 50:**
- `GET /facturas/catalogo` → TD12 `precio: 600`, `areasDefault: 1`, `diasTratamiento: 12`.
- `GET /precios/catalogo?q=TD12` → 600.
- precio-base del compuesto → 70 (cobro sin precioUnitario = 12 × 70 = 840, según tu resolución).
O sea hay TRES números (600 / 70 / 50) y ninguno es el "50" del handoff. **El FE NO envía precioUnitario**
por ahora para no re-romper (600 × 12 = 7,200 sería el bug original). Necesito que el BE deje UN precio
por-sesión coherente en el catálogo (¿50? ¿70?) — cuando `/facturas/catalogo.precio` sea el por-sesión
correcto, el FE lo manda directo y listo. FE ya cablea `cantidad=diasTratamiento` y `áreas=areasDefault`.

## CERRADO (2026-07-23) — verificado en prod
Precios por sesión cargados (legacy MPrecios codtipre='00', lista Regular, Caguas):
TD01=70, TD03=65, TD05=65, TD06=60, TD09=55, TD10=60, **TD12=50**. `GET /facturas/catalogo` ya
expone el por-sesión. `dias`→informativo. Verificado por API: TD12 cantidad 12 × 50 = **$600** (antes 144/$7,200).
FE: usar el `precio` del catálogo DIRECTO como precioUnitario (ya es por sesión) — NO dividir entre días.
El total lo calcula el BE = cantidad × precioUnitario. PENDIENTE: replicar los mismos precios en Bayamón si se probará allí; `areas` sigue multiplicador (confirmar modelo de cobro por áreas).
