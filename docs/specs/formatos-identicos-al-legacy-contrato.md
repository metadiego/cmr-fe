# Formatos idénticos al legacy — contrato FE↔BE (son modelos médicos: EXACTO)

**Exigencia del dueño:** cada hoja de impresión y cada formulación debe salir **exactamente igual** que el
legacy (`/Applications/MAMP/htdocs/cmr/app/Views/formats/`), no parecido. Son modelos médicos. Se imprimen
desde `http://192.130.80.2/cmr/frontdesk`, en la columna de **acciones** de cada tab.

Regla de oro: **el BE sirve la definición + los valores; el FE dibuja.** Para que salga idéntico, los DOS
tienen que hablar el MISMO contrato. Hoy el contrato (`FormatoArmado` en `lib/api/formatos.ts`) solo cubre
2 de los 7 arquetipos. Este documento fija el contrato completo y el reparto del trabajo.

Anclas: FE render `components/frontdesk/formatos-modal.tsx`; tipos `lib/api/formatos.ts`; legacy en la
carpeta de arriba. Verificado contra prod: el membrete ya trae `letterhead.logoUrl` real y hay 27 formatos
por centro (ya arreglado, commit 23ded1e).

## Los 7 arquetipos del legacy (todo el inventario cae en uno)

1. **Control de Sesiones (tabla pre-numerada).** Logo + nombre paciente + subtítulo; bloque Paciente/Record;
   a veces campos intermedios (PEMF/Cámara); tabla `# TERAPIA | FECHA | HORA | TECNICO…` con **N filas
   pre-numeradas 1..N**, la fila de la sesión actual **pre-rellenada** (fecha + enfermera); pie `f-b/`.
   Ej.: `common_form/pemf`, `avacen`, `bioresonancia`, `laser_transcraneal`, `apex_form`, `emtt_form`.
2. **Campos + OBSERVACIONES + firmas simples.** Header empresa+branch+título; campos
   `FECHA/NOMBRE/RECORD/SESION/DOSIS`; caja OBSERVACIONES grande; firmas `ENFERMERO(A)/HORA` y
   `FIRMA DEL PACIENTE`; pie `fecha 1/1` + `f-b/`. Ej.: `sueroterapia_vitc_form`, `bpc_form`, `plaquex_form`.
3. **Constancia de entrega.** Nombre empresa (26px) + título; campos con línea; **párrafo legal estático**
   ("Por este medio se hace constar…"); bloque entrega; **tabla de firmas con bordes** 2 col × (Nombre/Firma/
   Fecha) con cabecera gris. Ej.: `sermorelin_constancia_form`, `motsc_constancia_form`.
4. **Formato de procedimiento (tabla azul).** Logo (150×75) + título grande, **sin** texto de empresa; tabla
   `datos` 2-col; **tabla `proc` de cabecera azul `#5b9bd5`** y columna de descripción de color `#1f6fb2`
   con **filas de descripción pre-puestas** (RADIOFRECUENCIA / FORMA V… / VTONE / morpheus8 con **dos filas
   de cabecera**); líneas "Número de serie…"; OBSERVACIONES como **N líneas regladas** (apex_rf=6, empower_rf=5,
   morpheus8=4, vtone=8); firmas lista `Enfermero/Médico/Paciente`. Ej.: `apex_rf_form`, `empower_rf_form`,
   `empower_vtone_form`, `empower_morpheus8_form`.
5. **Lista de cotejo de enfermería.** Logo+título; datos; **tabla `chk` de cabecera oscura `#2b2b2b`**
   `Pregunta | Sí | No | Observación`, con **bandas de sección** (gris, colspan) y celdas de **casilla**; líneas
   de comentario; tabla de firmas; **pie de leyenda centrado** + `f-b/`. Ej.: `bpc157_enfermeria_form`,
   `glp1_adherencia_form`.
6. **Láser a color por sesión (multipágina).** Empresa+branch+título; **bloque repetido por sesión**: `SESION #`,
   tabla `FECHA | RED | GREEN | BLUE | YELLOW | INFRA | ULTRA` (nano_laser: solo FECHA) con 1 fila en blanco, 2
   cajas de notas grises, firmas; **2 sesiones por página, N páginas**, pie `f-b/` + `d-m-Y page/total`. Ej.:
   `intravenoso_form`, `sueroterapia_form`, `amnisome_laser`, `nano_laser`, `nano_laser_iv`.
7. **Láser HILT/MLS.** Ya tiene ruta propia en el FE (`/laser/formato/:tipo`). Tabla de pasos/energía con
   **filas de cabecera por área**; caja `Comentarios:`; rejilla clínica de pie; **imagen de escala de dolor**
   `pain_measurement_scale.png`; HILT = 2 páginas; MLS = dos tablas lado a lado + campo `CTD`. Ej.: `hilt_form`,
   `mls_form`.

