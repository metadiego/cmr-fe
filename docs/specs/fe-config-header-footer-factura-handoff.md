# Handoff FE — Config: Header/Footer de la factura (por centro)

**BE listo (ya en prod).** El CRUD existe; falta la **pantalla en Configuración**. Sin nuevos endpoints.

## Endpoints
- Leer: `GET /api/v1/centros/:id/datos-fiscales` → `DatosFiscalesDto`.
- Guardar: `PUT /api/v1/centros/:id/datos-fiscales` (patch parcial). RBAC `centro.fiscal.write`.

Campos editables (todos opcionales en el PUT):
`nombreLegal, nombreComercial, registroFiscal, registroFiscalLabel, telefono, direccionFiscal, zip, web, pieFactura, logoUrl`.

## Pantalla (Configuración → Factura)
Formulario por **centro** (selector de centro arriba; admin multi-centro). Dos secciones:
- **Encabezado (header):** logo (logoUrl), nombreLegal, nombreComercial, registroFiscal + label,
  teléfono, dirección + zip, web.
- **Pie (footer):** `pieFactura` (textarea multilínea).
- **Vista previa** del recibo a la derecha (opcional pero recomendado) usando `GET /facturas/:id` de una
  factura de ejemplo, para ver header/footer en vivo.

## UI (buscar layout moderno)
Formulario tipo "Settings" moderno (p.ej. patrón shadcn/ui: `Card` + `Form` + `Tabs` Header/Footer,
`Textarea` para el pie, subida/preview de logo). Labels vía i18n (`labelKey`), no hardcode. Guardar =
PUT; toasts de éxito/error. Inspirarse en pantallas de "invoice branding/settings" actuales.

## Notas
- `web` ya quedó en `centrodemedicinaregenerativa.com` (se imprime en el pie/encabezado). Verificar que
  el template del recibo RENDERICE `empresa.web` y `empresa.pieFactura` (vienen en `GET /facturas/:id`).
- **Futuro (no ahora):** elegir qué columnas de la factura se imprimen — se avisará spec aparte.

## Aceptación
- Editar header/footer de un centro y guardar refleja el cambio en el próximo recibo de ese centro.
- Multi-centro: cada sucursal mantiene su propio header/footer.
