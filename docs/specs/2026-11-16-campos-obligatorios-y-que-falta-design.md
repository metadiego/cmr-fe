# Campos obligatorios (*) y «qué falta» sobre los botones deshabilitados — diseño

Fecha: 2026-11-16 · Estado: propuesto · Repo: `cmr-fe`

## Por qué

16-nov-2026, Bayamón: una recepcionista no podía agendar desde «Programar citas» y se reportó como
falta de permisos. No lo era: «Agendar y seguir» / «Agendar y cerrar» estaban deshabilitados porque
no había elegido una **hora** (`canBook` exige `!!time`, `therapy-day-scheduler.tsx`). Nada en la
pantalla decía eso de forma visible. Un botón gris que no explica por qué está gris se lee como
«el sistema no me deja», y eso termina en un ticket de soporte.

## Objetivo

En **todo** modal, sheet y diálogo de la app (y en los formularios de pantalla que tengan el mismo
problema, como el programador de terapias):

1. Cada campo obligatorio lleva un `*` rojo junto a su etiqueta.
2. Cuando el botón principal (guardar/enviar/agendar) está deshabilitado porque faltan datos, una
   línea pequeña **encima** de los botones dice cuáles: *«Para continuar, completa: Hora · Paciente»*.
3. Todo esto sale de **componentes compartidos**: se estandariza lo más posible, no se repite.

## No-objetivos

- No se introduce una librería de formularios (react-hook-form, zod). Cada formulario ya decide su
  validez a mano; este trabajo hace esa decisión **visible**, no la reescribe.
- No se cambia ninguna regla de negocio ni ningún endpoint. Lo que hoy es obligatorio sigue
  siéndolo y nada nuevo pasa a serlo.
- No se rediseñan los diálogos más allá de etiquetas, pie de botones y la línea de lo que falta.

## Anti-objetivos (lo que lo haría un fracaso aunque «funcione»)

- **Una línea que miente.** Si el botón está gris por otra cosa (se está guardando, no hay
  permiso, una regla lo bloquea) y la línea dice «falta X», es peor que no decir nada. La lista de
  lo que falta y el `disabled` deben salir **de la misma fuente**, nunca de dos cálculos que puedan
  divergir.
- Un `*` en un campo que el backend no exige, o al revés.
- Texto en español hardcodeado en JSX (rompe el catálogo inglés).
- Archivos que crecen por encima de su techo en `DEBT`.

## Lo que hay hoy (verificado en `main`, 16-nov)

- ~100 archivos abren `DialogContent` / `SheetContent` / `AlertDialogContent` (63 usan
  `DialogFooter`/`SheetFooter`, 22 son `AlertDialog`, 18 `Sheet`), con ~250 `disabled={…}` entre
  todos (no todos son botones de enviar).
- `components/kit/form-dialog.tsx` ya tiene `FormDialog` (título, campos, Cancelar/Guardar con
  `submitting` y `canSubmit`) y `Field` (etiqueta + hijo + `hint`). Lo usan 15 archivos, casi todos
  en `components/configuracion`.
- 17 archivos tienen su **propia copia** local de `Field`/`FieldRow`/`Lbl`; 5 de ellas ya pintan el
  `*` (`cita-modal`, `sesion-modal`, `cita-form-sheet`, `paciente-form-sheet`, `amp-editor-sheet`),
  cada una a su manera. `paciente-form-sheet` además muestra una leyenda «* Campos obligatorios»
  (`clientes.form.requiredLegend`).
- No hay librería de formularios: cada componente calcula su `canSubmit`/`canBook`/`valid`.

## Enfoques considerados

1. **Kit compartido + lista de faltantes declarada por cada formulario (elegido).** Se extiende
   `components/kit/form-dialog.tsx`: `Field` gana `required`, aparece un `FormFooter` con la línea de
   lo que falta y los botones, y `FormDialog` lo usa. Cada formulario declara qué falta con un
   helper puro, y de esa lista sale también el `disabled`. Trabajo archivo por archivo, pero cada
   cambio es pequeño, revisable y deja el formulario más corto.
