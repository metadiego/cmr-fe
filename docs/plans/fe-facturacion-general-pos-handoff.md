# Handoff FE — Facturación GENERAL (POS unificado) — DOCUMENTO ÚNICO Y DEFINITIVO

> **De:** BE (cmr-be). **Para:** cmr-fe. **Actualizado:** 2026-07-15. **Todo el BE está en PROD y verificado.**
> Este documento es la **única fuente de verdad**. Todo lo de aquí YA existe y funciona en el BE — no hay
> hueco de BE, no hace falta pedir nada. Si algo parece faltar, está en este doc; léelo completo antes de codear.

---

## 0. Las 3 reglas que NO se rompen
1. **Consultas ≠ General. NUNCA se mezclan.** Son dos entradas y dos catálogos distintos, mismo motor por debajo.
   - **Consultas**: AP-board → "Facturar Consulta" (`POST /facturas/cita/:citaId`), catálogo `?contexto=consulta`. **NO se toca.**
   - **General** (este doc): pantalla "Nueva venta", catálogo sin `contexto`.
2. **UNA sola pantalla, UNA sola grilla.** NO replicar el cmr viejo (que tenía 3 pantallas: productos/láser/suero).
   Cada LÍNEA muestra solo las columnas que le aplican al producto; las que no aplican no salen.
3. **Multi-tenant:** el centro elegido va en `X-Tenant-ID` en **TODAS** las llamadas de la sesión de factura.

Convenciones: `response.data` + `meta.pagination`; `Authorization: Bearer` + `X-Tenant-ID`; whitelist estricto
(param no documentado = 400); i18n por `labelKey`; `can()` por permiso; estados loading/vacío/error; **NO duplicar**
(reusar el motor/editor y `lib/api/*`). UI: buscar el layout POS más moderno (refs al final) — nada de formularios planos.

---

## 1. Flujo completo (orden de pantallas)

### Paso A — Picker de CENTRO (solo admins)
Al entrar a `/facturacion/general`:
1. `GET /auth/me` → `{ isMaster, allowedClinicIds[], activeClinicId }`.
2. `GET /auth/me/centros` → `[{ id, nombre, ... }]` (master → todos; si no → solo permitidos, con nombre).
3. Regla:
   - **1 centro** → auto-selecciónalo, sin picker.
   - **>1 y sin centro válido activo** → **muestra picker y BLOQUEA** el resto hasta elegir.
   - `activeClinicId` que NO esté en `me/centros` (p.ej. "Por desarrollar") = **inválido** → picker.
4. El centro elegido se fija como `X-Tenant-ID` de **toda** la sesión de factura. Ofrece "cambiar centro".

> Por qué: el finder de paciente y el catálogo filtran por centro. Sin centro correcto → "Sin resultados" aunque
> el paciente exista (los pacientes viven por centro: Bayamón ~160k, Caguas ~29k). No es bug: es aislamiento.

### Paso B — Cabecera de la factura
- **Fecha**, **Nº Factura** (lo asigna el BE al emitir).
- **Médico Tratante** (opcional): select desde `GET /personal/por-capacidad/medico` → se manda como `medicoId`.
  "Sin médico asociado" = no mandes `medicoId`.
- **Referencia / Referido-Medios** (mide publicidad/ads): select desde `GET /facturacion/medios` → `medioId`.
- **Cliente**: buscar paciente (Paso C).
- **(Opcional) Facturar a un TERCERO** (empresa u otra persona): campos `facturarANombre`, `facturarADocId`
  (label **"ID"**, no "cédula"), `facturarATipo` (`persona|empresa`). Omitidos = se factura al paciente.
  `pacienteId` **siempre** es obligatorio (ancla clínica); el tercero solo cambia a quién se imprime el recibo.

### Paso C — Buscar paciente e iniciar
- `GET /facturas/buscar-paciente?q=<record|teléfono|nombre>` (scoped por `X-Tenant-ID`).
- Al elegir paciente → `POST /facturas` (Paso D) → abre el editor con líneas.

