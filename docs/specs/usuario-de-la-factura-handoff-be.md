# HANDOFF BE — Proyectar el USUARIO en el tablero de facturas (para verlo/editarlo en la lista)

Actualizado 18-ago (tarde). **Lo grueso ya quedó resuelto** por ustedes y verificado por HTTP; el FE ya
lo usó. Queda **un solo hueco** para poder mostrar/corregir el usuario **en la LISTA** de facturas.

## Ya resuelto (gracias) — el FE ya lo consume

- **Corregir el usuario**: `PUT /api/v1/facturas/:id/cabecera { usuarioId }` (id de `/profiles`). Verificado
  (factura 000640). El FE lo usa desde el **detalle** de la factura ("Atendido por" → botón Corregir →
  selector de `/profiles`). Funciona en borrador y en emitida; el BE valida existencia y permiso.
- **GET /api/v1/facturas** (findAll) ya trae por fila `usuario: { perfilId, nombre, esLlave? }`, y el
  detalle trae `creadoPor/emitidoPor/emisor` con `perfilId`. Los ids **casan** con `/profiles`.
- **Reporte** `GET /facturacion/reportes/por-usuario` desplegado y en pantalla (`/facturacion/ventas-por-usuario`).

## El hueco que queda: el TABLERO de la lista no proyecta el usuario

La pantalla **lista de facturas** (General y Consultas) NO se dibuja con `GET /facturas`, sino con el motor
de tableros: **`GET /api/v1/facturas/tablero`**. Hoy ese endpoint devuelve, por fila, solo:

```
columnas: fac_numero, fac_fecha, fac_paciente, fac_medico, fac_estado, fac_total, fac_medio, fac_acciones
fila:     { id, estado, fac_numero, fac_fecha, fac_paciente, fac_medico, fac_estado, fac_total, fac_medio }
```

- **No trae el usuario** (ni `usuario`, ni `fac_usuario`, ni `usuarioId`), y `fac_medico` es solo texto
  (además llega `null`) — la fila **no trae `medicoId`** para preseleccionar un select.

Por eso, hoy el usuario solo se puede ver/corregir **una factura a la vez** en su detalle, no en la lista.

## Lo que se pide (para el select editable por fila en la lista)

En `GET /facturas/tablero`, que cada fila y las columnas incluyan, igual que ya hace `GET /facturas`:

1. **Columna `fac_usuario`** (display) + el **valor crudo** por fila para el select:
   - `fac_usuario` (nombre a mostrar; "Integración" cuando `esLlave`; vacío = "Sin usuario"),
   - `fac_usuario__valor` = el **`perfilId`** (el mismo de `/profiles` y de `PUT .../cabecera`),
   - una marca `esLlave` por fila (para pintar la de integración distinta y no ofrecer corregirla como
     empleado).
2. **`fac_medico__valor` = `medicoId`** por fila, para que el select de médico de la lista preseleccione
   (hoy solo hay el display `fac_medico`).
3. Marcar `fac_usuario` (y `fac_medico`) **editable** con su `writeBinding` (`factura.usuarioId`,
   `factura.medicoId`) para que el FE reuse el motor de **celda editable** existente, sin código bespoke y
   sin duplicar el endpoint de corrección.

Con eso, el FE pinta la columna Usuario y el select por fila reusando lo que ya existe; el guardado sigue
yendo por `PUT /facturas/:id/cabecera { usuarioId }` (o el writeBinding lo resuelve el motor).

## Comprobación al terminar (el FE la hará, sin adivinar)

- `GET /facturas/tablero?contexto=general&desde&hasta` → cada fila trae `fac_usuario`, `fac_usuario__valor`
  (= perfilId de `/profiles`), `esLlave` y `fac_medico__valor` (= medicoId).
- En la lista: columna Usuario visible; select por fila que preselecciona al responsable; al cambiarlo, la
  venta se reatribuye (se refleja en `por-usuario`); las de integración se ven distintas y no se editan
  como empleado.

## Aparte (observación del dueño, a validar con diseño)

La vista de Facturas desperdicia ancho a los lados; el legado usaba la pantalla completa con una tabla más
densa. No hay medida exacta; es de diseño, no de este contrato.
