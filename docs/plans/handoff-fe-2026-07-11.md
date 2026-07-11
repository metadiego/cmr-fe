# Hand-off FE — cambios de BE del 2026-07-11 (copy-paste)

> Todo lo del BE ya está **desplegado en prod**. Este doc es lo que le toca al FE. Empezar por `gen:api`.
> Regla: i18n (labels por clave), tokens-only, sin hardcode, buscar layout moderno cuando se construya UI nueva.

## Paso 0 — Regenerar tipos (obligatorio, base de todo)
```bash
npm run gen:api    # o: CMR_OPENAPI_URL=https://api.centrodemedicinaregenerativa.com/api/docs-json npm run gen:api
```
Trae: `FacturaConItems` enriquecido (empresa, pagos, emisor, medico, emitidaEn, numeroDisplay), `GET /centros/:id/datos-fiscales`, filtros de `GET /facturas`, y el enum `sexo` + campos v2 de paciente.

---

## 1. Composición de tablero AHORA es GLOBAL (aplica a todos los centros) ✅ BE hecho
**Cambio estructural desplegado:** el Constructor de Tableros ahora escribe la composición **global** (`clinicId=null`) → **una columna agregada aplica a TODOS los centros**. La etiqueta "aplica a todos" ya es cierta.
- **El FE NO necesita cambios** para esto — solo saber que ya no queda "solo en un centro". Al cambiar de centro (Caguas/Bayamón) se ve la MISMA composición.
- Modelo: `clinicId=null` = global; `clinicId=X` = override de centro (precedencia centro > global) — por si a futuro se quiere una columna distinta en un centro (hoy no hay UI para override; sería feature aparte).
- **Acción FE:** hard refresh del tablero para tomar la composición global. (Si el build estaba cacheado, `rm -rf .next && npm run dev`.)

## 2. Columna "testimonio" (tablero atención) — render ya existe, verificar
El BE entrega la columna: `tipo: "toggle"`, `binding: "paciente.esTestimonio"`, `render: { icon:"desktop_windows", usarValorComoActivo:true, writeBinding:"paciente.esTestimonio", confirmacion:true, tooltipKey }`. Ya es **global** → aparece en ambos centros.
- El renderer ya está: **`components/tablero/celda-toggle-icon.tsx`** + dispatch en `tablero-dinamico.tsx` (`toggle` + `writeBinding` → `CeldaToggleIcon`).
- Estado activo = `fila["testimonio"]` (`usarValorComoActivo`). Clic → confirma → `PUT /pacientes/:id { esTestimonio: !actual }` (campo del PACIENTE, no de la cita).
- **Acción FE:** verificar que renderiza tras `gen:api` + hard refresh. Los pacientes sin testimonio muestran el ícono **apagado** (normal); clic para encender.

## 3. Factura de consulta / recibo térmico — conectar campos reales
`GET /facturas/:id` (y MCP `get_factura`) ya devuelve todo el payload de impresión. Quitar los fallbacks "pending BE (F2)".
**`lib/factura/build-recibo.ts`:** usar los campos reales:
```jsonc
{
  "empresa": { "nombreLegal","registroFiscal","registroFiscalLabel","telefono",
               "direccion","sucursal","pieFactura","web","logoUrl" },   // leer f.empresa (embebido, NO por opts)
  "pagos": [ { "formaPagoNombre","monto","referencia","tipo","fecha" } ], // f.pagos (ya resuelto)
  "emisor": { "id","nombre" } | null,     // "Atendido por"
  "medico": { "id","nombre" } | null,
  "emitidaEn": "…",                        // fecha real de emisión (≠ createdAt)
  "numeroDisplay": "0007774"               // ya formateado por centro (usar directo)
}
```
Logo: `f.empresa.logoUrl ?? asset por defecto (logo_cmr.png)`. Pie: `f.empresa.pieFactura` (multilínea).

