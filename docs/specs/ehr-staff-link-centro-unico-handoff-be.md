# Handoff BE — el vínculo personal↔EHR quedó guardado contra UN solo centro

**Fecha:** 2026-10-01
**De:** FE
**Relacionado:** `docs/specs/vincular-personal-con-el-ehr-handoff-fe.md`, PR #86 (FE, mergeado),
PR #87 (FE, mitigación — ver abajo)

## Lo verificado

Consultando `GET /ehr-integration/staff-links` en prod, en vivo, el 2026-10-01:

- Con `X-Tenant-ID` de **CMR Bayamón**: 17 vínculos reales (incluye personal de Caguas, p. ej.
  Glorimar Lebrón y Javier Lillo, que en `/personal` aparecen con `clinicId` de Caguas).
- Con `X-Tenant-ID` de **CMR Caguas**: 0 vínculos.
- Mandando `?centerIds=<bay>&centerIds=<cag>` bajo cualquiera de los dos tenants: los mismos 17,
  completos — el endpoint ya resuelve el permiso contra varios centros (mismo patrón que
  `GET /ehr-integration/config?centerIds=`), solo que todos los 17 están físicamente asociados al
  centro Bayamón en la fila de BD, sin importar el centro real de la persona.

## Lo supuesto (a confirmar por BE)

Quien provisionó estas 17 cuentas ayer (2026-09-30/10-01, fuera de este botón nuevo — el botón del
PR #86 mergeó hoy y nadie lo ha usado todavía) lo hizo con un único `X-Tenant-ID` fijo (Bayamón),
probablemente porque el proceso/script no iteraba por el centro real de cada persona. El resultado:
el campo que asocia el vínculo a un centro en la tabla de `staff-links` no refleja el centro real del
`personal`, sino el centro desde el que se ejecutó la provisión.

## Por qué importa

La cuenta del EHR es **de la persona**, no del centro — un(a) enfermero(a) no tiene dos cuentas de
EHR según en qué centro trabaje hoy. Guardar el vínculo contra el centro de alta, en vez de contra la
persona sola (o replicado a todos sus centros), hace que:

1. Cualquier pantalla que resuelva por un solo `X-Tenant-ID` (el caso normal, no el de este endpoint)
   vea a alguien como "sin vincular" aunque tenga cuenta real.
2. El próximo lote de provisión, si vuelve a correr con un tenant fijo, puede repetir el mismo problema
   para personal nuevo.

## Mitigación ya aplicada en el FE (PR #87)

La ficha de Personal ahora pide `/ehr-integration/staff-links` con `centerIds` = TODOS los centros
donde quien mira tiene `ehr-integration.read` (vía `/me/centros-donde-puedo`), no solo el centro
activo. Esto encuentra el vínculo sin importar bajo qué centro quedó guardado — pero es un parche de
lectura, no corrige el dato ni evita que se repita.

## Lo que se pide al BE

1. Confirmar si el modelo de datos actual asocia el vínculo a un `clinicId` por fila, y si ese campo
   tiene sentido de negocio (p. ej. "centro donde se provisionó" para auditoría) o es un residuo de
   que todo endpoint cuelga de un tenant por diseño general del sistema.
2. Si es lo segundo: evaluar si `staff-links` debería dejar de ser per-tenant y resolverse solo por
   `personalId` (la persona ya vive en un `clinicId` propio en `/personal`), delegando el control de
   acceso a `centerIds`/permisos como hace hoy el GET, sin que el campo exista por fila.
3. Revisar qué proceso creó estas 17 cuentas ayer (no fue el botón del FE) y si corre de nuevo,
   confirmar que itera por el centro real de cada persona — para que el personal nuevo no caiga en
   el mismo hueco.

No se tocó ningún dato en prod durante esta investigación (solo GETs).
