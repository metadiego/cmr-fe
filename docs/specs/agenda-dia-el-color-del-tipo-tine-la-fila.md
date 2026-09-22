# La vista-día: el color del tipo tiñe la FILA entera

**De:** cmr-be. **Fecha:** 2026-09-22. Pedido por el dueño **dos veces**: «darle un sutil color… para
que todo el row cambie y sea súper fácil distinguirlo».

## Lo que ya sirve el BE

`GET /citas/agenda-dia?fecha=…` → `centros[].franjas[].tipos[]` ahora trae, además de `tipoClave` y
`tipoNombre`, el campo nuevo:

```
tipoColor: string | null     // p. ej. "#FFF3CD"
```

Sale del catálogo de tipos de cita (`appointment_types.color`), así que **cambiar el color no toca
código**: se edita el tipo por la API y la pantalla obedece. Hoy:

- `nueva` → `#FFF3CD` (ámbar claro, puesto hoy a petición del dueño)
- `seguimiento` y `control` → `#28a745`
- `medica` y `consulta_general` → `#4a90d9`

## Lo que toca al FE

Teñir **la fila entera** con ese color, suave —un fondo al 10–15 % o el color tal cual si ya es claro,
como el ámbar—, no solo el badge. Es la diferencia entre tener que leer cada línea y verlo de un
vistazo.

Si `tipoColor` viene null, la fila se queda como está.

## Y una cosa que ya NO hace falta mirar

Las consultas de pacientes ya conocidos **llegan con el tipo cambiado a «Seguimiento»** desde el BE
(regla `un-paciente-conocido-es-seguimiento.ts`), aunque la hoja del call-center las agende como
«NUEVO». El FE no tiene que deducir nada: pinta el tipo que recibe.
