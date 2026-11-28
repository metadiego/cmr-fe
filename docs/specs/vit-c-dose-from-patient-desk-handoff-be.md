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

## Lo que falta, y es del BE (`dosesOfTheSheet`, `formatos.service.ts`)

### 1. La selección del patient-desk tiene que ganar al paquete

Hoy `fallback` prueba primero `paquete.productoId` y después `s.productoAplicadoId`. Si en el patient-desk se
elige una dosis distinta de la del paquete, la sesión impresa sale con la del paquete.

**Orden pedido:**
1. Lo aplicado en la sesión de ese número (como hoy).
2. Lo aplicado en la **sesión impresa** (`s.productoAplicadoId`, que es la columna Dosis del patient-desk).
3. El paquete.
4. La última conocida.

### 2. Si se imprime desde la sesión de LÁSER INTRAVENOSO, sale el producto del láser

La hoja es la misma («Vitamina C + láser IV») y se abre desde Acciones en las dos filas.

- Armado con la sesión de láser `59c1e43a-7298-4e5d-81ce-c4acca19cc3e`: cada bloque dice
  `valor: "LASER INTRAVENOSO - ENDO"`.
- Debería salir la dosis de Vit C elegida en la sesión de **Vit C** del mismo paciente ese mismo día.
- Si ese día no hay sesión de Vit C, se aplica la cadena de arriba sobre el servicio `vit_c`.

### 3. El texto de la dosis

- El legado imprime la dosis tal como se llama la opción elegida: «25g SUEROTERAPIA (E)».
- Hoy `shortDose` la reduce a «25g» cuando el producto no tiene `nombreCorto`.
- Si la opción del patient-desk tiene `nombreCorto`, se usa (eso ya es así). **El dueño decide si quiere el
  nombre completo**; mientras tanto, no cambiar nada aquí.

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
