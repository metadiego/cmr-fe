# Tests del frontend: por dónde empezar

Estado medido el 3-sep-2026: **11 ficheros de test para 238 páginas y componentes**, y los once
prueban lógica de `lib/`. La cobertura no es mala por pequeña, es incompleta por dónde está: lo que
falta es justo lo que cuesta dinero cuando falla.

## Lo que ya está probado (y está bien elegido)

`caja/totales`, `caja/export`, `inventario/viales`, `inventario/ajuste`, `facturacion/grupos`,
`frontdesk/search`, `format/fecha`, `theme/mezclar-capa`, `tablero/column-blocks`,
`nav/nav-groups`, `servicios/bulk-diff`. Son funciones puras: se prueban rápido y no piden
navegador. Ese es el patrón a seguir.

## Por dónde seguir, en este orden

**1. `lib/factura/` — cero tests, y es el dinero.** Antes de nada, lo que calcula un total:
   - Un descuento por monto nunca deja la línea en negativo, y uno igual a la base la deja en cero.
   - El impuesto compuesto (IVU 11.5% = 10.5% estatal + 1% municipal) suma exactamente el total,
     y el desglose por línea cuadra con la cabecera al céntimo.
   - El flete suma al total y NO lleva impuesto.
   - Un ítem exento no aporta impuesto aunque su producto sea gravado.

**2. `lib/frontdesk/` — 4 ficheros, 1 con test.** Lo que decide qué se descuenta:
   - La dosis de la fila manda sobre la del producto al descargar.
   - Un kit anidado abre todos sus niveles, no solo el primero.
   - Marcar asistido descuenta disponibilidad Y inventario; desmarcarlo lo devuelve.

**3. La búsqueda de paciente, ahora que el backend la arregló.** Que la pantalla mande lo escrito
   TAL CUAL: sin partirlo, sin quitarle guiones, sin recortarlo. El backend ya parte por palabras y
   normaliza el teléfono; si el frontend lo "limpia" antes, vuelve a romperse.

**4. Los componentes de las tres pantallas que se usan cada día** (facturación, frontdesk, caja),
   y solo lo que decide algo: qué botón se habilita, qué columna se pinta, qué se manda al backend.
   No hace falta probar que un div se renderiza.

## Cómo, sin montar nada nuevo

Ya hay corredor: `npm test` usa `node --test` con TypeScript nativo, y el patrón actual es
`lib/**/*.test.ts`. Para los componentes habrá que ampliar ese patrón y añadir un renderizador;
mientras eso no exista, **toda la lógica que decide algo debería vivir en `lib/` y probarse allí** —
que es exactamente por lo que los once tests actuales fueron fáciles de escribir.

## Y lo que no hace falta probar aquí

Los permisos: el backend los comprueba en cada endpoint y eso no depende de la pantalla. Basta con
probar que la pantalla pinta lo que el backend autoriza (ver
`accesos-los-decide-el-frontend.md`).

Backend: `docs/plans/assessment-fixes-roadmap.md`, fase 7 (I-11).
