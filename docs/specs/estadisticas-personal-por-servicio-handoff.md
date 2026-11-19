# Estadísticas del personal por servicio — handoff FE (11-nov-2026)

Pantalla: **/reports/services** (informe de servicios: «Estadística General» + una pestaña por
servicio). Endpoint: `GET /api/v2/statistics/services?desde=YYYY-MM-DD&hasta=YYYY-MM-DD[&centerIds=…]`.
BE: PR #554. Spec: `cmr-be/docs/specs/estadisticas-servicios.md` (anexo 11-nov-2026).

## Qué pide el dueño

Las mismas cifras que las pestañas del legado `stastnursetec`, medidas desde nuestro modelo:
quién aplicó la terapia, cuántas visitas, cuántos pacientes distintos y **cuántas terapias**. En el
láser las terapias son las **áreas**, y en la Vit C son las **dosis**.

## Campos nuevos (comprobados en la respuesta real v2 de producción, Caguas agosto 2026)

Cada fila de `services[].roles[].rows[]` conserva sus campos (`posicion`, `personalId`, `nombre`,
`participaciones`, `pacientes`, `porcentaje`) y añade:

| campo | qué es |
|---|---|
| `therapies` | unidades aplicadas por esa persona: áreas en láser, dosis en Vit C, 1 por visita en el resto |
| `therapiesShare` | % de esas unidades sobre las del rol |

Además:

- `services[].roles[].therapies` y `services[].therapies` son los totales del rol y del servicio.
- `totals.therapies` es el total del periodo.
- `vitals` es un bloque nuevo, la pestaña «Vitales»: `{ takings, patients, rows: [{ position, staffId, name, takings, patients, share }] }`. Son los signos vitales tomados por cada enfermera en las citas médicas.

## Cómo se pinta cada pestaña (como el legado, más claro)

| # | Nombre | Visitas | Pacientes | Terapias | % |
|---|---|---|---|---|---|
| `posicion` | `nombre` | `participaciones` | `pacientes` | `therapies` | `porcentaje` (de visitas) |

- La columna **Terapias** se muestra en las pestañas donde algún `therapies` difiere de
  `participaciones`, como el láser o la Vit C. Si son iguales, sobra.
- La fila Total usa los totales del rol.
- Añadir una pestaña **Vitales** con el bloque `vitals`.
- Ojo con las etiquetas: lo que el legado llamaba «Pacientes #» eran **visitas**. Aquí van separadas:
  Visitas por un lado y Pacientes distintos por otro.
- Los textos van por i18n, nunca escritos en el código.

## Verificación

Caguas, agosto 2026, pestaña Láser. Tiene que coincidir con el legado:

| Técnico | Visitas | Terapias |
|---|---|---|
| Lara Sanchez | 145 | 561 |
| Paola Agosto C | 139 | 558 |
| Irvin Santana | 126 | 513 |
| Michael Gonzalez | 98 | 317 |
| Luis Guzman | 92 | 355 |
| Fabian Rodriguez | 92 | 435 |
| Richard Torres | 30 | 109 |
| Leiyani Jimenez | 9 | 36 |
| Eduardo Ortiz Rodriguez | 5 | 14 |
| Jonathan Rodriguez | 1 | 8 |
| **Total** | **737** | **2906** |

Comprobado en producción tras el despliegue (#554): las 10 filas del láser coinciden exactamente.
Nuestro total da 738/2910 porque añade una fila **«Sin asignar»** (1 visita, 4 áreas) que el legado
no muestra.
