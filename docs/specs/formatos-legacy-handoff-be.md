# Handoff BE — formatos de impresión IDÉNTICOS al legacy

**Para:** cmr-be. **De:** cmr-fe. **Fecha:** 2026-09-19.
**Contexto y contrato completo:** `formatos-identicos-al-legacy-contrato.md` (léelo primero).

**Exigencia del dueño (no negociable):** cada hoja debe salir **exactamente igual** que el legacy. Son
**modelos médicos**. La fuente de verdad es `/Applications/MAMP/htdocs/cmr/app/Views/formats/*.php`. No
inventar estructura: replicar la del `.php`. Se imprimen desde el frontdesk, columna de **acciones**, en
todos los tabs.

**Reparto:** el BE sirve **definición + valores** en `GET /formats/{slug}/assembly`; el FE **dibuja**. Ya
NO basta el contrato actual: cubre 2 de 7 arquetipos. El FE está añadiendo los tipos de sección nuevos
(abajo); **el BE debe emitirlos con esta forma exacta** para que el FE los pinte.

Ya resuelto (verificado en prod, FE commit 23ded1e): membrete con `letterhead.logoUrl` real (nuevo
`PUT /centers/:id`), y 27 formatos por centro (creados `laser_hilt`, `laser_mls`, `motsc_constancia`).

---

## 1. Formatos que FALTAN — el dueño confirmó que SE USAN → CREARLOS igual al legacy

| slug legacy | qué es | archetipo | legacy `.php` |
|---|---|---|---|
| `nano_laser` | Nano Láser | 6 (láser por sesión) | `nano_laser.php` |
| `nano_laser_iv` | Nano Láser intravenoso | 6 | `nano_laser_iv.php` |
| `sueroterapia_form` | Sueroterapia GENERAL (distinta de Vit C) | 6 | `sueroterapia_form.php` |
| `peptide_rx_template` | Orden Rx de péptidos (New Era) | outlier Rx | `peptide_rx_template.php` |
| `tirzepatide_order_form` | Orden Rx Tirzepatide | outlier Rx | `tirzepatide_order_form.php` |

`infiltracion_articular` del legacy **es nuestro `rodilla`** — confirmar en pantalla que coinciden (campos
+ PREPARACIÓN/CENTRIFUGACIÓN + OBSERVACIONES + tabla de firmas de 3 celdas).

---

## 2. Lo que el BE debe emitir por arquetipo

### Arquetipos 1 y 2 — YA los dibuja el FE; solo faltan datos correctos
- `fields[]` en orden, con label y valor.
- `columns[]` con labels.
- `rows[]` con el **nº de filas correcto** y **ya cocinado por el BE**: el `# TERAPIA` numerado 1..N y la fila
  de la sesión actual con fecha/enfermera pre-rellenadas. **El FE NO numera ni pre-rellena.**
- `sections[]`: `texto_libre` (OBSERVACIONES, con `alto`) y `firmas` (líneas simples).
- `footer.prefix = "f-b/ "` + `user` + `fechaHora` (reproduce el pie legacy exacto).
- `letterhead.{center, logoUrl}`; y **`letterhead.ocultarEmpresa: true`** en arquetipos 1 y 4 (no llevan la
  línea "CENTRO DE MEDICINA REGENERATIVA").

### Tipos de sección NUEVOS (el FE los añade; emitir con ESTA forma)
Todos van dentro de `sections[]`, en orden de aparición. `tipo` es el discriminador.

```jsonc
// Párrafo estático (constancia: "Por este medio se hace constar…")
{ "tipo": "parrafo", "texto": "…" }

// Campos intermedios (PEMF/Cámara, Área, Número de serie): fila(s) de label/valor entre título y tabla
{ "tipo": "campos", "campos": [ { "clave": "pemf", "labelKey": "…", "valor": "" } ] }

// OBSERVACIONES: caja (por defecto) o N líneas regladas
{ "tipo": "texto_libre", "titulo": "OBSERVACIONES", "estilo": "caja", "alto": 10 }
{ "tipo": "texto_libre", "titulo": "Observaciones", "estilo": "lineas", "lineas": 6 }

// Firmas simples (línea + label debajo) — YA existe
{ "tipo": "firmas", "lineas": [ { "labelKey": "ENFERMERO(A)" }, { "labelKey": "HORA" } ] }

// Tabla de firmas con BORDES (constancia / infiltración): columnas × filas, cabecera gris opcional
{ "tipo": "tabla_firmas",
  "columnas": [ "Entregado por", "Recibido por" ],
  "filas": [ "Nombre", "Firma", "Fecha" ],
  "cabecera": true }

// Lista de cotejo de enfermería (bandas de sección + casillas Sí/No/Observación)
{ "tipo": "checklist",
  "columnas": { "pregunta": "Pregunta", "si": "Sí", "no": "No", "obs": "Observación" },
  "grupos": [ { "titulo": "Sección A",
               "preguntas": [ { "texto": "¿…?" } ] } ] }

// Tabla temática (procedimiento): cabecera de color, columna de descripción de color, filas pre-puestas.
// `cabecera` admite 1 o 2 filas (morpheus8 = 2). `filas` son las descripciones ya puestas; `filasEnBlanco`
// añade filas vacías para rellenar a mano.
{ "tipo": "tabla_tematica",
  "colorHeader": "#5b9bd5", "colorDescCol": "#1f6fb2",
  "cabecera": [ [ { "clave": "desc", "label": "" }, { "clave": "e1", "label": "Energía" } ] ],
  "filas": [ { "desc": "RADIOFRECUENCIA" } ],
  "filasEnBlanco": 0 }

// Pie de leyenda secundario centrado (además del f-b/) — arquetipo 5
{ "tipo": "leyenda", "texto": "Centro de Medicina Regenerativa (CMR) · …" }
```