### Paso D — Crear el borrador
```
POST /facturas
{ pacienteId, medicoId?, medioId?, tipoPrecioId?, serie?, notas?,
  facturarANombre?, facturarADocId?, facturarATipo? }
→ 400 "Selecciona un centro" si no hay centro (el picker lo evita)
→ devuelve la factura borrador (incluye los campos de receptor)
```
Corregir/descartar el borrador:
- **Corregir paciente** (sin borrar): `PUT /facturas/:id/paciente { pacienteId }` (solo borrador).
- **Descartar**: `DELETE /facturas/:id` (borra borrador + líneas; 204; 400 si ya emitida).

### Paso E — La GRILLA UNIFICADA (el corazón)
Un **solo select de catálogo** para TODO: `GET /facturas/catalogo?q=&tipoPrecioId=<opcional>`.
Devuelve por producto: `{ id, nombre, presentacionId, precio, gravado, grupoFacturacionId, ... }`.
- `precio` ya viene resuelto por el centro activo (lista por defecto, o la de `tipoPrecioId`). El FE **solo lo muestra**.
- `gravado` = default del IVU de la línea (ver §2).

**Al seleccionar un producto**, pide su esquema de columnas:
`GET /facturacion/columnas?productoId=<id>` → lista de columnas de la línea. **Nunca vuelve vacío.**
Pinta SOLO esas columnas en la fila. Roles de columna:
- `producto`, `tarifa`(lista), `cantidad`, `precio`, `descuento`, `impuesto`, `subtotal`, `accion` → comunes a todos.
- `multiplicador` (láser: **Áreas**, **Días**) → entran al total: `cantidadEfectiva = cantidad × Π(multiplicadores)`.
- `informativo` (producto: **Dosis**, **Cant. Sugerida**; suero: **Sesiones**) → se muestran pero NO afectan el total.

Mapa de qué campos aparecen por tipo (todos en la MISMA grilla, fila por fila):

| Producto de grupo | Columnas propias (además de las comunes) |
|---|---|
| producto (o **sin grupo** → default) | Dosis, Cant. Sugerida |
| laser | Áreas, Días (multiplican) |
| suero | Sesiones |

**Agregar línea:**
```
POST /facturas/:id/items
{ productoId, cantidad, presentacionId?, precioUnitario?, gravado?,
  meta: { areas: 2, dias: 5 }   // valores de multiplicadores/informativos por su clave
}
```
- `precioUnitario` solo si el cajero lo sobrescribe; si no, el server usa el efectivo.
- `meta[clave]` lleva los valores de las columnas multiplicador/informativo que el esquema declaró.
- El server devuelve la línea con `cantidadEfectiva`, impuesto y `total` ya calculados. **El FE no calcula.**
- Editar/quitar línea: `PUT /facturas/:id/items/:itemId` · `DELETE .../items/:itemId` · `PUT .../items/:itemId/kit`.

### Paso F — Descuentos (3 niveles) e IVU
- Por línea: `descuentoTipo` (`monto|porcentaje`) + `descuentoValor` en el item; IVU por línea = `gravado` (§2).
- Por grupo: `PUT /facturas/:id/descuentos-grupo`.
- Global / exento de cabecera: `PUT /facturas/:id/descuento-global` · `PUT /facturas/:id/exento`.

### Paso G — Totales, emitir, pagar
- Totales (Subtotal, Descuento, Impuesto, Total) llegan calculados en la factura; el FE los muestra (sticky).
- **Emitir** (aquí descarga inventario): `POST /facturas/:id/emitir`.
- Pagos: `POST /facturas/:id/pagos` (+ `/multiple`) · `GET .../pagos/resumen`.
- Anular/devolver: `POST /facturas/:id/anular` · `.../devolver` · `GET .../devoluciones`.

---

