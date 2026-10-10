# Handoff BE — HILT: falta traducir `patologia`; orden de filas no coincide con el formato homologado

## Contexto

El dueño reportó que los formatos impresos de Láser (HILT/MLS) "no están homologados" —no
coinciden con los dos formatos médicos aceptados (`.personal/formatos-legacy/HILT Form.pdf` y
`MLS Form.pdf`, exportados del sistema de referencia). Se verificó en vivo contra producción,
09/10-oct-2026, comparando cada fila y cada valor numérico de ambos PDFs contra
`GET /api/v2/laser/format/hilt` y `.../mls`.

## Lo que se encontró y YA SE ARREGLÓ del lado FE

**1. HILT devuelve `patologia` sin traducir (bug real, ya con workaround defensivo en el FE).**

`GET /api/v2/laser/format/hilt` — cada fila de `sections[].filas[]` trae `patologia`,
`frecuencia`, `tiempo`, `intensidad` en español, NO `pathology`/`frequency`/`duration`/
`intensity` como sí hace **MLS** (`GET /api/v2/laser/format/mls`, verificado: ahí SÍ llega
`pathology` correctamente traducido). El FE (`HiltTabla`/`MlsTabla` en
`components/frontdesk/formatos-modal.tsx`) siempre leyó `f.pathology` — para HILT eso es
`undefined` siempre, así que **el nombre de la patología salía en blanco en cada fila del
formato impreso**, en producción, hasta este fix. Es casi seguro la causa principal de "no está
homologado": los números de tratamiento quedaban sin su diagnóstico al lado.

Ya se aplicó un fallback defensivo en el FE (`f.pathology ?? f.patologia`,
`lib/api/laser.ts`/`formatos-modal.tsx`), así que **esto ya no bloquea**. Pero el arreglo real es
del lado BE: que `/laser/format/hilt` traduzca `patologia`→`pathology`,
`frecuencia`→`frequency`, `tiempo`→`duration`, `intensidad`→`intensity` igual que ya hace MLS
(mismo mapa `CAMPOS_EN_INGLES`, falta HILT ahí — ver el comentario ya existente en
`lib/api/laser.ts` sobre esta inconsistencia, confirmado ahora en vivo). Cuando esté, se puede
quitar el fallback del FE.

**2. Conteo y valores de filas: correctos, ya coincidían.** Verificado fila por fila: HILT trae
exactamente 10 regiones / 61 filas, MLS 16+16=32 filas, y **todos los nombres y valores numéricos
coinciden EXACTO con ambos PDF de referencia**. Esto NO es un problema de datos — el catálogo ya
está completo y correcto.

## Lo que falta — pide ajuste de datos del BE

**3. Orden de las filas dentro de cada región/columna: alfabético, no el orden clínico del
formato homologado.**

Ejemplo verificado (HILT, región Rachis): el PDF de referencia trae **Cervical Pain, Dorsal
Pain, Low Back Pain, Sciatic Pain, Muscle Lesion Acute Phase, Muscle Lesion Subacute Phase,
Contracture** (dolores primero, luego progresión de lesión muscular aguda→subaguda, contractura
al final). `GET /laser/format/hilt` hoy devuelve esa misma región **en orden alfabético**:
Cervical Pain, Contracture, Dorsal Pain, Low Back Pain, Muscle Lesion Acute Phase, Muscle Lesion
Subacute Phase, Sciatic Pain. Mismo patrón confirmado en MLS (columna derecha: PDF trae Rotator
Cuff Tear primero, el BE la alfabetiza).

El catálogo ya tiene campos pensados para esto (`orden`/`orden2` en HILT, `sortOrder`/
`itemOrder` en MLS) pero no están poblados con la secuencia real del formato homologado — todas
las filas de una misma región tienen el mismo `orden2`, así que lo que se ve hoy es el orden por
default de la consulta (alfabético), no un orden intencional.

**El pedido:** poblar `orden2`/`itemOrder` (o el campo que corresponda) de cada fila con su
posición real en el PDF de referencia, por región/columna — los dos PDF están en
`.personal/formatos-legacy/` de este repo (cmr-fe) para copiar el orden exacto fila por fila.

## No-scope

- No se toca el motor de render del FE (`HiltTabla`/`MlsTabla`) más allá del fallback de
  traducción ya aplicado — es puramente data-driven, soporta cualquier cantidad de
  secciones/filas sin cambios.
- No se piden nuevas columnas ni campos — el catálogo (`LaserParametro`) ya tiene todo lo
  necesario.

## Contexto adicional (ya resuelto, solo informativo)

El mismo pedido del dueño incluyó varios ajustes puramente visuales/de layout en el FE que **ya
se implementaron y no requieren nada del BE**: pie "Trigger Point: Sí/No" solo en HILT, pie "CTD"
solo en MLS, "Nº de terapias" ahora muestra la sesión real ("4/12") en vez de un cálculo de
días×áreas, y la gráfica "PAIN MEASUREMENT SCALE" (antes un campo numérico suelto, ahora la misma
imagen de referencia). Todo verificado en vivo contra producción con un paciente de prueba
desechable antes de este handoff.