**Página de LISTADO de facturas (nueva)** — `app/(app)/facturacion/page.tsx`:
- `lib/api/facturas.ts` → agregar `listFacturas(params)` → `GET /facturas?page&limit&estado&pacienteId&desde&hasta&q`
  (`q` busca por nº de factura O paciente por nombre/record).
- Data-table server-side (TanStack + shadcn): search global (`q`) + rango de fechas (`desde/hasta`) + filtro `estado`, estado en URL. Acciones por fila (RBAC `can()`): consultar/re-imprimir, anular, devolver, editar (borrador). Buscar patrón moderno de data-table.

## 4. Datos fiscales por centro — UI administrativa (nueva sección) — BE LISTO ✅ (GET + PUT desplegados)
El admin (`/admin` → Centros, `components/admin/centers-list.tsx`) hoy solo edita `nombre/codigo/direccion`. Ya puedes construir el editor completo de la **definición de empresa** por centro: **el `PUT` ya existe** (era lo que faltaba).
- **Leer:** `GET /centros/:id/datos-fiscales` → `{ nombreLegal, nombreComercial, registroFiscal, registroFiscalLabel, telefono, direccion, sucursal, pieFactura, web, logoUrl }`.
- **Editar:** `PUT /centros/:id/datos-fiscales` (patch parcial) — RBAC **`centro.fiscal.write`** — body (todos opcionales):
  ```jsonc
  { "nombreLegal","nombreComercial","registroFiscal","registroFiscalLabel",
    "telefono","direccionFiscal","zip","web","pieFactura","logoUrl" }
  ```
  Devuelve el mismo bloque de `GET /datos-fiscales` ya compuesto. (Ojo: la dirección se envía como
  `direccionFiscal`; el GET la devuelve como `direccion`.)
- Agregar al `CentersList` un panel/edición "Datos fiscales" con esos 10 campos (por centro). i18n en los labels.
  El editor completo se puede construir **en un solo pase** — ya no hay bloqueo de BE.

## 5. Pacientes v2 (si aún queda algo pendiente)
Ya debería estar hecho, pero confirmar tras `gen:api`:
- `numeroHistoria → record` (tipos/componentes/messages/binding tablero).
- `sexo` enum `femenino|masculino|otro|desconocido` + usar `sexoLabel` del API. Selects con los valores nuevos.
- Campos v2 opcionales en el form (telCasa/telOficina/telPref, direcciones estructuradas + geo `GET /geo/*` en cascada, atendidoPor, fallecido, esTestimonio).

## Checklist FE
- [ ] `npm run gen:api`
- [ ] Tablero: hard refresh → composición global; testimonio visible en Caguas y Bayamón
- [ ] Recibo (`build-recibo.ts`): usar `f.empresa/pagos/emisor/emitidaEn/medico/numeroDisplay` (quitar fallbacks pending)
- [ ] `listFacturas` + página de listado de facturas (filtros + acciones RBAC)
- [ ] Admin: editor de datos fiscales por centro (GET datos-fiscales + PUT centros)
- [ ] Pacientes v2 (record/sexo/campos) confirmado
- [ ] `tsc --noEmit` / `npm run build` verde

## Endpoints BE (referencia rápida — todos desplegados)
- `GET /api/v1/facturas/:id` — payload de impresión enriquecido
- `GET /api/v1/facturas?estado&pacienteId&desde&hasta&q&page&limit` — listado
- `GET /api/v1/centros/:id/datos-fiscales` · `PUT /api/v1/centros/:id/datos-fiscales` (RBAC `centro.fiscal.write`)
- `GET /api/v1/geo/paises` · `/geo/estados?paisId=` · `/geo/ciudades?estadoId=&q=`
- `GET /api/v1/citas/tablero?fecha&soloAtencion&tablero` — tablero (composición global)
- `PUT /api/v1/pacientes/:id { esTestimonio }` — toggle testimonio
