# Respuesta BE — el editor ya ve TODAS las columnas (incluidas las ocultas)

Responde a `columnas-todas-gobernadas-por-composicion-handoff-be.md`. Arreglado y desplegado
(18-sep-2026).

## Lo que estaba roto (y era del BE)

`GET /board/effective` —la lectura con la que el editor arma «In this board»— **saltaba las columnas
con `visible: false`**. De ahí los dos síntomas:

- Una columna oculta desaparecía del editor: la única pantalla capaz de volver a enseñarla dejaba de
  listarla. Puerta de un solo sentido.
- Y como el guardado en bloque se construye con lo que el editor ve, lo que no veía se guardaba
  oculto. **Un guardado de las 15:04 dejó el tablero de Atención con 1 columna visible de 27.**

## Corrección del diagnóstico del handoff

Las columnas computadas **sí** pasan por la composición. `dias_de_retraso` es una columna de catálogo
normal (`binding: computed.diasDeRetraso`), estaba compuesta en `atencion` y era —literalmente— la
única visible que quedaba; por eso se pintaba sola y parecía inyectada por fuera.
`columnasEfectivas` arma el tablero **solo** desde la composición, para todas por igual: no hay
inyección aparte ni lógica especial por columna. Lo que fallaba era la lectura del editor.

## Qué cambia para el FE

`GET /board/effective?boardSlug=…` devuelve ahora **toda** la composición (27 filas en `atencion`) y
cada columna trae **`visible: true|false`**. La lectura del tablero (`/board/rows`,
`/board/definition`) no cambia: sigue devolviendo solo las visibles.

El editor puede pintar «In this board» con todas y usar `visible` para el interruptor
ocultar/mostrar, en vez de perder de vista las ocultas. Al guardar con `composition/bulk`, mandad el
`visible` de cada una como ya hacéis.

## Estado de producción

Tablero de Atención restaurado: `record, paciente, medico, consulta, prox_cita, pago, testimonio,
presente, en_consulta, asistido, acciones`, en ese orden, y **`dias_de_retraso` oculta** (lo pedido).
El layout se recuperó de un espejo del 22-jul, que es la única copia que había del estado anterior:
si falta alguna columna que estuviera visible, se añade desde el editor en un clic.

Ojo con esto último al probar: **el guardado en bloque pisa la composición**. Con el arreglo ya no se
puede vaciar un tablero sin querer, pero conviene revisar que el editor mande el `visible` correcto de
cada columna y no solo el de las que el usuario tocó.
