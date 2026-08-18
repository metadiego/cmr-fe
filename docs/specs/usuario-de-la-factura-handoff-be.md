# HANDOFF BE — Corregir el USUARIO de una factura: el contrato prometido no existe en prod

**Verificado por HTTP el 18-ago (Caguas, atención@ Master).** El handoff FE
`HANDOFF-usuario-de-la-factura-y-ventas-por-usuario.md` decía que corregir el usuario ya estaba listo con
`PUT /api/v1/facturas/:id { usuarioId }`. **No es así**: esa ruta responde 404. El FE hizo el reporte
"Ventas por usuario" (que sí funciona), pero la corrección del usuario queda bloqueada por el BE.

## Lo que se probó (todo contra el BE de producción del dev server)

Factura emitida real (000640, Caguas):

```
PUT   /api/v1/facturas/:id            { usuarioId }                 → 404  Cannot PUT /api/v1/facturas/:id
PATCH /api/v1/facturas/:id            { usuarioId }                 → 404
PUT   /api/v1/facturas/:id/usuario    { usuarioId }                 → 404  Cannot PUT .../usuario
PUT   /api/v1/facturas/:id/cabecera   { usuarioId }                 → 400  (existe, pero por permiso; y su DTO NO tiene usuarioId)
```

`EditarCabeceraDto` (el de `/cabecera`) solo acepta `pacienteId, medicoId, medioId, facturarA*`. **No hay
campo `usuarioId` en ningún endpoint de edición de factura.**

## Lo que hace falta del BE (para el FE poder construir la corrección)

1. **Un endpoint real para fijar el usuario responsable** de la factura, idempotente y con la misma regla
   de permiso que la edición de cabecera (admin sin límite; gerente del centro o quien facturó, el mismo
   día). Opciones (elige y documenta en Swagger para que `gen:api` lo tome):
   - `PUT /api/v1/facturas/:id/usuario { usuarioId }`, o
   - añadir `usuarioId` a `EditarCabeceraDto` (`PUT /api/v1/facturas/:id/cabecera`).
   - En borrador escribe *quién la creó*; en emitida, *quién cobró* (a quien se atribuye la venta).
   - **No aceptar vacío** (400): se cambia el responsable, no se quita.

2. **Contrato del ROSTER de usuarios** cuyos ids casen con `factura.usuarioId` / el `usuarioId` del reporte
   `por-usuario`. Hoy NO casan con `/profiles`: el reporte devuelve p. ej. `9c7261cc… = "Master"`, pero ese
   id **no aparece** en `GET /profiles` (que trae otros ids: `7bfda6bc…` "Larciles", etc.). El FE necesita
   un endpoint que liste `{ id, nombre }` de los usuarios facturables del centro, con **los mismos ids** que
   se guardan en la factura, para poblar el selector. Decir cuál es (¿`/personal`? ¿un `/usuarios`? ¿otro?).

3. **Para editar en la LISTA de facturas** (lo que pedía el handoff): el tablero `GET /facturas/tablero`
   hoy trae las columnas `fac_numero, fac_fecha, fac_paciente, fac_medico, fac_estado, fac_total, fac_medio`
   y las filas **no** traen `usuarioId` ni `medicoId` (solo el display `fac_medico`, que además llega null).
   Para un select editable por fila (médico y usuario) el tablero debe:
   - exponer una **columna `fac_usuario`** (display) + el **valor crudo** por fila (`usuarioId`, y el
     `medicoId` para el de médico), como ya se hace en otros tableros con `<col>__valor`;
   - marcar esas columnas **editable** con su `writeBinding` (`factura.usuarioId`, `factura.medicoId`) para
     que el FE reuse el motor de celda editable, sin bespoke.
   Sin eso, el FE solo podrá corregir el usuario desde el **detalle** de la factura (una a una), no en la
   lista.

## Lo que el FE YA entregó (no depende de esto)

- **Reporte "Ventas por usuario"** (`/facturacion/ventas-por-usuario`) sobre `GET
  /facturacion/reportes/por-usuario` — verificado con datos reales (Master 319.528,41; filas sin nombre →
  "Sin usuario"). Ordenado, con división, export CSV e impresión.

## Nota de datos

El reporte trae filas con `nombre: null` **y** `usuarioId` presente (p. ej. `fcdc1ccc…`, 61.728,99), además
de una con `usuarioId: null`. Convendría, del lado del BE, resolver el nombre cuando el `usuarioId` existe
(igual que se arregló para creadoPor/emitidoPor), para que no salgan varias filas "Sin usuario" que en
realidad son usuarios con nombre.
