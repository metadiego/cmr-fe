# HANDOFF BE — `/auth/me` vuelve VACÍO para un perfil real (larcilesbay), rompe multi-centro

**Verificado por HTTP el 18-ago.** Un usuario real, aprobado y bien configurado (rol citas + doble centro)
inicia sesión correctamente, pero el BE **no resuelve su perfil en la sesión**: `/auth/me` responde `{}` y
`/auth/me/centros` responde `[]` (0). Con eso, el FE lo trata como "sin centro" y el selector de centro
multi-centro (que ya es data-driven en el FE) no tiene qué mostrar.

## El caso

Usuario del equipo de citas del call-center (agenda para Bayamón y Caguas):

- Email / auth: **larcilesbay@outlook.com** — login OK. `access_token.sub` (authUserId) =
  **`e3907bfc-87f7-4416-9e90-30a158ffeab7`**.
- En el admin (`GET /profiles`, con token de master) el perfil está perfecto:
  - profileId **`6c770179-4bf6-4ab5-8f45-d2d31a41dafa`**, estado **aprobado**,
  - rol **`citas`** (global, `centroId: null`),
  - centros asignados (base, activos): **CMR Bayamón** (`ef6f87b0-…`) y **CMR Caguas** (`5f98ef29-…`).

## Lo que falla (con el token del propio usuario)

```
GET /api/v1/auth/me           → {}            (esperado: su perfil, isMaster/accessMode, activeClinicId)
GET /api/v1/auth/me/centros   → []  (n=0)     (esperado: [CMR Bayamón, CMR Caguas])
```

El token es válido (200 al mintearlo, `sub` = e3907bfc-…). Así que el problema es la **resolución
sesión → perfil** en el BE: el `authUserId` `e3907bfc-…` no está enlazando con el perfil
`6c770179-…` (larcilesbay@outlook.com). Probable causa: el perfil se creó/aprobó con un `authUserId`
distinto del que hoy emite el login (usuario de auth recreado, o el vínculo `profiles.authUserId` quedó
apuntando a otro uid). No es del FE.

## Qué se pide

1. **Enlazar** el auth user `e3907bfc-…` con el perfil `6c770179-…` (o corregir el `authUserId` del
   perfil) para que `/auth/me` devuelva el perfil real de larcilesbay.
2. Que `/auth/me/centros` devuelva sus centros asignados (**Bayamón + Caguas**) — la fuente que usa el FE
   (`getMyCentros`) para el selector.
3. Verificar que NO haya perfiles duplicados/huérfanos para ese email (en `/profiles` aparece
   larcilesbay@outlook.com una sola vez, pero conviene confirmar el uid enlazado).

## Comprobación (la hará el FE, sin adivinar)

- Login `larcilesbay@outlook.com` → `GET /auth/me` devuelve el perfil (no `{}`), y `GET /auth/me/centros`
  devuelve **2** centros.
- En pantalla (agenda / pacientes / gate de facturación) aparece el **selector de centro con Bayamón y
  Caguas**, sin la opción «Todos los centros» (esa sigue siendo solo de admin/master). El FE ya lo hace
  data-driven; solo faltaban los datos de la sesión.

## Contexto

- El FE ya dejó: rol con interruptor `todosLosCentros` (PUT /roles/:id), asignación de rol global (sin
  centroId), y el selector de centro data-driven (se muestra con >1 centro, «Todos» solo admin). Todo eso
  funciona en cuanto `/auth/me/centros` devuelva los centros del usuario.
- El usuario de prueba anterior `citasbay@cmr.test` también daba `/auth/me` = {} — mismo síntoma de perfil
  no resuelto; vale revisar si es el mismo patrón de enlace roto.
