# Handoff FE — pacientes de otro centro, y un solo selector cuando sobra el segundo

Fecha: 02-nov-2026. BE: `cmr-be` PR #442 (`docs/specs/pacientes-de-otro-centro.md`).

## Qué expone el BE

- `GET /patients?centerIds=a,b` — los pacientes de esos centros en vez del de la sesión. Cada centro
  exige `pacientes.read` **en él**. Si no hay ninguno autorizado, 403 `CENTROS_NO_AUTORIZADOS`; si
  solo algunos, se acota a esos.
- `GET /patients/:id?centerIds=…` — la ficha, con la misma regla. Fuera de los centros autorizados
  sigue siendo 404.
- Sin `centerIds`, todo igual que antes.

**Orden**: el BE tiene que estar desplegado antes. Con `forbidNonWhitelisted`, un `centerIds` que
llegue a un BE sin este cambio devuelve 400.

## Qué hace el FE (PR #114)

1. **Una sola regla para los selectores de centro** (`lib/screen-center.ts`, con tests). El selector
   de la pantalla se oculta cuando no añade nada al de la barra superior: la barra se enseña (más de un
   centro operativo), cubre todos los centros de la pantalla y está en uno de ellos. Entonces la
   pantalla sigue a la barra. Quien no puede cambiar la sesión (call center, recepción) conserva su
   selector. Vale para las 11 pantallas que ya usan `useCentroPantalla` (calendario, citas, día de
   servicios, existencias en vivo, paquetes, recursos, configuración de agenda, puente, EHR…).
2. **La pantalla arranca en el centro de la barra**, luego en el de la sesión, luego en el primero.
   Antes arrancaba en el de la sesión: para un master (sin centro de sesión) eso era el primero de la
   lista, aunque la barra dijera otro.
3. **Pacientes lista TODOS los centros que la persona puede leer, en una sola llamada** (owner,
   02-nov-2026; `lib/pacientes/center-scope.ts`, con tests). Los centros salen de
   `GET /me/centros-donde-puedo?permiso=pacientes.read` y van todos en `centerIds`.
   - **Con un centro**: la lista viene ya filtrada a ese centro, sin filtro ni columna.
   - **Con más de uno**: todos por defecto, un filtro de centros (casillas, `components/kit/center-filter.tsx`)
     para acotar, y una columna «Centro» mientras haya más de uno en la lista.
   - La fila de un paciente de otro centro abre la ficha con `?centro=<id>`, y la ficha lo pasa como
     `centerIds`.
   - «Nuevo paciente» sigue creando en el centro de la sesión.
   Pacientes no usa `useCentroPantalla` (un solo centro a la vez): aquí la lista es de varios.

## Fuera de alcance

- Las pestañas de la ficha (citas, facturación…) usan sus propios endpoints con su propia regla de
  centro.
