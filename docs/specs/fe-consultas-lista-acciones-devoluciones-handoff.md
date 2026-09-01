# Handoff FE — Lista de Facturación de Consultas: acciones + lista de devoluciones (igual que General)

## Pedido del dueño
En la lista de **Facturación de consultas** (`/consultas`) faltan las mismas acciones que tiene la
**General** (`/facturacion`): **ver, imprimir, devolver, anular**. Y falta la **lista de devoluciones de
consultas**, exactamente igual que la de devoluciones generales — **sin mezclar** unas con otras.

## Estado del BE: TODO LISTO (nada que construir en BE)
Todos los endpoints ya existen y ya distinguen por `contexto` (`general` = venta directa/sin cita;
`consulta` = ligada a cita médica). El BE nunca mezcla: filtra server-side por `contexto`.

### Lista de facturas de consultas (ya la usa `/consultas`)
- `GET /facturas/tablero?contexto=consulta` → SOLO facturas de consulta.
  (La general usa `?contexto=general`. Mismo endpoint, distinto contexto.)

### Acciones por fila (idénticas a General — operan por `facturaId`, sirven para consulta)
- **Ver**: `GET /facturas/:id` (detalle completo: líneas, impuestos, pagos, paciente).
- **Imprimir recibo**: proyección del recibo desde `GET /facturas/:id` (mismo `ReciboTermico` de la general).
- **Devolver**: `POST /facturas/:id/devolver` (permiso `factura.devolver`). Body igual que en general
  (`items[]` con `facturaItemId`, `cantidad`/`sesiones`, `politica`, `formaReembolsoId`, `motivo`).
- **Anular**: `POST /facturas/:id/anular` (permiso `factura.anular`, body `{ motivo, actorId? }`).
- **Ver devoluciones de esa factura**: `GET /facturas/:id/devoluciones`.
- **Recibo de una devolución**: `GET /facturas/:id/devoluciones/:devolucionId/recibo`
  (documento propio "Devolución #D-000001", ver handoff be-devolucion-numero-correlativo).
- **Anular una devolución**: `POST /facturas/:id/devoluciones/:devolucionId/anular`.

### Lista de devoluciones de consultas (NO mezclar con general)
- `GET /facturacion/devoluciones?contexto=consulta` → SOLO devoluciones de facturas de consulta.
  (La general usa `?contexto=general`.) Paginada + filtros `estado`, `desde`, `hasta`, `q` (nº factura).
  Cada fila trae `numero`+`numeroDisplay` (D-000001), `facturaNumero` (origen), `pacienteId`, `montoDevuelto`, `estado`.

## Qué debe hacer el FE
1. **Reutilizar el MISMO componente de lista/acciones de la General** en `/consultas`, cambiando sólo el
   `contexto` a `consulta` en las llamadas (`/facturas/tablero?contexto=consulta`). No duplicar lógica:
   parametrizar el componente por contexto.
2. Renderizar los botones de acción por fila (ver, imprimir, devolver, anular, devoluciones) apuntando a
   los endpoints de arriba con el `:id` de la fila — son los mismos que ya usa la general.
3. Crear la página **`/consultas/devoluciones`** clonando la de devoluciones generales
   (`/facturacion/devoluciones`), cambiando el fetch a `?contexto=consulta`.
4. **No mezclar**: nunca combinar listados; cada pantalla pasa su `contexto` fijo. (Pilar del dueño:
   Facturación General ≠ Consultas.)
5. UI moderna coherente con el resto (mismo layout/acciones que la general; no reinventar).

## Notas
- RBAC ya aplicado en los endpoints (`factura.read`/`.devolver`/`.anular`/`.devolucion.anular`).
- i18n: reusar las claves existentes (`nav.facturacionConsultas`, `devoluciones.*`); no hardcodear labels.
- El menú ya quedó como "Facturación general" + "Facturación de consultas" (BE PR #114).

---

## ✅ FE — YA ENTREGADO (commits `9f5c9ac` lista uniforme + `151e249` recibo devolución)

Todo lo pedido está en prod, **sin duplicar lógica** (componentes parametrizados por `contexto`):

1. **`/consultas`** = `<FacturasListView contexto="consulta" />` — el MISMO componente que la general
   (`/facturacion` = `contexto="general"`). Llama `GET /facturas/tablero?contexto=consulta`.
2. **Acciones por fila** = `<FacturaRowActions>` (idéntico a la general): Ver · Imprimir · Editar (borrador)
   · Email · **Devolver** (→ pantalla completa `/facturacion/:id/devolver`) · **Anular**. Gates RBAC
   (`factura.anular`/`.devolver`/`notificaciones.create`).
3. **`/consultas/devoluciones`** = `<DevolucionesListView contexto="consulta" />` — clon exacto de la
   general vía `GET /facturacion/devoluciones?contexto=consulta`. Columna **Nº Devolución** (`numeroDisplay`
   D-000001) + factura de origen; acción **Imprimir devolución** (recibo propio) y **Anular**.
4. **No mezcla**: cada pantalla fija su `contexto`. Verificado en vivo (local Bayamón): tablero general 6
   filas vs consulta 1 fila; devoluciones general 1 (D-000001) vs consulta 0. Filtrado server-side correcto.

**No requería nada nuevo del FE más allá de lo ya commiteado; el único bloqueo real era el rótulo del menú
(BE PR #114), ya resuelto.** Nada que reparar.
