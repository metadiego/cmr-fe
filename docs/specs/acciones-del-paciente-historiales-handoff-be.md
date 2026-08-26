# Handoff BE → FE — «Acciones» en el paciente: sus historiales sin salir de la ficha

**Fecha:** 2026-08-26 · **BE:** no hace falta nada nuevo — **todo existe y está probado hoy contra
producción**. Esto es trabajo de FE.

## Para qué

Palabras del dueño: «lo bueno es que no hay que entrar a frontdesk ni a atención: se ubica al
paciente y se ve fácilmente qué servicio se le ha dado, qué medicina ha comprado, si tiene pendiente
— todo desde la ficha, sin recurrir a otro sitio».

Un botón **Acciones** en cada fila de la lista de pacientes (y en su ficha) que despliegue:

- Historial de **citas médicas**
- Historial de **compras** (facturas)
- Historial de **prescripción médica**
- Historial de **servicios** (las sesiones del frontdesk)
- **Crear cita médica** — solo médica; las de servicio no se tocan aquí

## Los endpoints, probados hoy con la sesión real de wilma contra producción

Paciente de prueba `fd7c0f62-821c-4349-b4e9-2f661d25dff4` (Bayamón), con `X-Tenant-ID` del centro:

| Historial | Llamada | Resultado real |
|---|---|---|
| Citas | `GET /citas?pacienteId=<id>` | **200** · 0 items |
| Compras | `GET /facturas?pacienteId=<id>` | **200** · 20 items |
| Prescripción | `GET /prescripciones?pacienteId=<id>` | **200** · 0 items |
| Servicios | `GET /frontdesk/sesiones?pacienteId=<id>&desde=&hasta=` | **200** · 5 items |

`desde` y `hasta` son **obligatorios** en sesiones: usa un rango amplio por defecto (el año en curso,
o desde el alta del paciente) y deja que el usuario lo acote.

Y para el resumen de lo que debe, ya está el que se hizo esta mañana:
`GET /facturacion/resumen-paciente?pacienteId=<id>` — total, cobrado y pendiente del día.

## Crear cita médica

```
POST /api/v1/citas
{ "pacienteId": "...", "medicoId": "...", "fecha": "...", "hora": "...", "centroId": "<opcional>" }
```

- Nace en estado **programada** (Agendada), que es lo correcto: entra en el tablero de Citas y **no**
  la ve Atención todavía. Cuando alguien la **confirma**, pasa a ser visible en Atención — ese flujo
  ya existe y no hay que tocarlo.
- **El centro manda**: sin `centroId` se crea en el centro activo. Con `centroId` se crea en otro, y
  el BE exige el permiso de creación **EN ese centro** (no basta con tenerlo asignado). Así que el
  botón debe ofrecer el centro del paciente y, si es otro, esperar un 403 legítimo.
- Permiso: `citas.create`. Esconde la opción con `can("citas.create")`.

## Cómo pintarlo (sugerencia, no dogma)

Un menú de acciones por fila, y cada historial en un **panel lateral** o un diálogo, no en otra
página: el sentido de esto es no salir de la lista. Cada panel con su propio estado vacío honesto
—«sin citas», «sin compras»— porque en pacientes nuevos casi todo estará vacío y eso es normal.

Orden sugerido, del más consultado al menos: **Compras · Servicios · Citas · Prescripción**, y abajo
separado, **Crear cita médica**.

## Permisos de cada opción

Esconde la que no pueda usar, en vez de enseñarla y que falle:

| Opción | Permiso |
|---|---|
| Compras | `factura.read` |
| Servicios | `frontdesk.read` |
| Citas | `citas.read` |
| Prescripción | `prescripcion.read` |
| Crear cita | `citas.create` |

---

## Añadido: el número de factura y **imprimir desde el propio historial**

Palabras del dueño: «hay que tener el número de las facturas, y poder imprimir las facturas o
devoluciones de cualquier movimiento que haya tenido en compras —haya pasado por facturación de
consulta o general— sin recurrir a otro lugar a buscar esa factura».

**Todo existe.** Probado hoy con la sesión real de wilma contra producción, paciente
`fd7c0f62-…` (20 facturas):

### El listado ya trae el número

Cada factura de `GET /facturas?pacienteId=` viene con:

```json
{ "numero": "000049", "serie": "default", "estado": "emitida",
  "total": 1157.23, "fecha": "2026-07-28",
  "numeroPresupuesto": null, "numeroLegacy": null }
```

