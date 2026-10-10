> **RESUELTO por el BE, 10-oct-2026 12:40 AST — en producción (commit `4e98222`) y verificado por HTTP real (v2, los dos centros):**
>
> - **Cargados por la API** (`cargar-formatos-del-legado.ts`, `SOLO=`): `mia_glp1_order` y `mia_peptides_order` creados en
>   Bayamón y Caguas, `servicioClave: glp1`. Datos en `cmr-be/src/scripts/datos/formatos/ordenes-mia.ts` (tus JSON, tal cual,
>   salvo `fecha` → origen `sesion.fecha` y `labelKey: formato.campo.<clave>` en los campos de cabecera).
> - **GLP-1 los lista** en `formActions.reports[]` en los dos centros (ids `mia_glp1_order`, `mia_peptides_order`).
>   OJO: ambos tienen el MISMO `name` literal («Patient-Specific Compounded Sterile Preparation Order Form»); distínguelos por
>   su `labelKey` (`frontdesk.formato.mia_glp1_order` / `…mia_peptides_order`) en tus traducciones.
> - **Armado real** `GET /formats/:slug/assembly?sessionId=`:
>   - Caguas, sesión GLP-1 `a314bd63-…` (MARY LUZ CAMACHO LOPEZ): `layout: paginas`, `render.orientacion: horizontal`, logo,
>     `marcasAgua` 2 (GLP-1) / 1 (péptidos). Campos: name = MARY LUZ CAMACHO LOPEZ, date = 2026-10-10, phone = +17874234102,
>     address y diagnosis en blanco. Secciones GLP-1: tabla_tematica, lista_casillas ×2, parrafo, **salto_pagina**, campos,
>     parrafo ×2; péptidos: parrafo, tabla_tematica, lista_casillas, campos, parrafo ×2.
>   - Bayamón, sesión `90e519ad-…` (MARIBEL COLON PITRE): igual, phone +19392628726.
> - Lo nuevo que el BE acepta y devuelve sin filtrar: layout `paginas`; secciones `lista_casillas`, `salto_pagina`; render
>   `orientacion`, `logo`, `marcasAgua`, `actualizacion`, `ocultarPie`; origen `paciente.telefono` (el `paciente` del armado
>   trae ahora `telefono`); `campos[].ancho` número o texto CSS. Las claves dentro de las secciones viajan tal cual.
>
> **Pendiente:** tu verificación en pantalla contra los PDF y la prueba en papel del dueño.

# Handoff BE — Dos órdenes de Mía Compounding en GLP-1 (layout «paginas»)

**De:** FE · **Para:** cmr-be · **Fecha:** 2026-10-10 · **Prioridad:** alta (el dueño las pidió para GLP-1).

## Qué son

Las dos «Patient-Specific Compounded Sterile Preparation Order Form» de Farmacia Mía que el dueño dejó en
`cmr-fe/.personal/nueva orden de inyectables*.pdf` (actualización 29/7/26), hoja **horizontal**:

| slug | qué | hojas | marca de agua |
|---|---|---|---|
| `mia_glp1_order` | Semaglutide / Tirzepatide + base clínica, revisión de seguridad, atestación; hoja 2: datos del prescriptor y avisos regulatorios | 2 | salmón, una por hoja |
| `mia_peptides_order` | BPC-157, BPC+TB-500, Tesamorelin, GHK-Cu, MOTS-C, NAD+, Sermorelin | 1 | gris claro |

**Las definiciones completas, transcritas palabra por palabra, están listas para cargar:**
`cmr-fe/docs/specs/mia-order-forms/mia_glp1_order.json` y `mia_peptides_order.json`
(claves en español dentro de las bolsas opacas, como el resto de formatos: `campos`, `secciones`, `render`).

## Lo que ya hizo el FE (en producción con este commit)

- Nuevo `layout: "paginas"`: hoja por hoja, con el logo del formulario (`render.logo`), una marca de agua
  a página completa por hoja (`render.marcasAgua[i]`, la última se repite), `render.orientacion:
  "horizontal"`, la nota `render.actualizacion` abajo a la izquierda y `render.ocultarPie` (opcional;
  por defecto el f-b/ sale como en todos). Cada hoja se ajusta sola para que nada se corte al imprimir.
- Secciones nuevas: `lista_casillas` (☐ por ítem, con `opciones` en línea, `blanco` = raya para llenar,
  `intro`, `enLinea`) y `salto_pagina`.
- Opciones nuevas en secciones existentes: `tabla_tematica.tamano` / `colorBorde` y `cabecera[].ancho`
  (ancho de columna, p. ej. `"28%"`); `campos.etiquetaNormal` / `tamano` y `campo.ancho`;
  `parrafo.tamano` / `negrita`.
- Imágenes en el FE: `/img/formatos/mia/logo-mia-compounding.png`, `wm-glp1-p1.png`, `wm-glp1-p2.png`,
  `wm-peptides.png` (reconstruidas de los PDF; la gris, que en el escaneo casi no se ve, se rehízo
  calzando la figura limpia de la versión a color).
- Verificado en el navegador con una vista previa local de los dos JSON (las 3 hojas caben, marcas de
  agua y logo en su sitio). **No** verificado aún contra el armado real del BE: falta que existan.

## Lo que se pide

1. **Registrar los dos formatos** con esas definiciones (`slug`, `title`, `layout`, `render`, `campos`,
   `secciones`) y **asignarlos a GLP-1**: que aparezcan en `servicio.formAcciones.reports[]` del servicio
   GLP-1 (en los dos centros), igual que los demás formatos.
2. **Que el armado (`GET /formats/:slug/assembly`) devuelva tal cual** las claves nuevas de las bolsas
   opacas (`render.*`, `tamano`, `colorBorde`, `ancho`, `etiquetaNormal`, `negrita`, `intro`, `enLinea`,
   `items`, `blanco`, `opciones`) y los tipos nuevos `lista_casillas` y `salto_pagina`, sin filtrarlos.
3. **Resolver los campos de cabecera** (`campos` del formato → `fields` del armado) con su `origen`:
   `paciente.nombre` → Name, `fecha` → Date, `paciente.telefono` → Phone. Address y Diagnosis van en blanco
   (`origen: ""`), igual que los datos del prescriptor en la hoja 2 / pie.
4. Si el BE valida `layout` contra un enum, añadir `"paginas"`.

## Verificación que pide el FE

`GET /api/v2/formats/mia_glp1_order/assembly` y `…/mia_peptides_order/assembly` con una sesión de GLP-1
de prueba (respuestas copiadas aquí), y que GLP-1 liste los dos en sus acciones del frontdesk.
