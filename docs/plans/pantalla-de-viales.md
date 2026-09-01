# Plan — Pantalla de viales (cmr-fe)

Spec: `docs/specs/pantalla-de-viales.md`.

1. **Cliente de API** (`lib/api/inventario.ts`): `getReporteViales(params, tenant)` y el tipo de la
   respuesta. No duplicar tipos que ya existan.
2. **Lógica pura + TDD** (`lib/inventario/viales.ts` + `.test.ts`): el formato de `45 de 60 mg`, el texto
   del nivel, y cómo se agrupan los consumos por día para la tabla. El porcentaje NO se recalcula.
3. **Componente del frasco** (`components/inventario/frasco.tsx`): SVG con relleno proporcional, que
   funciona en claro y oscuro y no depende de imágenes.
4. **Pantalla** (`app/(app)/inventario/viales/page.tsx`): selector de producto y almacén, inventario
   visual, detalle de consumos con filtros, y los históricos colapsados.
5. **i18n** es/en.
6. **Menú**: pedir al BE el ítem `inventario-viales` con permiso `inventario.read` (es dato del catálogo
   de menú, que vive en el BE).
7. `/review` antes de mezclar; `/qa` con navegador real comparando contra el legado.