**Outliers (órdenes médicas Rx, inglés/HIPAA, toman `$data`):** `peptide_rx_template`,
`tirzepatide_order_form`, `glp1_form` (imagen de diagrama corporal), `infiltracion_articular` (= nuestro
`rodilla`; confirmar en pantalla). Decidir si entran al render genérico o se tratan aparte.

## Lo que YA sale idéntico solo con que el BE mande bien la definición (arquetipos 1 y 2)

El FE ya dibuja fielmente lo que venga en `assembly`. Para estos NO hace falta tocar el FE, solo que el BE
emita:
- `fields[]` (clave, label en negrita, valor) en orden.
- `columns[]` de la tabla con sus labels.
- `rows[]` con el **número de filas** correcto y con lo pre-rellenado **ya cocinado por el BE**: el
  `# TERAPIA` numerado 1..N y la fila de la sesión actual con fecha/enfermera. **El FE no numera ni
  pre-rellena** — eso lo hornea el BE en `rows`.
- `sections[]` `texto_libre` (OBSERVACIONES, con `alto`) y `firmas` (líneas simples).
- `footer.prefix = "f-b/ "` + `user` + `fechaHora` → reproduce el pie legacy exacto.
- `letterhead.{center, logoUrl}`.

Cosméticos menores a cubrir igual en el FE: (a) **poder ocultar** la línea de empresa (arquetipos 1 y 4 no
la imprimen; hoy el FE la pone siempre — `formatos-modal.tsx:471`); (b) **subrayado de relleno** en campos
vacíos (hoy `span` vacío sin línea, :484).

## Lo que EXIGE código nuevo de render en el FE (no basta metadata) — arquetipos 3–7

Extender el contrato `FormatoSeccion`/`layout` con estos tipos nuevos y su render:
1. **`parrafo`** — texto estático (párrafo legal de la constancia). *(arq. 3)*
2. **`tabla_firmas`** — tabla con bordes, columnas configurables × filas (Nombre/Firma/Fecha), cabecera gris.
   Cubre constancia y `infiltracion_articular` (3 celdas). *(arq. 3)*
3. **`checklist`** — tabla `Pregunta | Sí | No | Observación`, bandas de sección (colspan) y celdas casilla. *(arq. 5)*
4. **tabla temática** — cabecera de color + columna de descripción de color + **filas de descripción
   pre-puestas** + soporte de **doble fila de cabecera** (morpheus8). *(arq. 4)*
5. **observaciones regladas** — N líneas en vez de una caja (parámetro `lineas`). *(arq. 4)*
6. **bloques por sesión + paginación** — repetir tabla+notas+firmas por sesión, 2 por página, pie `page/total`. *(arq. 6)*
7. **campos intermedios** — slot de campos entre título y tabla (PEMF/Cámara, Área, Número de serie). *(arq. 1,4)*
8. **láser: imagen de escala de dolor + caja `Comentarios` + `CTD` (MLS)** en la ruta láser. *(arq. 7)*
9. **casillas / selectores de tipo** (RADIAL/FOCAL en ondas de choque). *(arq. 4/6)*
10. **pie de leyenda secundario** centrado además del `f-b/`. *(arq. 5)*

Cada tipo nuevo se dibuja data-driven (nada hardcodeado por formato) y con su prueba de render.

## Reparto y orden sugerido

- **FE (este repo):** añadir los tipos 1–10 al contrato + render, con datos de muestra y pruebas; ocultar
  línea de empresa por flag; subrayado de relleno. Es lo que desbloquea que el BE tenga a dónde mandar.
- **BE (handoff):** una vez fijado el contrato, poblar la **definición de cada uno de los 27 formatos** con la
  estructura EXACTA del legacy (campos, columnas, nº de filas, filas numeradas/pre-rellenas, párrafos, firmas,
  colores, sesiones). Y crear los que falten: `nano_laser`, `nano_laser_iv`, `sueroterapia_form` (general),
  `peptide_rx_template`, `tirzepatide_order_form` (pendiente confirmación de uso del dueño).
- **Verificación:** cada formato se compara **en pantalla** contra su `.php` legacy antes de darlo por bueno.
  El `assembly` se ve entero por API; QA con navegador real (`/qa`).

## Decisión del dueño — RESUELTA (2026-09-19)

**Sí se siguen usando.** El dueño confirmó: `nano_laser`, `nano_laser_iv`, `sueroterapia_form` (la general,
distinta de Vit C), `peptide_rx_template` y `tirzepatide_order_form` **están en uso** → el BE los **crea igual
al legacy** (no los inventa: la estructura EXACTA está en su `.php`). Detalle en el handoff
`formatos-legacy-handoff-be.md`.