### Arquetipo 6 — láser a color POR SESIÓN, multipágina
Nuevo `layout: "sesiones"` con bloques repetidos y paginación (2 sesiones/página):
```jsonc
{ "layout": "sesiones",
  "porPagina": 2,
  "sesiones": [
    { "sesion": 1,
      "tabla": { "columnas": ["FECHA","RED","GREEN","BLUE","YELLOW","INFRA","ULTRA"], "filasEnBlanco": 1 },
      "notas": [ "…", "…" ],
      "firmas": [ { "labelKey": "ENFERMERA(O)" }, { "labelKey": "HORA" } ] }
  ],
  "pie": { "prefix": "f-b/ ", "paginado": "d-m-Y page/total" } }
```
`nano_laser` = solo columna `FECHA`. `nano_laser_iv`, `sueroterapia_form`, `amnisome_laser`,
`intravenoso_form` = las 7 columnas de color.

### Arquetipo 7 — HILT/MLS (ruta láser propia `/laser/formato/:tipo`)
El FE añade: **imagen de escala de dolor** (`imagenEscalaDolor: "<url>"`, legacy
`pain_measurement_scale.png`), caja **`Comentarios`**, y campo **`CTD`** en MLS. HILT = 2 páginas con
**filas de cabecera por área** (Rachis/Shoulder/Knee/Oedema · Elbow/Hip/Wrist/Pelvic/Ankle/Foot). Emitir
esas filas de sección y el flag de 2 páginas.

---

## 3. Asignación formato → arquetipo (los 27 + los que faltan)

- **Arq. 1 (tabla pre-numerada, `ocultarEmpresa`):** `pemf`/control_sesiones, `avacen`, `bioresonancia`,
  `laser_transcraneal`, `apex_form`, `emtt_form`.
- **Arq. 2 (campos + OBSERVACIONES + firmas):** `sueroterapia_vitc_form`, `bpc_form`, `plaquex_form`.
- **Arq. 3 (constancia: `parrafo` + `tabla_firmas`):** `sermorelin_constancia_form`, `motsc_constancia`.
- **Arq. 4 (tabla temática azul, `ocultarEmpresa`, obs `lineas`):** `apex_rf_form`, `empower_rf_form`,
  `empower_vtone_form`, `empower_morpheus8_form` (cabecera de 2 filas).
- **Arq. 5 (`checklist` + `leyenda`):** `bpc157_enfermeria_form`, `glp1_adherencia_form`.
- **Arq. 6 (`layout:"sesiones"`):** `intravenoso_form`, `sueroterapia_form`, `amnisome_laser`,
  `nano_laser`, `nano_laser_iv`.
- **Arq. 7 (láser HILT/MLS):** `laser_hilt`/`hilt_form`, `laser_mls`/`mls_form`.
- **Outliers Rx (inglés/HIPAA, `$data`):** `peptide_rx_template`, `tirzepatide_order_form`, `glp1_form`
  (imagen de diagrama corporal), `infiltracion_articular`/`rodilla`. Definir si entran al genérico o van por
  una ruta aparte; el FE dará forma según lo que el BE proponga aquí.

---

## 4. Verificación (obligatoria antes de dar por bueno cada uno)
Cada formato se compara **en pantalla** contra su `.php` legacy. El `assembly` se ve entero por API; QA con
navegador real. Si uno sale mal, se reporta **cuál** y con qué sesión.

## 5. Estado FE
El FE construye los tipos de sección/layout nuevos (con datos de muestra + pruebas de render) contra este
mismo contrato. En cuanto el BE emita cada definición, sale idéntico sin más cambios de FE.
