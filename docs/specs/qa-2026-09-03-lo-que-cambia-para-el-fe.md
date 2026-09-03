# Lo que cambia para el FE tras el QA del 2026-09-03

Dos cosas del BE cambiaron hoy y una tercera es una aclaración para que no se construya de más.
Todo está ya desplegado en producción (`api.centrodemedicinaregenerativa.com`).

## 1. La devolución ya trae su número formateado — no lo formatee el FE

`GET /facturas/:id/devoluciones` (v2: `GET /invoices/:id/refunds`) antes devolvía el número en
crudo y ahora trae también el visible:

```json
{ "numero": 16, "numeroDisplay": "D-000016", "montoDevuelto": 170.46, "impuestoDevuelto": 17.58 }
```

En v2: `number`, `displayNumber`, `refundedAmount`, `refundedTax`.

**Qué hacer:** pintar `numeroDisplay` / `displayNumber` tal cual. El prefijo (`D-`) y el relleno
son configuración por centro y por serie; si el FE los concatena a mano, un centro con otra serie
saldrá mal. El listado global de devoluciones ya lo traía; ahora las tres puertas coinciden.

## 2. Abrir folder nuevo (asignar récord) ya no falla

`POST /pacientes/:id/asignar-record` devolvía 500 en producción para **todos** los pacientes.
Ya funciona y devuelve el récord asignado. Si la pantalla de recepción tenía ese botón oculto o
con un mensaje de error, se puede habilitar.

Un aviso: el número que sirve hoy arranca en `600001` por una ficha heredada con ese número. El
número de arranque real de la serie lo va a fijar el dueño; el FE no debe suponer un rango.

## 3. El tablero de Atención NO muestra las citas `programada` — y es correcto

Si se crea una cita y no aparece en Atención, no es un fallo. El tablero `atencion` está
configurado con `soloAtencion: true` y muestra de `confirmada` a `atendida`. Para ver las
programadas:

- el tablero del call center: `GET /tablero/filas?tablero=citas_cc&fecha=YYYY-MM-DD`, o
- abrir el filtro: `GET /tablero/filas?tablero=atencion&fecha=…&soloAtencion=false`.

Qué estado ve cada tablero es **dato** en la tabla `boards`, no código: se cambia sin desplegar.

## 4. Recordatorios de endpoints (para no buscar el más cómodo)

- Facturas de un paciente: `GET /facturas?pacienteId=<id>`. **No existe** `/pacientes/:id/facturas`.
- Existencias de un producto: `GET /inventario/stock/resumen?q=<sku>` → `cantidad`.
- Movimientos: `GET /inventario/kardex?productoId=<id>` → `fechaEfectiva`, `delta`, `saldo`, `loteId`.
  Ojo: devuelve **ids** (`tipoMovimientoId`, `motivoId`, `loteId`), no nombres; si la pantalla de
  kardex necesita rótulos, pídanlo y lo resuelvo en el BE en vez de hacer N llamadas desde el FE.
- `sexo: "femenino"` y `estado: "emitida"` son **códigos**, también en `/api/v2`. El rótulo sale
  del `labelKey`; no se muestran crudos ni se traducen en el cliente a mano.

## Búsqueda de pacientes: ya cubre las cuatro formas

Un solo campo `q` en `GET /pacientes?q=` resuelve apellido, nombre (aunque sea compuesto),
teléfono con guiones o solo dígitos, y número de récord. Verificado en producción. No hacen falta
campos separados en la pantalla de búsqueda.

---

## 5. NUEVO: el número de arranque de los correlativos (pantalla que hace falta)

Hasta hoy el prefijo y el relleno de una serie se podían cambiar por API pero el **siguiente
número** no. Ya se puede, con guardas, y hace falta una pantalla de configuración del centro
—«Numeración»— porque sin ella el dueño no puede fijar por dónde arranca la numeración al entrar
en producción de verdad.

### Series de facturación (facturas, presupuestos)

- `GET /facturacion/series` → lista con `serie`, `prefijo`, `padding`, `proximo`.
- `PUT /facturacion/series/:serie` → `prefijo`, `padding` (lo de siempre).
- `PUT /facturacion/series/:serie/arranque` → **nuevo**. Cuerpo:
  ```json
  { "arranque": 38512, "motivo": "continuar la numeración del legado" }
  ```

### Serie del récord del paciente

- `GET /pacientes/serie-record` →
  ```json
  { "configurada": false, "serie": "default", "prefijo": null, "padding": 0, "proximo": 102719 }
  ```
  `configurada: false` significa que el centro no la ha fijado y `proximo` es lo que entregaría hoy
  el cálculo automático. Enséñenlo como «hoy entregaría el 102719», no como un valor guardado.
- `PUT /pacientes/serie-record` → `prefijo`, `padding`, `arranque`, `motivo`.

### Lo que la pantalla tiene que manejar

`motivo` es **obligatorio** cuando se manda `arranque` (no cuando solo se cambia el formato). Los
rechazos vienen con `labelKey` para traducir:

| labelKey | Qué pasó | Qué decirle a la persona |
|---|---|---|
| `numeracion.error.arranque_retrocede` | el número es menor o igual al último ya emitido | «esta serie ya emitió hasta el N; el arranque tiene que ser N+1 o mayor» (el `message` ya trae la N) |
| `numeracion.error.motivo_requerido` | vino `arranque` sin `motivo` | pedir el motivo antes de enviar |
| `numeracion.error.centro_requerido` | falta `X-Tenant-ID` | obligar a elegir centro antes de abrir la pantalla |
| `numeracion.error.arranque_invalido` | cero, negativo, decimal o absurdo | validar en el formulario |
| `numeracion.error.padding_invalido` | padding fuera de 0–12 | idem |

**Permiso:** `numeracion.arranque` — propio, distinto de `factura.update`. La opción de menú debe
condicionarse a ese permiso (vía `/me/menu`, no `/menu`). Quién lo tiene se decide desde la UI de
roles; no lo aten a un nombre de rol en el código del FE.

Avanzar la numeración se permite; retroceder no, nunca — sería repetir un correlativo ya impreso.

---

## Respuesta del FE (2026-09-03, commit a0b8ccb)

- **§1 devolución `numeroDisplay`:** ya estaba. El FE lo pinta con `numeroDisplay` en las tres vistas
  (listado, detalle, recibo) — no concatena `D-` a mano. Sin cambio.
- **§2 abrir folder (`asignar-record`):** el botón nunca estuvo oculto (`nueva-cita-modal.tsx`); solo
  fallaba por el 500 del BE, ya corregido. Funciona sin cambio de FE.
- **§3 tablero Atención / §4 recordatorios / búsqueda:** aclaraciones, nada que construir.
- **§5 arranque de correlativos: HECHO.** Pantalla `/configuracion/numeracion` ampliada: editor de
  «número de arranque» por serie de facturación y sección nueva «Récord del paciente», con motivo
  obligatorio, solo hacia adelante, y gateado por el permiso `numeracion.arranque`. i18n es/en + los
  labelKeys de error; `arranque_retrocede` se muestra con el mensaje del BE (trae la N).

**Corrección de ruta:** la base real es **`/facturas/series`** (el handoff decía `/facturacion/series`,
que da 404). El endpoint de arranque es `PUT /facturas/series/:serie/arranque`. Verificado en prod, y el
rechazo de retroceso confirmado sin alterar la numeración.
