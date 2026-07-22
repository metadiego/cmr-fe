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

## 2. Contrato BE actual (VERIFICADO — no asumir otros campos)

- `GET /api/v1/facturas/grupos` → lista de grupos (catálogo admin).
- `POST /api/v1/facturas/grupos` (`@Roles admin/super_admin` + `@Permissions('factura.columnas')`) con DTO
  **actual** `{ clave, labelKey }` (SIN division/nombre — ver §4).
- `GET /api/v1/facturacion/formas-pago`-style patterns aplican (envelope `{data, meta}`).
- Productos: `productos.grupoFacturacionId` existe en la entidad, pero el DTO de update de inventario **NO lo
  acepta hoy** (ver §4).

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

## 4. Lo que el BE COMPLETARÁ para esto (compromiso, con TDD/Swagger/MCP; sin migración — columnas ya existen)

1. `CrearGrupoFacturacionDto` + `division` (`@IsIn(['consulta','general'])`) y opcional `nombre`.
2. `PUT /api/v1/facturas/grupos/:id` — editar `labelKey`/`division`/`activo` (soft; nunca borrar duro).
3. **Membresía**: `PUT /api/v1/facturas/grupos/:id/productos` `{ productoIds: string[] }` (reemplaza la
   membresía; el service asigna/limpia `productos.grupoFacturacionId` en bloque, tenant-aware) **y/o**
   `PATCH` de producto aceptando `grupoFacturacionId`. Swagger tipado + tools MCP equivalentes.
4. `GET grupos` enriquecido con `productosCount` (para la columna de la lista).
Avisar al FE cuando esté desplegado para regenerar `schema.d.ts` (mismo flujo que caja/cajeros).

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
