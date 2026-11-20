# Handoff FE → BE: hoja de enfermería GLP-1 llenada en el iPad

Pedido del dueño (20-nov-2026): la hoja «Hoja de enfermería GLP-1 – toma de signos vitales y
seguimiento» (legado `glp1_adherencia_form.php`, ya sembrada como formato `glp1_adherencia`, arquetipo
5) se **llena en un iPad** y se **imprime igual que el papel**. Todo queda atado a **esa visita GLP-1**,
igual que las medidas.

## Lo que ya existe (verificado en el código de cmr-be)

- El formato `glp1_adherencia` está en `src/scripts/datos/formatos/arquetipo-5-listas-de-cotejo.ts`:
  campos `paciente`, `fecha`, `peso` (a mano), `ta` (a mano), `record`, `medicamento` (a mano), `dosis`
  (`sesion.dosis`), `semana` (a mano) y la sección `checklist` de 8 grupos.
- `GET /formats/glp1_adherencia/assembly?sessionId=` lo arma. Hoy lo que va «a mano» sale en blanco.
- La medida de báscula se enlaza sola a la visita GLP-1 del día (PR #509):
  `GET /body-measurements/sessions/:sessionId`.

## Lo que falta en el BE

### 1. Guardar las respuestas de una visita

```
GET  /api/v2/formats/glp1_adherencia/sessions/:sessionId/answers   → la hoja guardada, o 404
PUT  /api/v2/formats/glp1_adherencia/sessions/:sessionId/answers   → guarda (upsert)
```

Body / respuesta (claves en inglés; las de la pregunta salen del propio formato):

```json
{
  "fields": { "weight": "212.4", "bloodPressure": "120/80", "medication": "Tirzepatide",
              "currentDose": "5 mg", "treatmentWeek": "6" },
  "answers": [ { "group": 0, "question": 0, "value": "yes" | "no" | null, "note": "texto" } ],
  "additionalNotes": "texto libre",
  "nurseId": "<staff uuid>",
  "recordedAt": "2026-11-20T14:30:00-04:00",
  "updatedBy": "<user>", "updatedAt": "…"
}
```

- Las preguntas se identifican por **posición (grupo, pregunta)** del formato; si prefieren una
  `clave` estable por pregunta en la semilla, mejor: decídanlo ustedes y avisen.
- Permisos: leer = `formatos.read` (o el que usen para imprimir); escribir = uno de enfermería
  (propongan). Centro = el de la visita; el FE manda `X-Tenant-ID` y acepta `centerIds`.
- Guardar varias veces debe ser posible (la enfermera corrige). Auditoría de cambios como el resto.
- Comentario en DB en cada columna (estatutos).

### 2. Valores sugeridos para pre-llenar (en el mismo GET, aunque no haya nada guardado)

`GET …/answers` con 404 no sirve para pre-llenar: pedimos que devuelva siempre `200` con
`saved: false` y un bloque `suggested`:

- `weight`: de la medida de báscula enlazada a la visita (lb), si la hay.
- `currentDose`: la dosis de esta visita (`sesion.dosis`), o la **última dosis aplicada** al paciente
  en GLP-1 si esta no la trae.
- `treatmentWeek`: nº de semana del tratamiento GLP-1 del paciente (¿sesión n.º de su compra activa?
  ¿semanas desde la primera visita GLP-1? — decidan la fuente y documéntenla).
- `medication`: no hay fuente conocida → `null` (el FE lo deja editable). Si existe el producto
  vendido en la factura, mándenlo.
- `patient`: `{ id, name, record }`, `date` de la visita, y `nurse` sugerida (la enfermera asignada a
  la visita, si la hay).

Todos son **editables** en el iPad; lo que se guarde gana sobre lo sugerido.

### 3. Imprimir con lo guardado

`GET /formats/glp1_adherencia/assembly?sessionId=` debe rellenar con lo guardado:

- los campos `peso`, `ta`, `medicamento`, `dosis`, `semana`;
- en cada fila del `checklist`, la casilla Sí/No marcada y su observación (proponemos
  `preguntas[i].respuesta: "si" | "no" | null` y `preguntas[i].observacion`);
- el texto de «Observaciones adicionales»;
- el nombre de la enfermera y la fecha y hora en la línea de firmas (`lineas[i].valor`).

Sin nada guardado sale como hoy (en blanco).

### 4. Encontrar la visita desde el iPad

El iPad busca al paciente de tres maneras:

1. **Escaneando un QR** que genera el patient-desk. El FE lo resuelve solo: el QR lleva la URL
   `/forms/glp1/<sessionId>`. No hace falta nada del BE.
2. **Por nombre o récord.** Usa `GET /patients?q=` y luego las sesiones GLP-1 del día del paciente
   en el frontdesk, que ya existen.
3. **Lista de las visitas GLP-1 de hoy** en el centro, que ya existe en el frontdesk.

Si el BE tiene una forma mejor de pedir «las visitas GLP-1 de hoy», que lo diga.

## Lo que hará el FE (cuando esté el contrato)

- Pantalla `/forms/glp1/[sessionId]`, pensada para el iPad: botones grandes Sí/No y observación
  opcional por pregunta, campos de cabecera pre-llenados y editables, nombre de la enfermera, fecha y
  hora, y Guardar e Imprimir.
- Botón «QR hoja GLP-1» en la fila GLP-1 del patient-desk.
- Buscador para el iPad: QR, nombre o récord, y la lista de hoy.
- i18n es/en y lógica pura en `lib/` con tests.

## Preguntas abiertas para el dueño (no bloquean al BE)

- **Confirmado por el dueño (20-nov):** «solo observaciones» = tocar Sí/No y escribir la observación si
  hace falta. Una casilla se marca más rápido que escribir.
- ¿«T/A» (presión arterial) se escribe en el iPad? En el papel está, así que lo incluimos.
