# Hoja del cuadre por email: diseño igual a la hoja impresa — handoff FE → BE

**Fecha:** 2026-11-06 · **Pedido por:** el dueño · **Prioridad:** alta. Sus palabras: «ese cuadre llega horroso».

## Qué pasa

El correo de #478 llega bien, pero el HTML y el PDF los arma `cash-sheet-email.ts` con un aspecto de
borrador:

- tablas con `border="1"` y cabeceras grises;
- números sin alinear;
- una sola columna;
- las firmas como `______` en línea.

La hoja impresa del FE ya está diseñada y aprobada, y el correo tiene que verse **igual**.

## Referencia exacta (FE, en producción)

- `components/caja/cuadre-detalle.tsx` → `PRINT_CSS` y `buildPrintHtml()`.
- `lib/caja/product-sales-print.ts` → la sección «Venta de productos (IVU)».

## Diseño que se pide

1. **Cabecera centrada:** el nombre del centro en grande y en negrita (22 px, 800); debajo, «Cuadre de
   caja — División · fecha» en gris (13 px).
2. **Títulos de sección:** 11 px, negrita, MAYÚSCULAS, espaciado .08em, gris #666, con una línea fina
   debajo (#ddd).
3. **Tablas sin bordes de celda:**
   - cabeceras de 9 px en mayúsculas, gris #888;
   - filas separadas por una línea muy fina (#f0f0f0);
   - números alineados a la derecha, en fuente monoespaciada y con formato $1,234.56;
   - las filas de total en negrita, con una línea superior de 2 px.
4. **El resumen y el conteo de efectivo lado a lado:** dos columnas, para aprovechar el papel.
5. **Diferencia:** fila final en negrita con una línea de 2 px negra.
6. **Avisos:** la exoneración en ámbar (borde #d9a441, fondo #fdf6e8); las devoluciones y los
   descuadres en rojo #b3261e.
7. **Venta de productos (IVU):**
   - la tabla de partidas, con la columna «IVU que tocaba»;
   - el IVU cobrado por componente, con una columna por componente que salga de los datos;
   - TODAS las facturas, con su fila de totales;
   - la conciliación.
8. **Firmas:** dos bloques al pie, con una línea superior y el nombre centrado debajo («Cajero» y
   «Gerente / Supervisor»). Que no sean guiones bajos.
9. **Papel:** carta, márgenes de 16 mm. Tiene que **llenar la hoja**: nada de una franja estrecha con
   aire a los lados.

## Cómo

- **HTML del cuerpo:**
  - estilos en línea, porque Gmail descarta `<style>` en parte;
  - tablas con `width="100%"`;
  - las dos columnas del punto 4 como una tabla de dos celdas;
  - fuente del sistema: Helvetica o Arial.
- **PDF:** pdfmake se puede quedar, pero con estilo.
  - Tablas: un `layout` propio, sin líneas verticales, con `hLineWidth` 0.5 y color #eee, y 2 en los
    totales.
  - `alignment: 'right'` en los números y `columns` para el bloque lado a lado.
  - Estilos con nombre para la cabecera y los títulos de sección, y los mismos colores.
  - Alternativa más fiel: generar el PDF desde el mismo HTML con Chromium headless, si cabe en la VM.
- La fuente de los números es la misma de la pantalla, sin recalcular nada.

## Verificación

- Un correo real de Caguas del 5-nov a larciles@ que se vea como la hoja impresa del FE, tanto el cuerpo
  como el PDF.
- Adjuntar la captura a la PR.
