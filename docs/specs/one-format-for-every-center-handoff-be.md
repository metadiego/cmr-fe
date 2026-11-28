# Handoff FE → BE: UN solo formato para todos los centros (BUG, 28-nov-2026)

El dueño, el 28-nov: «debe ser un solo formato para ambos, lo único que cambian son los datos. Eso es un gran
BUG».

## El bug

Hoy cada formato es **una fila por centro**: 33 en Bayamón y 33 en Caguas, cada una con su `fields`, `sections`
y `render`. Cuando se corrige el diseño de una hoja en un centro, el otro se queda con la versión vieja, y
nadie se entera hasta que una enfermera imprime.

**Comprobado en prod el 28-nov** (`GET /api/v2/formats` en los dos centros, comparando todo salvo
`id/clinicId/createdAt/updatedAt`):

### `terapia_vitamina_c_laser_iv`: en Bayamón no salía la dosis

- **Causa:** el 7-nov (cmr-be 1b1902ca) `render.sessionFields` se puso solo en Caguas.
- **Estado:** ya igualado a mano por el FE con `PUT /formats/0777a780…` (Bayamón).

### `apex_rf`: cada centro tiene un diseño distinto

| | Bayamón (4-nov) | Caguas (6-nov) |
| --- | --- | --- |
| `render` | `camposEnLinea: [paciente, record, sesion, fecha]`, `ocultarEmpresa` | `camposEnPares`, `subrayarValores`, `ocultarEmpresa` |
| `fields` / `sections` | también difieren | también difieren |

**Igualado el 28-nov:** el dueño eligió Caguas. Su versión se copió a Bayamón por PUT. La de Bayamón queda
guardada en `docs/backups/formats/apex_rf-bayamon-before-2026-11-28.json`, por si resultara ser la buena.

### Los otros 31 formatos

Son iguales hoy, pero solo por casualidad.

Tras los dos arreglos, los 33 formatos son idénticos en los dos centros (comprobado el 28-nov). La migración
ya no debería encontrar diferencias.

## Lo que se pide

1. **Una sola definición por formato** (`slug`, título, `fields`, `sections`, `render`, layout), **global**, sin
   `clinicId`.
2. **Lo único que es del centro son los DATOS:**
   - el membrete: logo, nombre, dirección;
   - los valores del paciente o la sesión;
   - si el formato está activo en ese centro, cuando haga falta.
3. **El armado** (`/formats/:slug/assembly`) combina la definición global con los datos del centro de la sesión.
4. **Migración:**
   - funde las filas por centro en una;
   - para cada `slug` con diferencias, se para y lo informa en vez de elegir sola (el 28-nov ya no queda ninguno).
5. **El editor de formatos** (`PUT /formats/:id`) cambia la definición única: un cambio sale en todos los centros
   a la vez.

## Lo que hace el FE cuando el BE lo publique

- El modal de Formatos y el editor solo leen `GET /formats` y el armado.
- Si el contrato de lectura no cambia, el FE no toca nada.
- Si cambia, el FE se adapta en el mismo día.

## Verificación

- `GET /api/v2/formats` con `X-Tenant-ID` de Bayamón y con el de Caguas devuelve el mismo `id` y la misma
  definición para cada `slug`.
- Al editar un formato, el cambio aparece impreso en los dos centros.