2. **Introducir react-hook-form + zod y derivar todo del esquema.** Daría `*` y faltantes «gratis»,
   pero obliga a reescribir ~100 formularios con estado propio: riesgo alto en agenda, caja y
   facturación por un beneficio que el enfoque 1 obtiene sin tocar la lógica. Descartado.
3. **Solo un tooltip en el botón deshabilitado.** Barato, pero un botón `disabled` no recibe hover
   ni foco en todos los navegadores, no existe en pantallas táctiles (los iPads de recepción), y el
   usuario pidió explícitamente una etiqueta visible encima. Descartado.

El dueño eligió el 1 y pidió estandarizar al máximo con componentes compartidos.

## Diseño

### Piezas compartidas (en `components/kit/`, junto a `FormDialog`)

- **`RequiredMark`**: el `*` rojo (`text-destructive`, `aria-hidden`) más un texto solo para lectores
  de pantalla («obligatorio» / «required»).
- **`Field`** (el existente) gana `required?: boolean` → pinta `RequiredMark` tras la etiqueta y pone
  `aria-required` en el control cuando se le da `htmlFor`. Reemplaza las 17 copias locales.
- **`MissingHint`**: `missing: string[]` (etiquetas ya traducidas) y opcional `reason?: string`.
  - `missing` no vacío → *«Para continuar, completa: A · B»* (icono de información, texto `xs`
    atenuado, alineado con los botones).
  - `missing` vacío y `reason` dado → muestra `reason` tal cual (p. ej. «Esa hora no cabe»). Sirve
    para los bloqueos que no son un campo, sin mentir.
  - Ninguno → no renderiza nada (ni espacio).
  - Tiene `id`; el botón principal lo referencia con `aria-describedby`.
- **`FormFooter`**: el pie estándar = `MissingHint` encima + fila de botones (Cancelar + principal,
  más botones extra opcionales a la izquierda). Recibe `missing`, `reason`, `submitting`,
  `onSubmit`, `onCancel`, etiquetas. El principal queda `disabled` si
  `submitting || missing.length > 0 || blocked`. Funciona dentro de `DialogFooter`, `SheetFooter` o
  suelto (el programador de terapias no está dentro de un `DialogFooter`).
- **`FormDialog`** pasa a usar `FormFooter` y acepta `missing`/`reason`. `canSubmit` se mantiene por
  compatibilidad con los 15 usos actuales y se migra después a `missing`.
- **`RequiredLegend`**: «* Campos obligatorios», reutilizando la clave existente movida a `common`.
  Se muestra en formularios con **3 o más** campos obligatorios; en uno de 1–2 campos sobra.

### La lista de lo que falta: una sola fuente

- `lib/forms/missing.ts`: `missingFields(checks: Array<[label: string, ok: boolean]>): string[]`,
  puro y con tests (`node --test`). Cada formulario escribe una vez:
  ```ts
  const missing = missingFields([
    [t("patient"), !!paciente],
    [t("services"), sel.size > 0],
    [t("hour"), !!time],
  ]);
  ```
  y de ahí salen **a la vez** la línea y el `disabled`. Prohibido mantener un `canSubmit` aparte que
  repita las mismas condiciones.
- Donde la regla tiene peso (agenda, frontdesk, facturación, caja), la función que arma esos checks
  vive en `lib/<área>/` con su test, según la regla 5 del `CLAUDE.md`.
- Lo que no es un campo (se está guardando, sin permiso, la hora no cabe, regla de negocio) **no**
  entra en `missing`: va a `submitting` o a `reason`.

### Textos (i18n)

Claves nuevas en `common` (en `es.json` y `en.json` a la vez):
`common.form.missingPrefix` («Para continuar, completa:» / «To continue, fill in:»),
`common.form.required` («obligatorio» / «required», para lectores de pantalla),
`common.form.requiredLegend` (se mueve aquí la existente). Las etiquetas de cada campo reutilizan
las que el formulario ya muestra.

### Aspecto

