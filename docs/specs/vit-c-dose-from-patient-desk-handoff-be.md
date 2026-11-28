# Handoff FE → BE: la dosis de la hoja de Vit C con láser IV sale de lo elegido en el patient-desk (28-nov-2026)

Lo pidió el dueño el 28-nov, con la foto de la hoja del legado. En el legado la hoja dice
«DOSIS VITAMINA C : 25g SUEROTERAPIA (E)»; en la nuestra no salía nada. Sus palabras: «esa dosis que la tome de
la selección en patient-desk».

## Lo que ya se arregló (configuración, sin código)

- **Causa:** en Bayamón, el formato `terapia_vitamina_c_laser_iv` no tenía `render.sessionFields`. Caguas sí lo
  tenía, y era la única diferencia entre los dos centros.
- **Arreglo:** se copió la misma entrada con `PUT /api/v2/formats/0777a780-a2fc-4fcc-aceb-44f898972bca`.
  - Antes: `{notas, porPagina}`.
  - Copia de seguridad en el scratchpad de la sesión FE.
- **Verificado:** el armado devuelve ahora `fields: [{clave:"dosis", valor:"25g"}]` en cada bloque.
  - Paciente: MARIA S ORTIZ RODRIGUEZ, 103376, Bayamón.
  - Sesión Vit C de hoy: `ce7ee4fa-5347-4733-8f23-ff0633f288d9`.

## Por qué estaba en Caguas y no en Bayamón

El 7-nov (cmr-be 1b1902ca) la configuración se aplicó **solo en Caguas**, donde estaba la paciente de la
verificación (Lillian, 16041).

- **Comprobado:** `updatedAt` del formato en Caguas = 2026-11-07T18:04Z. En Bayamón seguía en 2026-09-19.
- **No hay migración** que siembre `sessionFields`: era un dato por centro y nadie lo aplicó al otro.
- **Lo que se pide:** que una configuración de formato que se arregla en un centro se aplique a **todos**, con
  una migración o un script idempotente. Que no dependa de dónde estaba la paciente de prueba.

## Decisión del dueño (28-nov): la dosis es la SELECCIONADA en el patient-desk

Sus palabras: «quiero que se muestre la selección que está en la pantalla, porque es la que realmente se está
aplicando o se aplicará».

Es lo mismo que hacía el legado (`selectedDose`, el texto de la dosis elegida en el tablero), según
`docs/specs/formatos-terapia.md`.

### 1. El valor es la selección de la sesión, no el paquete

- **Fuente:** el `productoAplicadoId` de la sesión impresa, es decir la columna Dosis del patient-desk.
- **El mismo valor en todos los bloques**, como el legado. No se calcula por número de sesión.
- Hoy `fallback` pone `paquete.productoId` primero. El paquete y la última dosis conocida solo valen cuando
  la sesión todavía **no tiene nada elegido**.

### 2. Se imprime igual desde la fila de LÁSER INTRAVENOSO

- Hoy, con la sesión de láser `59c1e43a-7298-4e5d-81ce-c4acca19cc3e`, sale «LASER INTRAVENOSO - ENDO».
- Debe salir la selección de la sesión de **Vit C** del mismo paciente ese mismo día.

### 3. El texto, tal como se ve en la pantalla

- Se imprime el nombre de la opción que muestra el select de Dosis del patient-desk, por ejemplo «25 g Vitamina C».
- **Sin recortarlo** a «25g» con `shortDose`. El legado también imprimía el nombre de su opción: «25g SUEROTERAPIA (E)».

## Otros formatos de Vit C revisados

- `terapia_vitamina_c` (la hoja «SUEROTERAPIA Vit C», layout campos) ya trae «DOSIS (GM) : 25 g Vitamina C» en
  los dos centros. No hay que tocarlo.
- `nano_laser_iv`, `amnisome_laser` y `terapia_laser_iv` no tienen `sessionFields` en ningún centro.
  - Sin la foto del legado de esas hojas, no se les añade nada.

## Verificación

Desde el patient-desk de Bayamón:

1. Elegir una dosis distinta de la del paquete en la sesión de Vit C de un paciente de prueba.
2. Imprimir la hoja desde la fila de Vit C y después desde la fila de Láser IV.
3. Las dos deben decir la dosis elegida.
