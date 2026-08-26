# Handoff BE → FE — Un usuario, un rol distinto en cada centro

**Fecha:** 2026-08-26 · **BE:** ya lo soporta, no hace falta nada nuevo · **Falta:** la pantalla

## El caso real

- **Edgardo** (`eortizcmda@gmail.com`): **Gerente en Bayamón**, **Facturador en Caguas**.
- **Waldemar** (`cmawaldemar@gmail.com`): Atención + Facturación + Inventarios **en Bayamón**, y
  **solo Facturación en Caguas**.
- **Un técnico** que unos días está en Bayamón y otros en Caguas: tiene que **aparecer en los dos a
  la vez**, sin que nadie le dé y le quite el acceso cada mañana.

Palabras del dueño: «no puedo estar dando y quitando los permisos… dar y quitar ese permiso es
tedioso».

## La solución ya existe en el modelo (no hay que inventar nada)

**El rol se guarda junto al centro.** `perfiles_roles` es `(perfilId, rolId, centroId)`, así que una
persona puede tener Gerente-en-Bayamón y Facturación-en-Caguas **al mismo tiempo**, y el sistema
aplica el que toca según el centro en el que esté trabajando.

Por persona hacen falta **dos cosas por centro**:

| Qué | Para qué | Endpoint |
|---|---|---|
| **Asignación** al centro | Que ese centro le aparezca en el selector y entre en su `allowedClinicIds` | `POST /profiles/:id/asignaciones` |
| **Rol acotado** a ese centro | Qué puede hacer **allí** | `POST /profiles/:id/roles` con `{ rolClave, centroId }` |

Sin la asignación, el rol no sirve: no puede entrar a ese centro. Sin el rol, entra pero no puede
hacer nada. **Las dos, siempre.**

### El técnico en los dos centros

Dos asignaciones **activas** (Bayamón y Caguas) y su rol `tecnicos` en cada una. Él elige el centro
del día en el selector; nadie le toca nada. Si un puesto trabajará **siempre** en los dos, existe
además el rol marcado «todos los centros» —hoy lo usan `citas` y `cc_operator`—: se asigna **sin
centro** (global) y vale para los dos. Ojo: un rol así **no se puede acotar** a un centro; el BE lo
rechaza con `rbac.rolMultiCentroNoSeAcota`, y es a propósito.

## Lo que hay que construir en el FE

Una pestaña **«Accesos por centro»** en la ficha del usuario. Una tabla, una fila por centro:

```
Centro          Activo   Roles en este centro                 
─────────────────────────────────────────────────────────────
CMR Bayamón      [✓]     Gerente ✕   [+ añadir rol]
CMR Caguas       [✓]     Facturación ✕   [+ añadir rol]
                         [+ añadir centro]

Roles en TODOS los centros:  Citas ✕   [+ añadir]
```

- **Añadir centro** → `POST /profiles/:id/asignaciones` con `{ centroId, tipo: 'base' }`.
- **El interruptor «Activo»** → `PUT /profiles/:id/asignaciones/:asigId` con `{ activo }`. Apagarlo
  le quita el centro sin borrar nada: es exactamente el «dar y quitar» pero de un clic, y sin perder
  la configuración de roles de ese centro.
- **Añadir rol en una fila** → `POST /profiles/:id/roles` con `{ rolClave, centroId }`.
- **Quitar rol** → `DELETE /profiles/:id/roles/:rolId?centroId=<uuid>` — **comprobado: sí distingue
  el centro**. Sin el parámetro quita el rol GLOBAL (el que no tiene centro), no el de la fila; si se
  olvida, a Edgardo se le quitaría el rol equivocado.
- **Sección aparte para los roles globales**: los que tienen `todosLosCentros: true` van **sin**
  `centroId`. Sepáralos visualmente y no ofrezcas acotarlos, porque el BE los rechaza.

`GET /roles` trae `clave`, `nombre` y **`todosLosCentros`** — con eso el selector de roles ya sabe en
qué sección va cada uno.

**Permisos de la pantalla:** leer con `rbac.read`, escribir con `rbac.update` (y `rbac.create` para
clonar). Ya no hace falta ser admin por nombre de rol: **basta con tener el permiso**, así que el
dueño puede dárselo a quien administre usuarios sin que sea administrador del sistema.

## Y el atajo que se acaba de construir

Para los puestos con **alta rotación** —citas, médicos, técnicos, enfermería— está el botón
**«Clonar de»**: se elige un compañero del mismo puesto y el nuevo queda con sus roles por centro,
sus excepciones, sus centros y su modo de acceso, de una vez. Detalle en
`clonar-acceso-de-usuario-handoff-be.md`.

Combinados, los dos resuelven el problema completo: la rotación se cubre clonando, y el caso
particular —el gerente que en el otro centro solo factura— se ajusta en esta tabla.
