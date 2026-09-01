# El recibo térmico sale en miniatura (y la causa exacta)

> Handoff **FE**. Fecha: 2026-08-20. Reportado por el dueño con foto del papel y del diálogo de impresión
> (EPSON TM-T20II). Diagnóstico hecho sobre el CSS, no supuesto.

## Lo que se ve

El ticket se imprime diminuto en una esquina, con márgenes enormes a los lados, y en la vista previa
aparece un recibo pequeñito arriba a la izquierda de una hoja larga.

## La causa

`app/globals.css` (bloque `@media print` de `.recibo-print`) declara:

```css
.recibo-print { width: 80mm; padding: 2mm; }
@page { size: 80mm auto; margin: 2mm; }
```

Y el componente `components/facturacion/recibo-termico.tsx` monta el recibo con `w-[80mm]`.

El papel seleccionado en el diálogo es **`media.custom_71.97x296.97mm`**, es decir **72 mm**. Se pide una
página de 80 mm (más 2 mm de margen a cada lado ⇒ 84 mm de ancho solicitado) sobre un área imprimible de
72 mm: el navegador **escala todo hacia abajo** para que quepa, y eso es exactamente la miniatura.

Es el error clásico de las térmicas: **80 mm es el ancho del ROLLO, no el ancho imprimible**. En una
TM-T20II de 80 mm el área imprimible es ~72 mm (por eso el propio driver ofrece 71.97 mm).

## El arreglo

1. **Igualar la página al área imprimible, sin márgenes y con altura térmica:**

```css
@page { size: 72mm 297mm; margin: 0; }
.recibo-print {
  width: 72mm;
  padding: 0 2mm;          /* el aire va DENTRO, no como margen de página */
  box-sizing: border-box;
}
```

2. **Quitar el `w-[80mm]` del componente** y dejar que el ancho lo mande la hoja impresa
   (`w-full`/`w-[72mm]` según convenga en pantalla), para que no haya dos anchos peleados.
3. **Nada de `transform: scale(...)`** ni de "ajustar al área imprimible": si el ancho cuadra, no hay que
   escalar nada.
4. **Que el ancho sea DATO, no una constante.** Hay rollos de 58 mm (el propio diálogo ofrece un
   `media.custom_49.99mm`), y un centro puede cambiar de impresora. El ancho del papel debe salir de la
   configuración por centro —el motor de preferencias ya existe: `GET /me/preferences` →
   `effective`— con 72 mm como default del sistema. Se escribe una variable CSS
   (`--recibo-ancho: 72mm`) y `@page`/`.recibo-print` la usan. Ver
   `cmr-be/docs/specs/apariencia-personal-y-corporativa.md` para cómo se leen las capas.

## Cómo verificar (en papel, no en la pantalla)

- Imprimir el mismo recibo y comprobar que el texto ocupa **todo** el ancho del papel, sin franjas
  blancas a los lados y sin letra reducida.
- El diálogo debe seguir mostrando **1 hoja**, con el papel `71.97 x 296.97 mm` seleccionado.
- Repetir con un recibo largo (una factura con muchas líneas) para confirmar que la altura térmica no
  reduce el contenido y que el driver continúa manejando el papel continuo correctamente.
- Comprobar el otro formato que ya funcionaba (`.formato-print`, láser en carta) para no romperlo: los dos
  bloques `@media print` conviven en el mismo archivo.

## Cumple, como todo lo demás

Configurable sin hardcode (el ancho es dato por centro) · i18n intacto · no duplicar código (una sola
variable de ancho para `@page` y para el contenedor) · verificar en papel con `/qa`, no adivinar.


## Corrección (21-ago) — la causa de fondo, comprobada contra el legado

El dueño señaló que **su impresión del legado se ajusta sola a cualquier impresora**: cambia de impresora
y sale bien, sin tocar nada. Y que la nuestra sale bien en Chrome pero en **miniatura en Firefox**.

Se auditó el legado (`/htdocs/cma/vistas/invoservices/print.php` + `/htdocs/cma/css/print-styles.css`) y
el hallazgo es contundente. Su CSS de impresión **completo** es esto:

```css
@media print {
  header, footer { display: none; }
}
```

Nada más. **Sin `@page`, sin `size`, sin ancho fijo, sin márgenes, sin escalado.** Por eso se adapta: al
no declarar ninguna medida, el navegador usa el ancho del papel que el usuario eligió en el diálogo y el
contenido simplemente fluye dentro.

Nuestro recibo hace justo lo contrario: declara `width: 80mm` y `@page { size: 80mm auto; margin: 2mm }`.
Cuando ese tamaño no coincide con el papel real, el navegador **tiene que escalar** para encajarlo — y
Chrome y Firefox escalan con criterios distintos. De ahí que en uno se vea bien y en el otro diminuto. No
es un bug de Firefox: es que le estamos dando una medida que pelea con el papel.

### La recomendación cambia: no fijar el ancho, dejar que el papel mande

Antes se propuso «pon 72mm en vez de 80mm». Eso arregla UNA impresora y rompe la siguiente. Lo correcto
es lo que hace el legado:

```css
@media print {
  /* aislar el recibo: todo lo demás no se imprime */
  body > *:not(.recibo-print) { display: none; }
  .recibo-print {
    width: auto;          /* NO 80mm, NO 72mm: lo manda el papel */
    max-width: 100%;
    margin: 0;
    padding: 0;
    font-size: 9pt;       /* en PUNTOS: no depende del ancho de la pantalla */
  }
  /* sin @page size, sin transform: scale */
}
```

- Quitar el `w-[80mm]` del componente (`recibo-termico.tsx`) o dejarlo **solo para la vista en pantalla**,
  nunca para la impresión.
- Los anchos internos (columnas de la tabla) en **porcentaje**, no en milímetros ni píxeles.
- Tipografía en `pt` y no en `px`: es la unidad del papel.
- Si algún día un centro necesita forzar un ancho concreto, eso es **dato por centro** (ver el punto 4 más
  arriba), no una constante en el CSS — pero el default debe ser «lo que diga el papel».

### Cómo verificar (las dos, no una)

Imprimir el mismo recibo en **Chrome y en Firefox**, y con dos papeles distintos (el rollo de 80mm y el de
58mm si hay). Debe llenar el ancho en los cuatro casos, sin franjas blancas y sin letra reducida. Si hace
falta tocar el zoom del diálogo para que quepa, el CSS sigue mal.