```
┌─ Reagendar cita ─────────────────────────────── ✕ ┐
│ Doctor *        [ Elegir…            ▾]           │
│ Fecha *         [ 18 nov 2026         ]           │
│ Motivo *        [                      ]          │
│                                                   │
│ * Campos obligatorios                             │
│            ⓘ Para continuar, completa: Doctor · Motivo │
│                         [ Cancelar ] [ Reagendar ] │
└───────────────────────────────────────────────────┘
```

En móvil la línea ocupa el ancho completo, encima de los botones apilados.

## Despliegue por tandas (un PR cada una, en este orden)

1. **Kit + agenda/frontdesk**: piezas compartidas, `lib/forms/missing.ts` con tests, y los
   diálogos de `components/agenda`, `components/citas`, `components/frontdesk` y el programador de
   terapias (el caso de Bayamón).
2. **Pacientes**: `components/clientes`, `components/pacientes`.
3. **Facturación / caja**: `components/facturacion`, caja, cobros.
4. **Configuración / admin**: `components/configuracion`, `components/admin` (incluye migrar los
   15 usos de `FormDialog` de `canSubmit` a `missing`).
5. **Todo lo demás**: inventario, comunicaciones, formatos, servicios, etc.

Cada tanda empieza con un inventario de sus archivos (qué diálogos, qué botón principal, qué campos
obligatorios y de dónde sale cada uno), y elimina las copias locales de `Field` de su área.

## Cómo se decide qué es obligatorio

La verdad es la condición de `disabled` que el formulario ya tiene hoy: si el botón no se habilita
sin X, X es obligatorio y lleva `*`. Cuando el frontend deja enviar algo que el backend rechaza
(DTO con `@IsNotEmpty` y el FE no lo exige), se anota en el inventario de la tanda y se decide caso a
caso. No se cambia en silencio.

## Ampliación: el armazón estándar del diálogo (decidido por el dueño, 16-nov)

Un recuento sobre los ~100 diálogos (`main`, 16-nov) mostró más partes hechas a mano en cada
archivo. Entran en este mismo trabajo, en las mismas tandas, para que cada diálogo se migre **una
sola vez**:

| # | Pieza | Hoy | Qué hace |
|---|---|---|---|
| 1 | `useSubmit(fn, { success?, closeOnSuccess? })` en `lib/forms/` | 71 archivos con estado `busy`, 74 con `try/catch` + `toastError` | Devuelve `{ submitting, submit }`. Evita el doble envío, muestra el toast de éxito opcional y el error con `toastError`, y cierra si se pide. `FormDialog` **no deja cerrar** (Esc, ✕ o clic fuera) mientras `submitting`; hoy solo 4 diálogos lo hacen. |
| 2 | `useDialogForm(initial, open)` | 47 limpian a mano en `onOpenChange`, 4 con un efecto | Estado del formulario que vuelve a `initial` cada vez que el diálogo se abre. Acaba con los datos de la vez anterior que se cuelan. |
| 3 | `useConfirm()` + `ConfirmHost` | 22 `AlertDialog` de confirmación hechos a mano, 7 `window.confirm` | Confirmación con promesa: `if (await confirm({ title, description, destructive })) …`. Se generaliza el patrón de `components/confirm-action-host.tsx` (que sigue sirviendo a los 428 del BE). Los 7 `window.confirm` desaparecen (no se traducen, no siguen el diseño y bloquean el navegador). |
| 4 | `Field error` + `FormError` | 42 archivos con su propio texto de error | Error de un campo bajo su control; error general encima del pie. Aquí van los «lleno pero inválido» de este diseño. |
| 5 | `FormDialog size="sm/md/lg/xl"` y cuerpo con scroll | 11 anchos distintos, 42 con `overflow-y-auto` propio | Cinco tamaños fijos (`sm`, `md`, `lg`, `xl`, `2xl`; el último para los diálogos anchos de hoy, `max-w-5xl`). El cuerpo hace scroll y el pie (con la línea de lo que falta) queda **siempre visible**. Hay una variante `FormSheet` para los `Sheet`. |
| 6 | Enter envía | Solo 4 diálogos | `FormDialog` escucha Enter en el cuerpo (`onKeyDown`) y envía cuando el botón principal estaría habilitado. **No** se usa un `<form>`: `components/ui/button.tsx` no fija `type`, así que todo `<Button>` dentro de un `<form>` sería un submit nativo y enviaría el diálogo. Enter no envía en `textarea`, en un combobox abierto (buscador de paciente) ni durante composición de texto (IME). |
| 7 | Etiqueta «Guardando…» | `loading`, `saving` y `guardando` mezclados | Vive en `FormFooter` (`common.saving`), con un override opcional. |

