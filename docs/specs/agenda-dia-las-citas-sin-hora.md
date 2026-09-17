# Agenda del día: las citas SIN HORA sí vienen (hay que pintarlas)

Respuesta al handoff del FE sobre «day-agenda devuelve cero citas para 2026-10-01 en ambos centros».

## Lo medido contra producción (17-sep, con la llave admin)

`GET /api/v1/citas/agenda-dia?fecha=2026-10-01&centroId=<Caguas>` devuelve:

- `resumen.totalCitas: 3`
- 13 franjas; **las tres citas están en la franja `hora: null`**, dentro de
  `tipos[].citas[]` (tipo Seguimiento).

No son cero. El endpoint filtra `{ clinicId, fecha }` y la fila cuadra: las tres citas son de Caguas
con `fecha = '2026-10-01'`. En Bayamón no hay ninguna ese día, y por eso ahí sí sale vacío.

## La causa real

Esas citas se guardaron **sin hora** (`hora: null`), como la inmensa mayoría: de las últimas 30 citas
de Caguas, **26 no tienen hora**. La agenda las agrupa aparte, en la franja `hora: null`, a
propósito: son citas del día sin franja asignada.

**Lo que falta es del FE: pintar esa franja.** Si la vista-día solo recorre las franjas con hora,
esas 26 de cada 30 citas son invisibles, y eso es exactamente lo que se vio.

Sugerencia: un grupo «Sin hora» al principio (o al final) del día, con las mismas columnas y
acciones que las franjas con hora.

## Lo que sí era del BE y ya está arreglado (desplegado)

En la misma respuesta, la columna **Médico** venía `null` con `medico__valor` puesto: los nombres del
personal se resolvían filtrando por el centro donde se creó la ficha, y Gilberto Caraballo y Víctor
M. Ocasio la tienen en Bayamón aunque atienden en Caguas. Ya se resuelve cross-centro, en los ocho
sitios que pintan nombres (agenda, tablero de frontdesk, factura, notificaciones y cuatro informes).
Verificado tras el despliegue: las tres filas del 1-oct salen con «Victor M. Ocasio», «Gilberto
Caraballo» y «Christina Rosa».

También quedó arreglado que **asignar o cambiar el médico** en Atención fallaba con 400
`MEDICO_OTRO_CENTRO`: cualquiera trabaja en cualquier centro, así que asignar un médico solo exige
que exista. Ver `cmr-be/docs/specs/el-medico-no-esta-atado-a-un-centro.md`.

## Seguimiento del FE (17-sep, tras pintar la franja sin hora)

Hecho en el FE y verificado en pantalla: la vista-día abría en el PRIMER centro (Bayamón, vacío) en
vez del centro activo; ahora abre en el activo (commit FE). Con eso, en el 1-oct salen las 3 citas de
Caguas: KPI «3 Appointments», chip «No time (3)», y las 3 filas.

**Queda un hueco que parece del BE:** en esas 3 filas sin hora, las columnas **Paciente** y **Médico**
salen en `—` (vacías), aunque «Booked by» (Berkaira Concepcion) y «Comments» sí traen valor. Las
franjas CON hora de otros días sí pintan paciente/médico con las mismas columnas, así que la diferencia
está en la proyección de la franja `hora: null`: parece que sus citas no se proyectan con el `ctx`
(nombres de paciente/médico) como las de hora. Confirmar que `grupoTipos(null, …)` proyecta las citas
con el mismo `ctx`/resolvers que las franjas con hora.
