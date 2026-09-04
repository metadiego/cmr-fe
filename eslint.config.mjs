import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * El tamaño de los ficheros, como una regla que FALLA.
 *
 * `frontdesk-board.tsx` (2.582 líneas) y la pantalla de una factura (2.274) llevan meses señaladas
 * por escrito en el assessment y han seguido creciendo en cada informe. Un fichero de dos mil
 * líneas no se revisa: se hojea. Y son justo los dos sitios por donde pasa el dinero.
 *
 * `TECHO` es para lo que nace hoy. `DEUDA` son los que ya eran grandes, con su tamaño actual como
 * máximo: esa lista **solo puede menguar**. Al partir un componente se baja su número o se borra la
 * línea. Añadir una entrada nueva es admitir deuda y va hablado, no colado en un commit de paso.
 *
 * El lint BLOQUEA en CI (`.github/workflows/ci.yml`), así que esto no es un consejo.
 */
const TECHO = 600;

const DEUDA = {
  "components/frontdesk/frontdesk-board.tsx": 2582,
  "app/(app)/billing/invoices/[id]/page.tsx": 2274,
  "components/inventario/productos-admin.tsx": 1048,
  "components/configuracion/menu-editor.tsx": 700,
  "components/servicios/servicios-admin.tsx": 686,
  "components/agenda/dia-view.tsx": 644,
  "components/auditoria/auditoria-log.tsx": 643,
  "components/admin/rbac-settings.tsx": 615,
  "components/clientes/paciente-form-sheet.tsx": 609,
};

const maxLines = (max) => ({
  "max-lines": ["error", { max, skipBlankLines: false, skipComments: false }],
});

/**
 * Las rutas de Next van llenas de `(grupos)` y `[params]`, que en un glob NO son texto: `[id]` es
 * una clase de caracteres y `(app)` un grupo. Sin escaparlos, el techo de
 * `app/(app)/billing/invoices/[id]/page.tsx` no casaba con nada y el fichero de 2.274 líneas se
 * medía contra el máximo general — un techo que existe pero no se aplica es el peor de los dos
 * mundos, porque parece que está puesto.
 */
const comoGlob = (ruta) => ruta.replace(/[()[\]]/g, (c) => `\\${c}`);

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generado por `npm run gen:api` desde el OpenAPI del backend: son ~19.700 líneas que
    // nadie escribe a mano y que se regeneran enteras.
    "lib/api/schema.d.ts",
  ]),
  // El orden importa: en flat config gana el ÚLTIMO bloque que casa. Primero el techo general,
  // luego las exenciones y por último la deuda con su techo propio.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "hooks/**/*.{ts,tsx}"],
    rules: maxLines(TECHO),
  },
  {
    // Primitivas de shadcn copiadas al repo y regeneradas por su CLI: su tamaño no lo decidimos
    // nosotros, así que medirlo solo daría ruido.
    files: ["components/ui/**"],
    rules: { "max-lines": "off" },
  },
  ...Object.entries(DEUDA).map(([file, max]) => ({
    files: [comoGlob(file)],
    rules: maxLines(max),
  })),
]);

export default eslintConfig;
