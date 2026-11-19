# Handoff FE → BE — dos opciones nuevas en `render` de los formatos (`camposEnPares`, `subrayarValores`)

**Contexto:** el dueño pidió que el formato APEX (Radiofrecuencia, slug `apex_rf`) vuelva a verse
como el papel legado (`.personal/formatos-legacy/APEX Radio frecuencia.pdf`), revirtiendo el pedido
del 04-nov de amontonar Paciente/Record/Sesión/Fecha en una sola línea (`render.camposEnLinea`).

## Lo que ya se hizo (FE + datos, 06-nov-2026)

- El motor genérico (`components/frontdesk/formato-generico.tsx`) ya soporta un render de pares
  etiqueta/valor nuevo, `render.camposEnPares` (booleano): pinta una fila por CADA PAR de `fields`
  consecutivos, en el orden que mande el BE — es la rejilla de 2 columnas del legado. Helper puro y
  probado: `chunkPairs` en `lib/formatos/inline-fields.ts`.
- `apex_rf` ya tiene los `fields` reordenados y reetiquetados para que, en cuanto `camposEnPares`
  exista, las filas salgan Fecha|Nombre del paciente, Hora de entrada|Hora de salida, Sesión|Record —
  igual que el papel legado.
- `letterhead.center` (p. ej. "CMR Caguas") ahora se oculta junto con la línea de empresa cuando
  `render.ocultarEmpresa` es `true` (antes se imprimía igual, aunque el arquetipo diga "solo logo +
  título") — ya corregido, sin pedir nada al BE.
- La sección `firmas` de `apex_rf` ya tiene `estilo: "en_linea"`, `columnas: 1` y su propio
  `labelKey: "Firmas:"` → ya sale igual que el legado (una línea por firma, con su encabezado
  "FIRMAS:").

## Lo que falta — DOS valores de `render` que el BE rechaza hoy

Al intentar `PUT /formats/:id` con `render.camposEnPares: true` y `render.subrayarValores: true`, el
BE devuelve 400:

```
"render: opción de dibujo desconocida; las válidas son ocultarEmpresa, numerarFilas,
numerarComoFraccion, subtitulo, filasPorSesiones, prellenar, porPagina, notas, imagenEscalaDolor,
imagenCuerpo, paginas, areas, casillas, casillasEnFilas, tablasLadoALado, orientacion, logo,
marcasAgua, actualizacion, ocultarPie, camposEnLinea"
```

Se pide agregar **`camposEnPares`** (booleano) a esa lista — para que `apex_rf` (y cualquier otro
formato con header de tabla 2 columnas del legado) pueda usarlo.

**Aparte, hallazgo:** `subrayarValores` tampoco está en esa lista, pero el FE ya lo lee desde hace
tiempo (`components/frontdesk/formato-generico.tsx`, comentario: usado por el formato de Vit C para
subrayar el valor escrito sobre la línea, como el `.fill` del legado). O ya existe otro camino para
guardarlo que no pasa por esta validación, o quedó fuera de la lista por error — conviene agregarlo
también si se quiere usar en `apex_rf` (para que "14/08/2026", "6/12", "15213", el nombre, etc. salgan
subrayados como en el papel, no solo en texto plano).

## Cómo verificar al terminar

1. `PUT /formats/42119072-6d63-446e-a1aa-eb9edd8a6bb5` (apex_rf) con
   `render: { "ocultarEmpresa": true, "camposEnPares": true, "subrayarValores": true }` → 200, no 400.
2. `GET /formats/apex_rf/assembly?sessionId=<una sesión real>` y comparar el PDF impreso contra
   `APEX Radio frecuencia.pdf` — ya casi idéntico salvo el detalle de "Nombre del paciente" en el
   legado partiendo a una segunda línea cuando el nombre es largo (variación cosmética menor, no
   bloqueante).

## Respaldo

El valor anterior completo de `apex_rf` (antes de este cambio) está en
`.personal/backup-apex_rf-pre-06nov.json` (gitignored), por si hace falta revertir.
