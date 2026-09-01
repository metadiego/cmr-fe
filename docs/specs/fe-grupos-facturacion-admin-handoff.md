# Handoff FE — UI de administración de GRUPOS DE FACTURACIÓN (crear grupos + membresía de productos)

> **Fecha:** 2026-07-21 · **Origen:** BE cmr-be · **Destino:** FE cmr-fe
> **Status:** SOLICITADO · **Prioridad:** alta (bloquea la operación data-driven del frontdesk: hoy el dueño
> NO puede crear grupos ni asignar productos sin tocar la API a mano).
> Estándares: API-First · MCP · Swagger · configurable/sin hardcode · multi-tenant · RBAC · spec/plan · TDD ·
> i18n · tokens-only · NO duplicar · NUNCA asumir (contrato abajo VERIFICADO en código).

## 1. Contexto y problema (verificado en código y prod, 2026-07-21)

Los **grupos de facturación** (`grupos_facturacion`: clave única, `labelKey`, `division` consulta/general)
son el ancla de TODO el modelo nuevo: el producto pertenece a un grupo (`productos.grupoFacturacionId`), el
servicio del frontdesk se ancla 1:1 a un grupo (`servicios.grupoFacturacionId`, ya editable en `/servicios`),
la DOSIS se lista por los productos del grupo (`optionsSource: 'productos_grupo'`) y la disponibilidad
(paquetes) se resuelve por grupo.

**Hoy NO hay UI para definirlos**: solo existen el seed (`seed-grupos-facturacion.ts`) y `POST
/api/v1/facturas/grupos`. Tampoco hay UI (ni endpoint práctico) para asignar productos a un grupo. Caso real:
el servicio "Sueroterapia Vit C" estaba SIN ancla y el grupo `suero` tiene 14 dosis (faltan 80–100g del
legacy) — nadie puede corregirlo sin un ingeniero.

## 2. Contrato BE (CORREGIDO 2026-07-21 y DESPLEGADO — verificado contra prod con 200)

> ⚠️ **FE DE ERRATAS (culpa del BE):** la versión anterior de este handoff decía `/facturas/grupos` — RUTA
> EQUIVOCADA (cae en `GET /facturas/:id` que espera UUID → `VALIDATION_ERROR: Validation failed (uuid is
> expected)`). El path correcto es bajo **`facturacion/columnas`**:

- `GET  /api/v1/facturacion/columnas/grupos` → grupos **con `productosCount`** (verificado 200 en prod).
- `POST /api/v1/facturacion/columnas/grupos` — `{ clave, labelKey, division? }` (división opcional,
  default `general`). `@Roles admin/super_admin` + `@Permissions('factura.columnas')`.
- `PUT  /api/v1/facturacion/columnas/grupos/:id` — `{ labelKey?, division?, activo? }` (soft).
- `PUT  /api/v1/facturacion/columnas/grupos/:id/productos` — `{ productoIds: string[] }` reemplaza la
  MEMBRESÍA (asigna los dados, desasigna los que salen; devuelve `{grupoId, productosCount}`).
- Envelope `{data, meta}` como el resto. Todo YA DESPLEGADO (PR #152); regenerar `schema.d.ts`.

## 3. UI requerida (FE) — pantalla "Grupos de facturación"

Ruta admin (p. ej. `/facturacion/grupos` o bajo Configuración), gated por `can('factura.columnas')` (cosmético;
el BE manda). **Layout: investigar el patrón más moderno** (refs abajo; base sugerida: master-detail con
data-table shadcn + sheet/drawer para forms):

1. **Lista (master)**: data-table de grupos — clave, nombre (i18n por `labelKey`), división (badge
   consulta/general), nº de productos miembros, activo. Buscar/ordenar. Botón **"Nuevo grupo"** → sheet con
   form (clave, labelKey, división) → `POST grupos`.
2. **Detalle (al seleccionar un grupo)**: panel con sus datos (editar → `PUT grupos/:id`, §4) y la
   **membresía de productos**: lista de productos del grupo + buscador de productos para AGREGAR/QUITAR
   (patrón transfer-list o tabla con acción por fila + bulk). Persiste vía el endpoint de membresía (§4).
3. **Cero hardcode**: divisiones desde el catálogo/enum del BE; textos por `messages/{es,en}.json`; unidades
   nada inventado en cliente. Tokens-only. Tipos desde el schema OpenAPI regenerado.
4. Confirmaciones para quitar un producto de un grupo (afecta dosis/disponibilidad del servicio anclado).

## 4. Lo que el BE completó (✅ DESPLEGADO 2026-07-21, PR #152 — rutas exactas en §2)

1. ✅ `CrearGrupoFacturacionDto` + `division` opcional (default `general`).
2. ✅ `PUT …/columnas/grupos/:id` — editar `labelKey`/`division`/`activo` (soft).
3. ✅ Membresía bulk: `PUT …/columnas/grupos/:id/productos` `{ productoIds[] }`.
4. ✅ `GET …/columnas/grupos` con `productosCount`. + MCP `actualizar_grupo_facturacion` /
   `set_productos_grupo_facturacion`. Swagger tipado. Suite 1090 verde. **Regenerar `schema.d.ts` y
   apuntar el cliente a las rutas de §2.**

## 5. Criterios de aceptación (E2E, contra prod)

1. Crear el grupo "sueroterapia 2" desde la UI → aparece por API y en el selector Grupo de `/servicios`.
2. Asignarle los productos 80GST…100GST → el selector de DOSIS del servicio anclado los lista al instante
   (via `productos_grupo`), sin tocar código.
3. Editar división/label → se refleja en facturación (tabs por división) e i18n.
4. Un usuario sin `factura.columnas` no ve/edita la pantalla (y el BE rechaza 403).
5. `typecheck`+`lint`+`build` verdes; i18n es/en completo; tokens-only; multi-centro por el picker.

## 6. Referencias de layout (investigación 2026 — profundizar al implementar)

- [Modern admin dashboard con shadcn/ui (2026) — DEV](https://dev.to/ausrobdev/how-to-build-a-modern-admin-dashboard-with-shadcnui-in-2026-3477)
- [shadcn data-table templates 2026 — AdminLTE](https://adminlte.io/blog/shadcn-ui-data-table-templates/) (sorting/filtering/bulk actions)
- [shadcn-admin y starter kits 2026](https://adminlte.io/blog/shadcn-ui-templates/) — patrón master-detail + sheet forms.
