# FE → BE — Dos lecturas que faltan para completar la ficha de personal

La ficha de personal (`/personal`) ya está en producción con identidad, cargo, capacidades y «Dar acceso
al sistema». Dos bloques no se pudieron completar por huecos de LECTURA en el BE (verificado en prod,
26-ago-2026, sesión master + X-Tenant-ID de Caguas).

## 1. `GET /personal/cargos` no responde (colisiona con `/personal/:id`)

```
GET /api/v1/personal/cargos
→ 400 VALIDATION_ERROR «Validation failed (uuid is expected)»
```

La ruta `/personal/cargos` la está capturando `/personal/:id`, que valida `:id` como UUID → `cargos` no
es UUID → 400. Hace falta **declarar la ruta estática ANTES de la paramétrica** en el controlador (en
Nest, el método `@Get('cargos')` debe ir antes de `@Get(':id')`), o moverla a `/personal/catalogos/cargos`.

Mientras tanto el FE llena el desplegable de cargo con los **valores distintos** del personal cargado
(`recepcion, operadora, enfermera, medico, tecnico`), que funciona pero no es el catálogo completo.

## 2. No hay LECTURA de los centros de servicio de una persona

Existe el `PUT /personal/:id/centros { centroIds }` (funciona, 200), pero **no hay cómo leer** ese set:

```
GET /api/v1/personal/:id/centros            → 404 ENTITY_NOT_FOUND
GET /api/v1/personal/:id                    → 200, pero el objeto NO trae `centros`/`centroIds`
```

Sin esa lectura, el FE **no puede precargar los checkboxes** del bloque «Centros» con el estado real: si
los pintara vacíos y el usuario guardara, borraría centros que no vio. Por eso ese bloque queda fuera por
ahora.

**Lo que hace falta:** que la persona traiga sus centros de servicio en la lectura. Cualquiera sirve:
- `GET /personal/:id` incluya `centros: [{ id, nombre }]` (o `centroIds: []`), **o**
- un `GET /personal/:id/centros → [{ id, nombre }]`.

Con eso, el FE pinta el bloque «Centros» (checkboxes marcados donde presta servicio) y el `PUT` que ya
existe lo guarda. Avisa y lo completo.

## Lo que sí quedó (no necesita nada del BE)

- Ficha en una sola pantalla: lista + persona seleccionada.
- Cargo y capacidades editables → `PUT /personal/:id` (verificado 200).
- «Dar acceso al sistema»: diálogo de dos campos (correo + rol; nombre de la ficha) →
  `POST /profiles/invite` con `personalId`, `rolClave`, `centroId`, `tipoAsignacion: base` (una sola
  llamada). Al terminar, la misma pantalla muestra el estado final (con cuenta · aprobado).
