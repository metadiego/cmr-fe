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