Qué columna mostrar, en este orden: **`numero`** si lo hay; si no, **`numeroPresupuesto`** (borrador
sin cobrar que ya se imprimió); si tampoco, «—» (borrador sin imprimir). Y **`numeroLegacy`** cuando
exista, porque es el número con el que la clínica lo conoce del sistema viejo. De las 20 del paciente
de prueba, 13 tienen número: las otras son borradores, y eso es normal.

**Consultas y general salen juntas en el mismo listado**, que es lo que se pedía: el historial es del
paciente, no del departamento. Si hace falta distinguirlas, la factura de consulta lleva `citaId`.

### Imprimir la factura

```
POST /api/v1/facturas/:id/imprimir      body: {}
→ 201 { documento: "factura" | "presupuesto", numero, emitida, … }
```

Probado sobre una **emitida**: responde `documento: "factura"`, `numero: "000049"` y **no renumera**.
Es idempotente y seguro de pulsar dos veces.

Lo que hay que saber para no llevarse sorpresas, y conviene reflejarlo en el botón:

- **Borrador SALDADO** → lo **emite** y saca la factura con su número definitivo. Un papel en mano es
  un documento entregado, así que entra en el cuadre. El botón debería avisar de eso antes: «se
  emitirá la factura nº…».
- **Borrador SIN cobrar** → **no emite nada** y sale un **PRESUPUESTO** con su propio correlativo. No
  se bloquea la impresión nunca. Muestra `documento` en el resultado para que el usuario sepa qué
  tiene en la mano.
- **Emitida, anulada o devuelta** → reimprime y ya: no renumera ni resucita.

Permiso: el del propio endpoint de facturación (`factura.update` para emitir al imprimir un borrador;
`factura.read` no basta si va a emitir). Si la persona solo tiene lectura, ofrece imprimir **solo**
las ya emitidas.

### Imprimir el recibo de una devolución

```
GET /api/v1/facturas/:id/devoluciones/:devolucionId/recibo
```

Permiso `factura.read`. La devolución tiene **su propio correlativo** (`D-000001` por centro), así que
en el historial cada devolución se lista con su número, no colgando de la factura original.

### Resumen de lo que la fila de «Compras» necesita

`nº documento · fecha · total · estado`, y a la derecha **Imprimir**. Si esa factura tiene
devoluciones, una línea hija por cada una con su `D-…` y su propio **Imprimir recibo**.

---

## Corrección del dueño (26-ago, misma tarde): en compras, SOLO lo relevante

> «No creo que sea necesario mostrar los borradores. Vamos a mostrar lo que es importante, lo que es
> relevante para nosotros. Un presupuesto no es relevante y no quiero que eso pueda complicarse más
> adelante.»

Así que el historial de compras **filtra**: se muestran las facturas **emitidas** (y sus
devoluciones). Nada de borradores ni presupuestos — el paciente de prueba tenía 20 facturas y solo 13
con número: las otras 7 no entran.

```
GET /facturas?pacienteId=<id>&estado=emitida
```

(Y si hace falta ver también las anuladas o devueltas, que sea un interruptor «ver todo», apagado por
defecto.)

Con eso desaparece también el lío del botón de imprimir: como solo se listan emitidas, **imprimir
nunca va a emitir nada ni a sacar un presupuesto**. Reimprimir y ya.

### La marca de REIMPRESIÓN — ya está en el backend

> «Si es una reimpresión de una factura, sería bueno mostrar más abajo REIMPRESIÓN, con la hora y el
> día.»

`POST /facturas/:id/imprimir` devuelve ahora:

```json
{ "documento": "factura", "numero": "000049",
  "reimpresion": { "reimpresion": true, "vecesAntes": 2,
                   "leyenda": "REIMPRESIÓN · 08/26/2026, 3:42 p. m." } }
```

- **La primera vez** `reimpresion:false` y `leyenda` vacía: el original no lleva marca.
- **De la segunda en adelante**, la leyenda ya viene formada — el FE la pone **al pie del papel**, tal
  cual, sin componerla ni traducirla.
- La hora es la **del centro** (`centros.zonaHoraria`), no la del servidor: un papel con una hora que
  no es la de la clínica no aclara nada.
- No hizo falta columna nueva: cada impresión ya quedaba en la auditoría, y de ahí sale la cuenta.
