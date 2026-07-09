# Handoff BE — Datos para imprimir factura/recibo (formato térmico 80mm)

**Fecha:** 2026-07-09 · **De:** FE (cmr-fe) · **Para:** BE (cmr-be)
**Regla:** el FORMATO/impresión es competencia FE (navegador `window.print()` @80mm, sin ESC/POS).
Pero los DATOS deben viajar del BE (API-First). El FE se detiene en las partes marcadas BE hasta
tener este contrato. Empezamos por lo más simple: **factura de consultas** (1 línea, sin impuesto).

## Contexto (investigado en el legacy `/Applications/MAMP/htdocs/cmr`)
La factura legacy es HTML impreso por navegador. Sus datos fiscales salen de la tabla SQL Server
**`Empresa`** (por `Id_centro`): `Nombre` (nombre legal, p.ej. "MEDICINA SISTEMICA LLC"), `Direccion` +
`direccioncompleta`, `tel`, **`mn`** (Registro de Comerciante PR = tax id), `Rif`, `logo`, `pie_factura`,
`sucursal`. Ejemplo real: `public/temp/factura_0007774.html` (encabezado MN `0647913-0012`, tel
`787-780-7575`, dirección de Caguas). Generador: `app/Helpers/PrintHelper.php`.

## Qué YA viaja hoy (verificado en prod, getById `/facturas/:id`)
`paciente {nombres, apellidos, record, docId}`, `items[]`, `numero/serie`, `fecha`, `estado`, totales
(`subtotal, descuento, impuesto, total, montoAbonado`), `impuestos[]`, `descuentosGrupo[]`.

## 🔴 Lo que FALTA (pedido al BE)

### 1. Datos fiscales por sucursal (decisión de negocio: migrar/exponer la tabla `Empresa`)
Exponer por centro los datos legales para el encabezado y pie. Propuesta de contrato (nombres que el FE
consumirá — ajustar juntos si aplica):

**Opción A (preferida): endpoint dedicado**
`GET /centros/:id/datos-fiscales` (y/o incluir el bloque en `/auth/me/centros`) →
```jsonc
{
  "nombreLegal": "MEDICINA SISTEMICA LLC",   // razón social (≠ marca)
  "registroFiscal": "0647913-0012",          // MN / Registro de Comerciante PR
  "registroFiscalLabel": "MN",               // etiqueta del id fiscal (configurable por país/centro)
  "telefono": "787-780-7575",
  "direccion": "Av. Luis Muñoz Marín Calle #21 Bloque Q-2 Urb. Mariolga, Caguas, 00725",
  "sucursal": "Caguas",
  "pieFactura": "No se aceptan devoluciones después de 24 Horas\nPida su cita 787-780-7575",  // MULTILÍNEA, texto legal + CTA configurable por sucursal
  "web": "www.centrodemedicinaregenerativa.com"
}
```
> ⚠️ **La marca/dominio DIFIERE por sucursal** — evidencia real: un recibo de otra sucursal muestra
> `www.centromedicoadaptogeno.com` (≠ `centrodemedicinaregenerativa.com`). Por eso NADA de esto se
> hardcodea en el FE: `nombreLegal`, `web`, `telefono`, `pieFactura` salen del BE POR CENTRO. El
> `pieFactura` es **multilínea** (el FE ya lo renderiza con `whitespace-pre-line`): puede traer la
> política de devolución + la línea "Pida su cita [tel]".
- **Multi-tenant:** por `X-Tenant-ID`/centroId (cada sucursal su bloque). NO hardcodear.
- **Configurable:** editable (no constantes). El label del id fiscal (`MN`/`RIF`/`EIN`) por centro/país.
- **DB comments** en cada columna. **Swagger** documentado. **MCP** tool para leer/editar. **RBAC**
  para editar (`centro.fiscal.write` o similar). **drift-clean** tras merge → el FE corre `gen:api`.

### 2. `pagos[]` en la proyección de la factura (getById)
Para el bloque de pagos del recibo. Cada pago: `{ formaPagoNombre, monto, referencia?, tipo, fecha }`
(resolver `formaPagoId → nombre`). Hoy `pagos` viene `undefined`.

### 3. Emisor + médico + fecha de emisión (getById)
- `emisor: { nombre }` — quién cobró/emitió (para "Atendido por" / cajero). Legacy usa `mediconame` o
  `usuario`.
- `medico: { nombre }` — proyectar SIEMPRE que `medicoId` esté (hoy a veces `undefined`).
- `emitidaEn` (date-time) — fecha/hora de emisión (distinta de `createdAt` del borrador).

### 4. Formato del número de factura
Confirmar: legacy usa **7 dígitos con ceros a la izquierda** (`0007774`) + `serie`. ¿El BE ya entrega el
consecutivo formateado o el FE lo formatea? Preferible que el BE mande `numeroDisplay` ya formateado
(configurable el ancho/serie por centro), para no hardcodear el formato en el FE.

## Cumplimiento (checklist para el BE)
API-First · MCP · Swagger · configurable (nada hardcodeado) · multi-tenant (por centro) · RBAC ·
comentarios en DB y fields · spec/plan · TDD · drift-clean · i18n (labels por clave, p.ej. el label del
id fiscal) · sin secretos · **NUNCA ASUMIR** (si el mapeo de la tabla `Empresa` no está claro, revisar el
esquema real / simular).

## Mientras tanto (FE)
El FE construye el **formato/plantilla** del recibo (layout 80mm + CSS print + logo, ver
`docs/specs/factura-formato-termico-fe.md`). Consumirá este contrato con **degradación elegante**: si el
bloque fiscal/pagos aún no llega, el recibo imprime lo que hay (marca, paciente, items, total) sin romper.
Se cablea completo cuando el BE entregue 1–4.
