# Hojas de impresión: membrete, formatos que faltaban y lo que queda

Reporte del dueño: «TODAS las hojas de impresión están mal», con el legado
(`cmr/app/views/formats`) como referencia. Revisado formato por formato contra esa carpeta.

## 1. El membrete iba vacío — ARREGLADO (desplegado)

`GET /formatos/:clave/armado` devolvía `membrete.logoUrl: null` **en todas las hojas**, porque los
dos centros estaban sin logo. Y no era un olvido: **no existía forma de ponerlo** (el API solo dejaba
crear centros y editar sus datos fiscales).

- Nuevo `PUT /centros/:id` (permiso `centros.update`) con `nombre`, `direccion`, `zonaHoraria`,
  `activo` y **`logoUrl`**.
- Puesto ya en los dos centros: `https://cmr-fe-gamma.vercel.app/img/logo_cmr.png`.
- Verificado: `membrete: { centro: "CMR Caguas", logoUrl: "…logo_cmr.png" }`.

**FE:** pintar `membrete.logoUrl` arriba de cada hoja (y el nombre del centro), como el legado.

## 2. Faltaban formatos — CREADOS en los dos centros

Comparando la carpeta del legado con lo que servía el API, faltaban estos. Ya están, con la misma
estructura que el legado:

| Clave | Qué es | Forma |
|---|---|---|
| `laser_hilt` | HILT | tabla: patología, 1/2/3 Step (mj·cm y Hz) y energía total; 8 filas en blanco; firmas técnico y paciente |
| `laser_mls` | MLS | tabla: patología, frecuencia, tiempo, intensidad; 8 filas; firmas técnico y paciente |
| `motsc_constancia` | Constancia de entrega MOTS-C | campos + firmas «entregado por / recibido por / fecha» |

Cada centro tiene ahora **27 formatos**.

## 3. Lo que sigue faltando (lo digo, no lo escondo)

Del legado quedan sin equivalente: `nano_laser`, `nano_laser_iv`, `sueroterapia_form` (la general,
distinta de la de Vit C), `peptide_rx_template` y `tirzepatide_order_form`. No los inventé: hay que
decidir si se usan todavía y con qué campos. `infiltracion_articular` del legado es nuestro `rodilla`
— conviene confirmarlo mirando los dos en pantalla.

## 4. Lo que el FE tiene que revisar en su lado

El BE sirve la **definición y los valores**; el aspecto es del FE. Contra el legado, cada hoja debe
llevar: logo + nombre del centro arriba, los campos en filas con su etiqueta en negrita, la tabla con
sus filas en blanco, el bloque de OBSERVACIONES, las firmas, y el pie `f-b/ usuario · fecha-hora` con
la paginación. Si alguna hoja concreta sale mal después de esto, decidme **cuál** y con qué sesión,
que el `armado` se ve entero por API.
