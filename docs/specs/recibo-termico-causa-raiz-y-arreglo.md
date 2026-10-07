# El recibo térmico: la causa raíz real (no era el navegador, ni el HTML, ni el CSS)

**Estado: verificado en papel, 7-oct-2026.** Semanas peleando con el corte del recibo (se comía las
últimas líneas, Firefox nunca abría el diálogo) no eran un problema de la página web. Era, primero, el
driver de la cola en el servidor; y segundo, un ajuste de ese driver puesto al revés. **La solución
final NO toca este repo** — es configuración del equipo que imprime. El FE solo abre `/print/invoice/:id`
en una pestaña nueva y la deja imprimirse sola con `window.print()`; nada más.

## Causa raíz #1 — la cola compartida tenía el driver de un CLON, no el de Epson

El equipo que comparte la impresora es una **Zorin OS 18.1** (Ubuntu 24.04) por red, con la Epson
TM-T20II conectada por USB. La cola CUPS que usa todo el mundo hoy (`TM-T20II`) tiene instalado el
driver de una **impresora clon genérica — "Zijiang ZJ-80"** (`printer-make-and-model='Zijiang ZJ-80'`,
filtro `rastertozj`) — no el de la Epson real. Epson **no publica un driver de Linux descargable** para
este modelo (solo SDKs de programador), así que esa cola nunca tuvo el driver correcto puesto.

Ese filtro genérico recorta/interpreta el trabajo a su manera antes de mandarlo a la impresora — por
eso ningún cambio de HTML/CSS podía arreglarlo, y por eso Chrome y Firefox se comportaban distinto (cada
uno compone la impresión de otra forma contra ese PPD raro).

**Se creó una cola nueva, sin filtro** (`TM-T20II-RAW`, en la Zorin) apuntando al mismo USB, para poder
probar sin ese filtro de por medio.

## Causa raíz #2 — el driver real de Epson SÍ estaba instalado, pero con dos ajustes al revés

El dueño ya tenía el **driver genuino de Epson para macOS** instalado (`EPSON TM-T20II` / filtro
`rastertotmt`, en `/Library/Printers/PPDs/`) — no era necesario bajar nada nuevo. El problema eran dos
ajustes de ESE driver, verificados leyendo su propio PPD:

- **`PageSize` en `Letter`** en vez de `RP80x297` (Roll Paper 80×297mm) — así el navegador/CUPS
  maquetaba cada recibo como una hoja carta completa.
- **`TmtPaperReduction` (Recorte de papel) en `Off`**. Esta opción es justamente la función del driver
  para recortar el blanco sobrante y simular un rollo de largo variable sobre una página de tamaño fijo
  (`RP80x297` es 297mm fijos, no infinitos — el PPD declara `VariablePaperSize: True` y
  `MaxMediaHeight` ~2m, pero el recorte automático es lo que lo hace valer). Con `Off`, cada recibo salía
  con ~290mm de blanco de más antes del corte (de ahí el "cortó 11 pulgadas más abajo de donde debía").

**Arreglo, verificado en papel:**
```
lpadmin -p <cola> -o PageSize=RP80x297 -o TmtPaperReduction=Bottom
```
Con la cola apuntando a `TM-T20II-RAW` (sin el filtro clon de por medio) y esos dos ajustes, el mismo
mecanismo de imprimir-por-navegador que ya existía **cortó pegado al texto, sin perder nada** —
confirmado por el dueño en vivo.

## Qué hacer en cada equipo que imprime (Windows incluido)

**Esto es configuración del sistema operativo / del driver de impresora, no del repo.** El FE no
necesita saber nada de esto — basta con que la impresora seleccionada tenga el driver real de Epson
bien ajustado. Para cada PC de mostrador (Windows):

1. Instalar el **driver oficial de Epson para Windows** si no está ya (Advanced Printer Driver, en
   `download-center.epson.com` o el medio que use esa PC — el genérico de Windows no sirve, igual que en
   macOS).
2. Apuntar esa impresora a la cola **`TM-T20II-RAW`** de la Zorin (sin filtro), no a la vieja `TM-T20II`
   (que sigue con el driver clon puesto).
3. En las propiedades de la impresora: tamaño de papel = **rollo 80mm**, y la opción equivalente a
   "Paper Reduction" / recorte de papel en blanco = **encendida** (el nombre exacto varía en el driver
   de Windows; es la misma idea que `TmtPaperReduction=Bottom` en macOS).
4. Dejarla como impresora **por defecto** de esa PC, para que `window.print()` la use sin que nadie
   tenga que elegirla.

## Lo que se descartó, y por qué sigue descartado

Se abandonó la ruta de QZ Tray + bytes ESC/POS crudos desde el FE (se probó, funcionó, pero exigía
instalar software en cada equipo además de mantener la cola limpia en el servidor — demasiada
infraestructura para este momento). Todo ese código se quitó del repo (commit `5558bd6`). **No reabrir
esa puerta**: la causa real era de configuración de driver, no algo que necesitara ESC/POS a mano.

## Lo que queda pendiente, y es de infraestructura, no de este repo

La cola vieja (`TM-T20II`, con el driver Zijiang) sigue existiendo en la Zorin. Una vez todos los
equipos de mostrador impriman por `TM-T20II-RAW` con el driver correcto, conviene retirar o corregir esa
cola vieja — administración del servidor, no de este repositorio.