## 1.bis Autocálculo de Cantidad desde la Dosis (productos con cápsulas/tabletas) — DESPLEGADO prod
Cuando una línea de producto tiene columna **Dosis**, al cambiar la Dosis se pre-llena la **Cantidad**
(envases/potes) sugerida, EDITABLE. Fórmula (paridad legacy verificada):
```js
// GET /facturas/catalogo trae por producto: unidadesPorEnvase, diasTratamiento (pueden ser null)
const uxe  = producto.unidadesPorEnvase;   // cáps/tabletas/comprimidos por envase
const dias = producto.diasTratamiento;     // días de tratamiento (dato por producto)
if (dosis > 0 && uxe > 0 && dias > 0) {
  cantidad = Math.ceil((dosis * dias) / uxe);  // sugerida, editable
} // si uxe/dias son null → no autocalcular; cantidad manual
```
- `unidadesPorEnvase` y `diasTratamiento` son campos del **producto** (CRUD de inventario), configurables,
  y vienen en `GET /facturas/catalogo`. NO hardcodear días en el FE: usar el del producto.
- La `cantidad` (envases) es lo que se manda en `POST /facturas/:id/items`; la `dosis` va en `meta.dosis`.
- Ejemplo real: ANDROGRAPHIS 120 CAPS → uxe=120, dias=30, dosis=12 ⇒ cantidad=3 potes.

## 2. IVU por línea — el atributo del producto MANDA, el toggle es override
- El BE ya hace: `gravado_de_la_línea = lo_que_manda_el_FE ?? producto.gravado`.
- **Fix FE:** al agregar un producto, **inicializa el toggle IVU con `producto.gravado`** del catálogo
  (`true`→ON, `false`/`null`→OFF). NO lo pongas en ON fijo.
  - Ejemplo del bug actual: los **ULTRA** son `gravado:false` → si el toggle nace ON, mete IVU indebido ($945).
- El cajero puede cambiarlo puntualmente (override), pero el **default = `producto.gravado`**.
- Solo los físicos (43 productos del legacy `prod_serv='p'`) traen `gravado:true`; ULTRA/servicios/kits = false.

---

## 3. Selectores (todos con endpoint listo)
| Select | Endpoint | Se manda como |
|---|---|---|
| Centro (picker) | `GET /auth/me/centros` | `X-Tenant-ID` (sesión) |
| Médico Tratante | `GET /personal/por-capacidad/medico` | `medicoId` |
| Referencia/Medios | `GET /facturacion/medios` | `medioId` |
| Lista de precios | `GET /precios/tipos` | `tipoPrecioId` (default = lista por defecto) |
| Catálogo (productos) | `GET /facturas/catalogo?q=&tipoPrecioId=` | agrega línea |
| Esquema de la línea | `GET /facturacion/columnas?productoId=` | qué columnas pintar |

---

## 4. Componentes de kit (recibo / detalle congelado)
`GET /facturas/:id` incluye `componentes: []` **solo en facturas emitidas**: el detalle congelado de qué llevó
cada línea de kit. **Agrupar por `facturaItemId`.** Campos: `productoId`, `cantidad`, `origen` (`receta|editado`),
`esInventariable`, `modoDescarga`, `dosis`, `sesiones`. El FE solo lee/pinta; no calcula.

---

## 5. Fuera de alcance (no lo hagas)
- Pestañas/filtros por tipo de producto (la clasificación es interna, no pestañas).
- Comisiones. Cargar productos de láser/suero (lo hace el BE "al final"; por eso hoy la mayoría solo trae cantidad×precio).
- La pantalla de Consultas (ya existe, aparte).

---

## 6. UI moderna (obligatorio: buscar layout POS actual antes de maquetar)
Patrón shadcn/POS de una sola vista, sin pestañas por tipo, grilla data-driven, panel de pago single-pane.
Refs: [shadcn/ui POS](https://adminlte.io/blog/shadcn-ui-pos-templates/) ·
[POS payment UX](https://brightinventions.pl/blog/payment-point-of-sale-design-ui-ux/) ·
[POS UX tactics](https://dev.pro/insights/designing-a-pos-system-ten-user-experience-tactics-that-improve-usability/) ·
[Shopify POS UI](https://www.shopify.com/blog/pos-ui)

---

## 7. Estado del BE (para que confíes: todo verificado en prod)
- Endpoints §1–§4: **todos existen y responden**. Migraciones aplicadas; medios (15) y columnas por grupo (37) sembrados en prod.
- Cada capacidad tiene su tool MCP con el mismo RBAC (2ª puerta para agentes).
- Si de verdad algo falta, es UN mini-handoff puntual al BE — pero revisa este doc primero, porque casi todo ya está.
