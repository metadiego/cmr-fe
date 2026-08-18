# HANDOFF BE → FE — Corregir el USUARIO de una factura: RESUELTO (18-ago, tarde)

Este documento respondía al handoff del FE que reportaba que el contrato prometido no existía.
**Tenían razón en los cuatro puntos.** Todo lo de abajo está **probado por HTTP contra producción**,
no supuesto. El handoff del FE queda contestado punto por punto.

## 1. Endpoint real para fijar el usuario responsable — ✅ HECHO

**La ruta es `PUT /api/v1/facturas/:id/cabecera`** (el handoff anterior decía `PUT /facturas/:id`,
que no existe: 404. Error mío por no revisar el endpoint). Se eligió **añadir `usuarioId` a
`EditarCabeceraDto`** y no crear una ruta nueva: la regla de permiso, la de tenencia y la de
«qué se puede editar de una factura» ya viven ahí, y duplicarlas sería otro sitio donde equivocarse.

```
PUT /api/v1/facturas/:id/cabecera   { "usuarioId": "<id del perfil>" }   → 200
```

- **Valida que exista**: un id inventado → **400** `el usuario … no existe`. (Probado: antes entraba
  un uuid de ceros y dejaba la factura sin dueño.)
- **No acepta vacío** → 400. Se cambia el responsable, no se quita.
- **Borrador** → corrige quién la creó. **Emitida** → quién cobró (a quien se atribuye la venta).
- Permiso: el de la edición de cabecera (admin sin límite; gerente o quien facturó, el mismo día).
- Swagger actualizado; segunda puerta MCP: `editar_cabecera_factura` acepta `usuarioId`.

## 2. El roster ahora casa — ✅ HECHO, sin exponer el id de autenticación

La causa: la factura sella el `RequestContext.id`, que para un JWT es el **authUserId**, mientras
`/profiles` devuelve el **id del perfil**. Dos identificadores para la misma persona.

- **`usuarioId` acepta cualquiera de los dos** y el BE lo normaliza. Manda el `id` de `/profiles`.
- **Todo lo que se LEE devuelve `perfilId`**, nunca el authUserId (esa decisión de no filtrarlo ya
  estaba tomada y se respeta).
- **Roster para el selector**: `GET /api/v1/tablero/opciones?tablero=facturacion&columna=fac_usuario`
  → perfiles aprobados con `{ value: <id de perfil>, label: <nombre> }`, ya ordenados. Es la misma
  fuente de opciones que usan los demás selects del motor de tableros; no hay endpoint nuevo que
  aprender.

## 3. Editar en la LISTA de facturas — ✅ HECHO con el motor de siempre

`GET /api/v1/facturas/tablero` ahora trae (verificado en producción):

```
fac_medico  | tipo select | editable true | render {writeBinding:"factura.medicoId",  optionsSource:"medicos"}
fac_usuario | tipo select | editable true | render {writeBinding:"factura.usuarioId", optionsSource:"usuarios_facturables"}

fila: { fac_medico: "Gilberto Caraballo",  fac_medico__valor:  "519a3272-…",
        fac_usuario: "Facturacion Caguas", fac_usuario__valor: "0b1d2736-…" }
```

- Los `__valor` los genera el motor genérico para cualquier select con `writeBinding`: nada bespoke.
- `fac_usuario__valor` es el **id del perfil** — el mismo que mandas de vuelta en `usuarioId`.
- Escribir: `PUT /facturas/:id/cabecera` con `{ medicoId }` o `{ usuarioId }`.
- `GET /facturas` (la lista no-tablero) también trae `usuario { perfilId, nombre }` por fila.

## 4. Nota de datos: las filas «sin nombre» — ✅ RESUELTO

Las que salían con `usuarioId` presente y `nombre: null` **no eran personas**: son **223 facturas
selladas por una API key** (importaciones y carga por API). Ahora se nombran:

```
"usuario": { "perfilId": null, "nombre": "dev-prueba-frontdesk-full-2026-07-24", "esLlave": true }
```

Muéstralas como integración (chip o icono) y **no ofrezcas corregirlas** como si fueran un empleado.
Solo queda `usuario: null` cuando de verdad no hay ningún responsable registrado.

## Qué mirar al retomarlo

El handoff FE actualizado es `cmr-fe/.personal/HANDOFF-usuario-de-la-factura-y-ventas-por-usuario.md`
(reemplazado, mismo nombre). El reporte «Ventas por usuario» que ya desplegaste no cambia.
