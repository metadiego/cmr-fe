# Handoff BE → FE — Personal: en qué centros aparece, y el cargo como catálogo

**Fecha:** 2026-08-26 · **BE:** hecho, desplegado · **Spec:** `cmr-be/docs/specs/personal-que-trabaja-en-los-dos-centros.md`
· **Plan:** `cmr-be/docs/plans/personal-en-varios-centros.md`

## El problema que resuelve

Los técnicos, enfermeras y médicos **no entran al sistema** (cero de doce con login en Bayamón, uno
de quince en Caguas): son fichas de personal que salen en los **selects** del frontdesk, facturación
y citas. Quien elige el centro es la recepcionista que está usando la pantalla.

Y como `personal` era una tabla por centro, quien trabaja en los dos estaba **duplicado**: 20
personas con dos fichas, con su trabajo partido en dos ids. Palabras del dueño: «el señor Luis
trabaja en Caguas y en Bayamón, debería estar siempre en los dos… dar y quitar ese permiso es
tedioso».

## 1. Centros donde la persona aparece en los selects

```
PUT /api/v1/personal/:id/centros
body: { "centroIds": ["<uuid Bayamón>", "<uuid Caguas>"] }
```

- Es la **lista completa de los encendidos**: lo que no venga queda apagado. Al menos uno.
- Permiso: `personal.update`. Y **encender un centro exige el permiso EN ese centro**: quien
  administra solo Bayamón recibe 403 si intenta encender Caguas.
- La respuesta es la ficha con su `centrosServicio`.

### Cómo pintarlo

Un bloque «Centros» en la ficha, con **todos los centros del sistema** (`GET /centros`) y una casilla
por cada uno, marcadas las que estén en `centrosServicio`:

```
Centros donde aparece en los selects
  [✓] CMR Bayamón
  [✓] CMR Caguas
  [ ] CMR Miami        ← aparece solo el día que se cree el centro
```

**Esto es lo importante y es lo que pidió el dueño:** en la ficha **solo se guardan los encendidos**,
no la lista de centros. Así, cuando se abran Miami, Nueva York o Los Ángeles, aparecen **solos** en la
ficha de todo el mundo, apagados, sin que nadie tenga que ir a tocar a nadie.

Un texto de ayuda que conviene poner tal cual:

> Marca los centros donde esta persona debe salir en los desplegables. Si un día va a cubrir en otro
> centro, márcalo y ya sale allí; al volver, lo desmarcas.

### Detalle de compatibilidad (no lo ignores)

Si `centrosServicio` viene **vacío o null**, la persona aparece en su centro de origen (`clinicId`),
que es como funcionaba antes. Las 300+ fichas actuales están así, así que la casilla de su centro
debe salir **marcada por defecto** aunque el array esté vacío — si no, parecerá que no tiene ninguno.

## 2. El cargo es un catálogo, no un campo de texto

```
GET /api/v1/personal/cargos
→ [{ "clave": "medico", "labelKey": "personal.cargo.medico" }, … ]
```

Claves: `medico`, `enfermera`, `tecnico`, `recepcion`, `operadora`, `cajero`, `gerente`, `otro`.

El campo `cargo` de la ficha pasa a ser un **desplegable** con esa lista. Motivo: en producción
convivían `tecnico` (8 fichas) y `técnico láser` (12) **para el mismo oficio**, y con eso las
estadísticas de servicio no cuadraban. El BE acepta lo que se le escriba y lo normaliza (`técnico
láser` → `tecnico`, `enfermero` → `enfermera`, `Doctora` → `medico`), pero lo que no reconoce lo
**rechaza con 400** nombrando los válidos. Con el desplegable eso no debería pasar nunca.

**Traducciones que hay que añadir** (`personal.cargo.*` en es/en): Médico, Enfermera, Técnico,
Recepción, Operadora, Cajero, Gerente, Otro.

## 3. Cargo ≠ capacidades (la distinción que importa)

- **`cargo`**: el puesto, uno solo, el que se lee en pantalla y en los informes.
- **`capacidades`**: un array con **todo lo que la persona hace**, y es **lo que consultan los
  selects**. Waldemar factura, atiende y es técnico: con una sola ficha sale en los tres
  desplegables.

Así que en la ficha van los dos: el cargo como desplegable único, y las capacidades como
multi-select. No pongas el cargo a decidir quién sale en un select — eso lo hacen las capacidades.

## 4. Lo que NO cambia en el frontdesk

El select del frontdesk sigue pidiendo lo mismo (`GET /personal/por-capacidad/:capacidad`, con el
centro activo). Lo único que cambia es que **devuelve más gente**: la que tenga ese centro encendido.
No hay que tocar esas pantallas.

---

## Confirmado en producción (26-ago, 16:10) — ya puedes construir

El backend **no aterrizaba** porque el CI de GitHub Actions dejó de arrancar (tres runs muertos sin
ejecutar un paso). Se desplegó **a mano** construyendo dentro de la VM. Verificado ahora mismo contra
`https://api.centrodemedicinaregenerativa.com`:

| Endpoint | Estado | Con qué se probó |
|---|---|---|
| `GET /personal/cargos` | **200** — las 8 claves | sesión real de wilma (gerente) |
| `GET /personal/:id/centros` | **200** — `[{id, nombre, activo}]` | sesión real de wilma, ficha de Luis Guzmán |
| `PUT /personal/:id/centros` | **200** | API key admin |

Ejemplo real de la lectura (Luis Guzmán, que trabaja en los dos):

```json
[
  { "id": "ef6f87b0-…", "nombre": "CMR Bayamon", "activo": true },
  { "id": "5f98ef29-…", "nombre": "CMR Caguas",  "activo": true }
]
```

### El 403 que vas a encontrar en la escritura, y por qué NO es un fallo

`PUT /personal/:id/centros` con la sesión de **wilma** (gerente **solo de Bayamón**) marcando Caguas
responde **403**. Es deliberado: encender un centro es dar visibilidad EN ese centro, así que se exige
`personal.update` **en cada centro que se marca**. Quien administra un solo centro no puede meter
gente en el select del otro.

**Lo que la UI debe hacer con eso** (y es la parte que evita el fastidio):

- Pinta la casilla de un centro **deshabilitada** si el usuario no puede administrarlo, con un título
  del tipo «no administras este centro».
- Para saber cuáles puede, usa el selector de centros que ya tienes por permiso:
  `getCentrosDondePuedo("personal.update")` — devuelve exactamente los centros donde tiene ese
  permiso. Las casillas de los demás se muestran (para que se vea el estado real) pero no se tocan.
- Así el admin marca los seis sin fricción y la gerente de Bayamón ve que Caguas está encendido pero
  no lo puede cambiar, en vez de darle un 403 al guardar.

### Y lo que confirmaste tú de los roles por centro: correcto

Los roles de Edgardo son **por centro** (Gerente en Bayamón, Facturación en Caguas), así que hay que
leerlos **con el centro en la consulta**, no en la vista global. `GET /profiles` los trae con su
`centroId` en cada rol, y `GET /auth/me` con `X-Tenant-ID` devuelve el rol **efectivo en ese centro**
— verificado: con Bayamón responde `['gerente']`, con Caguas `['facturacion']`.

Y un arreglo relacionado que ya está arriba: Edgardo cambiaba a Caguas y **perdía el selector de
centros**, quedando atrapado. `GET /auth/me/centros/operativos` devolvía un solo centro porque el
permiso de cambiar de sesión se resolvía con el rol del centro activo. Ya devuelve los dos con
cualquiera de los dos activo.