Fuera de alcance: el aviso de «cambios sin guardar». Solo lo tiene 1 diálogo y en mostrador estorba.

Las piezas de lógica (`missingFields`, el reductor de `useSubmit`, `useDialogForm`, la cola de
`useConfirm`) se escriben como funciones puras en `lib/forms/` con tests, porque la regla 2 del
`CLAUDE.md` solo ejecuta tests que estén en `lib/`.

## Formularios que hoy validan al hacer clic (decidido por el dueño, 16-nov)

Algunos diálogos (muchos en facturación y caja) dejan el botón **habilitado** y avisan con un
toast o un error después del clic. **Se convierten todos** al estilo nuevo: el botón queda
deshabilitado hasta que estén los campos obligatorios, y la línea dice qué falta. Esto amplía la
regla de «Cómo se decide qué es obligatorio»: también es obligatorio lo que la validación al hacer
clic exige hoy. Es un cambio visible: el inventario de cada tanda marca estos formularios aparte
para revisarlos con más cuidado. La validación al hacer clic se mantiene como red de seguridad si
cubre algo que no es un campo vacío (pasa a `reason` o se queda como está).

## Decisiones tomadas tras la revisión (llamadas del autor; el dueño las puede corregir)

- **`reason` no deshabilita.** Es solo texto. El botón se deshabilita por `missing`, `submitting` o
  un prop aparte `blocked?: boolean` para los bloqueos que **ya existen hoy** y no son un campo
  (sin permiso, etc.). Cuando hay `blocked`, debería ir acompañado de un `reason`. Ningún
  formulario gana un bloqueo que no tenía: el programador sigue dejando agendar una hora que no
  cabe, con su aviso como hoy.
- **Un campo lleno pero inválido no está «faltando».** Monto ≤ 0, email mal escrito o fin antes que
  inicio van a `reason`, con su propio texto («El monto debe ser mayor que 0»). Nunca dicen
  «completa: X». Para «A o B», el `*` va en los dos y la entrada en `missing` es una sola, «A o B».
- **Varios botones principales.** `FormFooter` acepta `actions`: uno o más botones principales que
  comparten `missing`/`blocked` (p. ej. «Agendar y seguir» + «Agendar y cerrar»). `onCancel` es
  opcional; sin él no hay Cancelar. Un botón secundario con condiciones propias (p. ej. «Programar
  una serie del tren») va en `extra` con su propio `disabled`, y no entra en la línea de lo que
  falta.
- **Alcance de pantallas.** Entran todos los `Dialog`/`Sheet`/`AlertDialog` con un botón de enviar,
  más el programador de terapias. Los formularios de página completa (tablero de frontdesk,
  pantalla de factura, etc.) **no** entran en estas tandas. Si se quieren, se especifican aparte.
- **`therapy-day-scheduler.tsx`** está en 598 líneas y no figura en `DEBT`, así que la tanda 1 lo
  divide antes de añadirle nada.

## Lo que queda al implementador

- La forma exacta de los props de `FormFooter` para botones extra (p. ej. «Programar una serie del
  tren» en el programador).
- Los `AlertDialog` de confirmación sin campos (borrar, cancelar sin motivo) no necesitan nada: se
  dejan como están. Los que piden un motivo sí entran.
- Bajar los techos de `DEBT` cuando un archivo grande encoja al borrar su `Field` local.
