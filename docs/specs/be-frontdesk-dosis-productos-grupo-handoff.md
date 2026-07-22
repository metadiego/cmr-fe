# Handoff BE — DOSIS por productos del grupo (Frontdesk) + pendientes F4

## Contexto (pedido del dueño, 2026-07-22)
Servicios como **Vitamina C** o **GLP-1/tirzepatida** NO son "servicio puro" ni producto único: se
**entregan por DOSIS** (Vit C de 10 a 75) desde **un vial**, y las dosis son los **productos del grupo**
de facturación anclado al servicio.

## Lo que el FE ya dejó listo (prod)
- El formulario de Servicio ahora ancla **`grupoFacturacionId`** (selector del catálogo
  `GET /facturacion/columnas/grupos`; el producto 1:1 quedó como legado/retro-compat solo sin grupo).
- La disponibilidad ya se consume por grupo (PR #134: `GET /frontdesk/servicios/:id/disponibilidad`).
- La columna tipo `medicion` ya se renderiza (PR #136). El tablero del frontdesk está vivo en `/frontdesk`.

## Lo que falta del BE (ya anunciado como "llega enseguida" en el handoff F4)
1. **optionsSource `productos_grupo`** para el select de **DOSIS** en las columnas del tablero frontdesk:
   opciones = productos del grupo del servicio (labelKey/nombre + id). El FE lo pinta con el mismo
   mecanismo data-driven de selects (`GET /tablero/.../opciones` o el equivalente del frontdesk).
2. Al elegir la dosis en la sesión → fijar **`productoAplicadoId`** (y su descarga del **vial abierto**
   `vialAbiertoId` al asistir, fracciones incluidas — mecánica del BE).
3. **Semillas de columnas** del tablero frontdesk que incluyan la columna DOSIS (select con ese
   optionsSource) y las mediciones acordadas (vía API del constructor, no SQL).
4. (Del F4, siguen pendientes) rango `desde/hasta` en `GET /frontdesk/tablero` (2 fechas solo gerente);
   soporte del tab "Todos" (vista por paciente); DTO del POST `/frontdesk/nurse-status` (hoy sin body en
   Swagger → el panel FE es read-only).

## Aceptación
- En la pestaña Vit C del Frontdesk, cada fila tiene un select DOSIS con los productos del grupo del
  servicio; elegir + asistir descarga la fracción del vial y fija `productoAplicadoId`.
- Crear un producto-dosis nuevo en el grupo → aparece en el select SIN tocar código FE (data-driven).

**FE detenido en la parte de DOSIS hasta este contrato.** (norma: BE = handoff + parar)
