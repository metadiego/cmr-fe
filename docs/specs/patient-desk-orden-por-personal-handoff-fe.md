# Frontdesk nuevo — al filtrar, los demás servicios se ordenan por quién los hace

**Fecha:** 2026-10-14 · **De:** BE → FE · **Pedido por:** el dueño (larciles)
· **Antecedente:** `8b4705f` (el servicio filtrado va primero en cada paciente).

## Qué pide el dueño

Hoy, al filtrar «Servicios» por uno (p. ej. PEMF), ese servicio sale **primero** en cada paciente,
a los dos lados (chips de la lista y detalle), y el resto queda en su orden configurado.

Ahora, debajo del filtrado, el resto se agrupa por **quién lo hace**:

1. el servicio filtrado;
2. los que hace **solo técnico**;
3. los que hace **solo enfermera**;
4. los que hacen **ambos** (técnico y enfermera);
5. los que no declaran ninguno (hoy no hay ninguno activo; van al final por si aparece).

Dentro de cada grupo se mantiene el orden configurado (`sortOrder`), como hasta ahora. Sin filtro,
nada cambia. Vale para cualquier servicio que se filtre: el orden de los grupos es siempre
técnico → enfermera → ambos.

## Lo que el BE ya sirve (verificado en producción, 14-oct, `GET /services`)

No hace falta nada nuevo del BE. Cada servicio trae sus dos marcas, que se cambian desde
Configuración → Servicios (son dato, no código):

| v1 | v2 | significado |
|---|---|---|
| `requiereTecnico` | `requiresTechnician` | lo hace un técnico |
| `requiereEnfermera` | `requiresNurse` | lo hace una enfermera |
| `orden` | `sortOrder` | orden configurado |

Hoy en producción: técnico = laser, emtt, pemf, ondas_choque, camara_energetica,
camara_hiperbarica, apex, bioresonancia · enfermera = vitc, intravenoso, bpc, transcraneal, nano,
glp1, avacen, rodilla, plaquex, empower, sermorelin, mots_c · ambos = npt, neurocatch.

## Dónde

`lib/frontdesk/patient-day.ts` → `filterByService`: hoy separa «el filtrado» y «el resto»; el resto
pasa a ordenarse por (grupo de personal, orden configurado). El grupo sale de las dos marcas del
servicio (`servicesById` en `use-patient-day.ts` ya tiene el `Servicio` completo; si
`PatientService` no lleva las marcas, añadirlas al construirlo en `groupByPatient`).

## Pruebas que pide

- Filtrando PEMF, un paciente con nano, npt, laser, pemf y vitc → `pemf`, `laser`, luego `nano` y `vitc` (entre ellos por `sortOrder`), y al final `npt`
  (técnico: laser · enfermera: nano, vitc · ambos: npt).
- Filtrando un servicio de enfermera, el orden de los grupos sigue siendo técnico → enfermera → ambos.
- Sin filtro, el orden no cambia (el original no se muta, como en el test de `8b4705f`).
