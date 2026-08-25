# BE — `GET /facturas/resumen-paciente` está INCALLABLE en producción (validación se contradice)

El FE ya construyó el panel «lo que suma el paciente hoy» (handoff `resumen-de-facturas-del-paciente`),
pero el endpoint **rechaza toda llamada**. Medido en producción el 25-ago-2026 con sesión master y
`X-Tenant-ID` de Bayamón (`ef6f87b0-…`).

## El síntoma

El endpoint **exige** `pacienteId` (UUID) y a la vez lo **prohíbe** como propiedad de query:

| Petición | Respuesta |
|---|---|
| `?pacienteId=<uuid>` | `400 VALIDATION_ERROR` — «property **pacienteId should not exist**» |
| `?pacienteId=<uuid>&desde=2026-08-25&hasta=2026-08-25` | igual: «pacienteId should not exist» |
| `?desde=…&hasta=…` (sin pacienteId) | `400 VALIDATION_ERROR` — «**The value passed as UUID is not a string**» |
| (sin ningún parámetro) | igual: «UUID is not a string» |
| `/facturas/resumen-paciente/<uuid>` (como path) | `404 ENTITY_NOT_FOUND` — «Cannot GET …» |
| `?paciente=`, `?id=`, `?patientId=`, `?cliente=`, `?clienteId=` | todos «property X should not exist» |

`desde`/`hasta` SÍ se aceptan (no dan «should not exist»). Solo falla `pacienteId`.

## El diagnóstico (casi seguro)

Parece un `@Query()` con un DTO que **solo** declara `desde`/`hasta`, validado con
`whitelist + forbidNonWhitelisted`, MIENTRAS que `pacienteId` se lee aparte (p. ej.
`@Query('pacienteId') ... @IsUUID`). Resultado:

- Al mandar `pacienteId`, el ValidationPipe del DTO lo ve como propiedad no permitida → «should not exist».
- Al NO mandarlo, el `@IsUUID` sobre un `undefined` → «UUID is not a string».

No hay forma de llamarlo bien desde el FE.

## Lo que se necesita

Que `pacienteId` sea un parámetro **válido y requerido** de la petición, sin que el whitelist lo rechace.
Cualquiera de estas sirve; el FE se adapta a la que elijan y lo confirman en Swagger:

1. **Query en el mismo DTO** (preferido, es lo que dice el handoff original): añadir `pacienteId` al DTO
   del `@Query()` (`@IsUUID()`), junto a `desde?`/`hasta?`. Ruta:
   `GET /facturas/resumen-paciente?pacienteId=<uuid>&desde=&hasta=`.
2. **Path param**: `GET /facturas/resumen-paciente/:pacienteId?desde=&hasta=` con `@Param('pacienteId')`.

En ambos casos: dejar `desde`/`hasta` opcionales (sin ellas = hoy), mantener el permiso `factura.read` y
el `X-Tenant-ID` para el centro (el 400 de centro requerido está bien; ese no es el problema aquí).

## Verificación pedida (para cerrar)

Con la paciente Felicita Hernández (récord 14753, Bayamón) — el ejemplo del handoff original — que
`GET …?pacienteId=<su uuid>` devuelva las facturas `000282` (láser 2.640), `000284` (suero 5.000),
`000285` (consulta, excluida por ser otro departamento) y el `totalGeneral` correcto por `neto`.

## Estado del FE

El panel está construido y desplegado, pero **desactivado tras un flag** (`RESUMEN_PACIENTE_ENABLED`
en `app/(app)/facturacion/[id]/page.tsx`) para no enseñar una función que da 400. En cuanto el endpoint
acepte `pacienteId`, se pone el flag en `true` (y se ajusta la ruta si eligen path param) y queda vivo.
