# RESPUESTA BE — `/auth/me` de larcilesbay: RESUELTO, y no era el enlace del perfil (18-ago)

**Ya funciona en producción.** Comprobado con el token real de `larcilesbay@outlook.com`, **sin**
mandar `X-Tenant-ID`, que es como entra el navegador:

```
GET /api/v1/auth/me          → 200
   perfil: larcilesbay@outlook.com | roles: ['citas'] | activeClinicId: null | allowedClinicIds: 2
GET /api/v1/auth/me/centros  → 200
   - CMR Bayamon
   - CMR Caguas
```

## Corrección del diagnóstico

El handoff apuntaba a que el `authUserId` no enlazaba con el perfil. **No era eso**: el enlace estaba
bien, comprobado en la base de producción —

```
perfiles.id 6c770179-4bf6-4ab5-8f45-d2d31a41dafa
authUserId  e3907bfc-87f7-4416-9e90-30a158ffeab7   ← el mismo `sub` del token. Coincide.
asignaciones: Bayamón + Caguas, ambas activas y vigentes.
```

Y no hay perfiles duplicados ni huérfanos para ese email (el otro, `citasbay@cmr.test`, es un perfil
distinto con su propio uid; el mismo síntoma tenía la misma causa).

## Lo que pasaba de verdad: un círculo vicioso

Reproducido con su propio token:

```
GET /auth/me                        → 409  «An active clinic must be selected (X-Tenant-ID header)»
GET /auth/me/centros                → 409  (y es la lista con la que se elige el centro)
GET /auth/me  + X-Tenant-ID puesto  → 200  perfil OK, rol citas, sus 2 centros
```

> Para elegir centro hay que saber cuáles tiene → para saber cuáles tiene hay que haber elegido centro.

El 409 es una defensa deliberada (un perfil con varios centros que opera sin centro activo leería PHI
de los dos a la vez) y **no se ha tocado**. Lo único mal era aplicarla a las dos rutas que no leen datos
de negocio sino la identidad de quien pregunta. El cliente recibía el 409 y lo interpretaba como «este
usuario no tiene centros», lo contrario de la verdad.

## Qué se cambió

Un decorador nuevo, **`@SinCentroActivo()`** — opt-in y explícito, como `@Public()` o
`@AllowPending()` — puesto **solo** en `GET /auth/me` y `GET /auth/me/centros`. En esas dos rutas, con
varios centros y sin header:

- no se lanza 409;
- **`activeClinicId: null`** — esa es la señal de «elige uno»;
- **`allowedClinicIds`** viaja completo, que es lo que alimenta el selector.

### Lo que NO cambió (fijado con tests de regresión)

- Cualquier endpoint de negocio sin centro elegido → **sigue dando 409**. Esto no abre ninguna vía para
  leer datos sin centro.
- Un `X-Tenant-ID` que el perfil no tiene → **403**, también en estas rutas.
- Un perfil con **un solo** centro sigue quedando fijado a ese centro, sin header.
- El portal gerencial (solo lectura, varios centros) no se altera.

## Qué puede comprobar el FE ahora

1. Login `larcilesbay@outlook.com` → `/auth/me` **200** con su perfil y `allowedClinicIds` = 2, y
   `/auth/me/centros` = **Bayamón + Caguas**. Sin header.
2. `activeClinicId: null` → pintar el **selector de centro** (sin «Todos los centros», que sigue siendo
   solo de admin/master).
3. Al elegir uno, mandar `X-Tenant-ID` en el resto de las llamadas, como hasta ahora.
4. `citasbay@cmr.test` debería comportarse igual: mismo patrón, misma causa.

Spec y plan: `docs/specs/sesion-sin-centro-elegido.md`, `docs/plans/sesion-sin-centro-elegido.md`.
