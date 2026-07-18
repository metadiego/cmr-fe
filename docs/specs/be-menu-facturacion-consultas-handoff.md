# Handoff BE — Menú: diferenciar "Facturación de consultas" de la general

## Qué está pasando (confirmado en vivo)
El menú lo siembra el BE (`GET /me/menu`, tabla de items con `clave/labelKey/path/parentClave`). Hoy trae:

| clave              | path                   | labelKey                | parentClave     |
|--------------------|------------------------|-------------------------|-----------------|
| `facturacion`      | `/facturacion`         | `nav.facturacion` = "Facturación"          | `en-desarrollo` |
| `facturacion-general` | `/facturacion/general` | `nav.facturacion_general` = "Facturación general" | `en-desarrollo` |
| `consultas`        | `/consultas`           | `nav.consultas` = "Consultas"              | `por-desarrollar` |

El FE hace dedup por `path` y **los items del BE mandan** sobre el manifiesto FE. Resultado en pantalla:
**"Consultas"** (que en realidad ES la facturación de consultas) + **"Facturación"** (que es la general) +
**"Facturación general"**. El dueño lo ve y se confunde: la facturación de consultas queda disfrazada como
"Consultas", y "Facturación" parece la de consultas pero muestra la general.

## Realidad de las páginas FE (ya diferenciadas por datos)
- `/facturacion` → lista de facturas **generales** (`GET /facturas/tablero?contexto=general`, EXCLUYE consultas).
- `/consultas` → lista de facturas de **consulta** (`contexto=consulta`, SOLO consultas). Ya filtra bien.
- `/facturacion/general` → alta de venta general (gate de centro).
- `/consultas/devoluciones` y `/facturacion/devoluciones` → devoluciones por contexto.

O sea: **la separación funcional ya existe**; el problema es el ROTULADO/AGRUPACIÓN del menú (data del BE).

## Cómo resolverlo (BE — seed/migración del menú)
1. **Renombrar el item `consultas`** para que diga que es facturación de consultas:
   - `labelKey`: `nav.consultas` → **`nav.facturacionConsultas`** (el FE ya tiene esa clave = "Facturación de
     consultas" / "Consultation billing"). Deja el `path` en `/consultas`.
   - `parentClave`: moverlo al **mismo grupo que `facturacion`** (hoy `en-desarrollo`) para que las dos
     facturaciones queden juntas, no en `por-desarrollar`.
2. **Agregar el item de devoluciones de consultas** (opcional pero deseable), análogo al general:
   - `clave` `devoluciones-consultas`, `path` `/consultas/devoluciones`, `labelKey`
     **`nav.devolucionesConsultas`** (ya existe en el FE), mismo parent.
3. **Desambiguar la general**: hoy hay DOS items generales (`facturacion` = lista, `facturacion-general` =
   alta). El dueño espera **dos facturaciones claras: general vs consultas**. Recomendación:
   - Dejar `facturacion` (`/facturacion`) como la **lista general** con label claro (p. ej. mantener
     `nav.facturacion_general` "Facturación general") y **retirar del menú `facturacion-general`**
     (`/facturacion/general`), porque el "Nueva venta" ya se dispara desde la propia lista (`?nuevo=1`).
   - Si se prefiere conservar ambos, al menos renombrar para que uno diga "lista" y otro "nueva" sin ambigüedad.

### Estado final deseado del menú (grupo Facturación)
- **Facturación general** → `/facturacion` (lista general)
- **Facturación de consultas** → `/consultas` (lista de consultas)
- (Devoluciones de cada una como subítems o desde su lista)

## Notas
- Claves i18n ya listas en el FE: `nav.facturacionConsultas`, `nav.devolucionesConsultas`,
  `nav.facturacion_general`. El BE solo debe apuntar los `labelKey` y `parentClave` correctos.
- Sin cambios de FE necesarios si el BE reusa esas claves (el dedup toma el label del BE).
- Multi-tenant/RBAC del menú sin cambios; solo data de items (labelKey/parentClave/altas/bajas).
