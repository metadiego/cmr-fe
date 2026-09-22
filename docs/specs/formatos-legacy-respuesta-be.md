# Formatos idénticos al legacy — respuesta del BE

**Para:** cmr-fe. **De:** cmr-be. **Fecha:** 2026-09-19.
Responde a `formatos-legacy-handoff-be.md` y al contrato `formatos-identicos-al-legacy-contrato.md`.

## 1. Son CUATRO formatos nuevos, no cinco (verificado en el fuente)

`sueroterapia_form.php` **no** es la sueroterapia general. Leído en el `.php`:

- `sueroterapia_vitc_form.php` → `<title>Sueroterapia Vit C</title>`, arquetipo 2 → es nuestro
  **`terapia_vitamina_c`**.
- `sueroterapia_form.php` → `<title>Sueroterapia Vit C con Laser Intravenoso</title>`, arquetipo 6,
  dos sesiones por página → es nuestro **`terapia_vitamina_c_laser_iv`**, que ya existía.

Creados de verdad: `nano_laser`, `nano_laser_iv`, `peptide_rx_template`, `tirzepatide_order_form`.
`infiltracion_articular` es nuestro `rodilla`, ya con PREPARACIÓN / CENTRIFUGACIÓN / OBSERVACIONES y
su tabla de firmas de tres celdas.

## 2. Lo que el BE ya emite (desplegado)

El `assembly` sale igual que antes **más** esto:

- `membrete.ocultarEmpresa: boolean` — true en los arquetipos 1 y 4.
- `filas[]` **ya cocinadas**: el contador `# TERAPIA` numerado 1..N y la fila de la visita de hoy
  rellena. Ojo al detalle del legado: en `pemf.php` la rejilla imprime **una fila por sesión del
  paquete** (no un número fijo), y lo que rellena en la columna de enfermera es **`user_name`, quien
  imprime**, no la enfermera de la sesión. Se copió tal cual.
- `sesiones[]` + `porPagina: 2` cuando `layout: "sesiones"`. Cada bloque es
  `{ sesion: "3/12", fecha, notas: ["", ""] }`. Las dos cajas grises del legado van **vacías**: son
  para escribir a mano, no llevan texto.
- `render` con lo declarativo del papel: `imagenEscalaDolor`, `paginas: 2` (HILT), `areas` (las diez
  de HILT), `tablasLadoALado: 2` (MLS), `casillas: ["RADIAL","FOCAL"]` (ondas de choque),
  `casillasEnFilas` (las dos órdenes Rx).

Tipos de sección aceptados y servidos, exactamente los del contrato: `parrafo`, `campos`,
`tabla_firmas`, `checklist`, `tabla_tematica`, `leyenda`, `texto_libre` (con `estilo: "caja" | "lineas"`)
y `firmas`.

## 3. Dos cosas que el FE tiene que resolver de su lado

1. **La imagen de la escala de dolor.** El BE la manda como ruta:
   `render.imagenEscalaDolor = "/img/pain_measurement_scale.png"`, que es la del legado. El asset
   tiene que existir en el FE (o decidlo y lo subimos al storage y os mando una URL absoluta).
2. **Casillas en las órdenes Rx.** `peptide_rx_template` y `tirzepatide_order_form` son tablas de
   opciones que se marcan a mano: cada fila lleva un ☐ delante. Viajan como `tabla_tematica` con
   `render.casillasEnFilas: true`. Es el punto 9 de vuestra lista (casillas/selectores).

## 4. Cómo verlo

`GET /api/v1/formatos` (o `/formats`) lista los del centro; `GET /api/v1/formatos/{clave}/armado`
(o `/assembly`) devuelve el documento entero. Con `?sesionId=` sale con paciente, récord, fecha y la
fila de hoy; sin él, en blanco.

## 5. Lo que falta, y es de los dos

Cada formato se compara **en pantalla** contra su `.php` antes de darlo por bueno. Son 31. Cuando
tengáis el dibujo de los tipos nuevos, hacemos la pasada juntos y el que salga mal se reporta por su
clave y con la sesión con que se probó.
