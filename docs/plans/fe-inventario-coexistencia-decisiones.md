# Plan FE — Coexistencia: nuevo flujo de inventario SIN romper lo vivo

> **Autor:** FE (cmr-fe). **Fecha:** 2026-07-13. **Decisión del dueño (larciles), textual:**
> "convive y dependiendo del flujo eliminamos lo que no nos guste… crear sin eliminar… no quiero
> eliminar lo que tenemos por una promesa que no me imagino cómo es… hazlo todo de modo opcional,
> otra forma de ver y acceder a los datos, Y NO quiero que nada se duplique, debo trabajar con lo que hay."
>
> Responde al plan del BE: `docs/plans/fe-inventario-creacion-ux-handoff.md`.
> **Estado: NO INICIAR** — BE está aplicando correcciones. Antes de construir: dogfood de cada endpoint.

## 0. Principios rectores (no negociables)
1. **Aditivo/opcional:** el flujo nuevo vive en **rutas nuevas**; las actuales **quedan intactas y accesibles**.
2. **Nada se borra ni se edita destructivamente ahora.** Cualquier retiro = PR aparte, tras validar el reemplazo
   en prod y con **aprobación explícita** del dueño.
3. **Cero duplicación de código (NO DUPLICAR):** las vistas nuevas **reusan** los componentes y `lib/api/*`
   existentes. Donde el patrón nuevo comparta UI con uno viejo, se **extrae a un componente compartido** usado por
   ambos — jamás copiar-pegar. (Ver §3 el mapa de reutilización.)
4. Reversible: cada pieza nueva se puede quitar sin tocar las viejas.

## 1. Lo que YA está vivo en prod (se CONSERVA tal cual)
| Ruta | Qué hace | Commit base |
|---|---|---|
| `/inventario/productos` | Hub: lista + buscador + Sheet crear/editar + fila expandible→AMP | 20d7b2f |
| `/inventario/recetas` | Editor BoM standalone (compuestos) | 8a9148b |
| `/inventario/presentaciones-proveedor` | AMP standalone | (previo) |
| `/inventario/recibir-compra` | Recibir compra **1 ítem** + preview conversión | f9f240e |
| `/precios` | Catálogo por centro/lista + Listas + Derivar (dryRun) | 0af6660/e8fd342/005f17a/2690ab1 |
| `/servicios` | Config de servicios (= pestañas frontdesk) | 2f67b20 |

## 2. Vistas NUEVAS propuestas (aditivas, opcionales) — construir tras BE + dogfood
| Nueva ruta/vista | Qué añade | Reusa (sin duplicar) |
|---|---|---|
| `/inventario/productos/[id]` | Editor **adaptativo por tipo** en página (secciones Shopify + 2 ejes explícitos) | secciones extraídas del `ProductoForm` actual; `RecetaEditor` (exportado); `ProductoPicker`; `lib/api/inventario` |
| Recepción **multi-línea** (ruta o modo nuevo) | Cabecera + N líneas + totales sticky | `recibirCompra`, AMP, `listAlmacenes` (mismos clients) |
| `/inventario/movimientos` | Visor **read-only** de kardex (validar descargas) | **NUEVO** (no hay equivalente) — requiere confirmar endpoint con BE |
| Menú `Inventario ▸ (…)` 2 niveles | IA lógica vía `parentClave` | menú dinámico + RBAC existentes |

## 3. Mapa de reutilización (cómo se cumple "NO DUPLICAR")
- **Receta/BoM:** exportar el `RecetaEditor` que hoy vive interno en `components/inventario/recetas-admin.tsx`
  → lo consumen **la pantalla standalone `/inventario/recetas` Y** la pestaña "Receta" del editor de producto.
- **Producto:** extraer las secciones del `ProductoForm` (identidad, clasificación, ejes, medida, precio) a
  componentes atómicos → los usan **el Sheet actual Y** la página `/inventario/productos/[id]`.
- **Recepción:** la vista multi-línea reusa `recibirCompra` + selección de AMP + `listAlmacenes` (mismos clients).
- **Regla:** ninguna vista nueva reimplementa `fetch`/tipos: todo pasa por `lib/api/inventario.ts` / `precios.ts`.

## 4. Candidatos a ELIMINAR — SOLO si el flujo nuevo se valida Y el dueño aprueba (HOY: nada se toca)
> Lista informativa. Ningún borrado ocurre sin: (a) reemplazo funcionando y verificado en prod, (b) OK explícito
> del dueño, (c) PR dedicado. Mientras tanto, ambas formas coexisten.
- `/inventario/recetas` (standalone) → si la pestaña "Receta" dentro del producto cubre el caso.
- `/inventario/presentaciones-proveedor` (standalone) → si crear/editar AMP dentro de Recepción cubre el caso.
- Fila **expandible→AMP** en el hub de Productos → si lo anterior la hace redundante.
- `/inventario/recibir-compra` (1 ítem) → si la Recepción multi-línea lo cubre.
- Ítems de menú correspondientes (se ocultan/retiran solo en ese PR de limpieza).

## 5. Cumplimiento de normas (checklist obligatorio en CADA pieza)
- **API-First / Swagger / MCP:** `gen:api` desde prod; tipos desde `schema.d.ts`; **dogfood de cada endpoint antes de construir**.
- **NUNCA ASUMIR / investigar a fondo:** contrato verificado en vivo (incluye por-centro y write paths).
- **Multi-tenant:** `X-Tenant-ID` en todo; scope global/centro donde aplique.
- **RBAC:** `can('inventario.*')` cosmético; la autoridad es el BE.
- **i18n:** `labelKey` es/en, **cero strings hardcodeados**.
- **Sin secretos · sin hardcode · NO DUPLICAR CÓDIGO** (reusar/extraer, §3).
- **Configurable / data-driven:** menú y columnas del BE; el FE no compone columnas al crear servicios.
- **spec/plan:** este doc. **drift-clean:** `gen:api` tras cambios del BE.
- **Verificación real (TDD-ish):** `tsc` + `lint` + `build` + **dogfood** + **deploy verificado en prod** (HTML) por cada pieza.
- **UI moderna:** emular Shopify Admin (form), Katana/Odoo (BoM), inFlow/Cin7 (recepción); buscar referencias antes de construir.

## 6. Dependencias del BE a confirmar (dogfood antes de construir; si falta → mini-handoff y parar)
`GET /inventario/productos/:id` · `GET /inventario/almacenes` · `GET /inventario/clasificaciones` ·
`GET /inventario/movimientos` (o kardex equivalente) · endpoints ya verificados: productos, componentes,
presentaciones-proveedor, recibir-compra, precios/*, servicios/*.

## 7. Orden sugerido (OPCIONAL, sin compromiso de borrar nada)
(a) Editor de producto adaptativo `/inventario/productos/[id]` (reusa Receta) → (b) Recepción multi-línea →
(c) Visor de Movimientos/Kardex → (d) Reorg de menú `Inventario`. Cada uno: construir → verificar → desplegar →
convive con lo viejo. La limpieza (§4) se evalúa al final, con aprobación.
