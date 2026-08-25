# FE — El contador de presentes en la barra de servicios

Prototipo aprobado por el dueño (25-ago-2026):
**https://claude.ai/code/artifact/3ac541a6-b5f1-478f-a90a-41d1c4a23114**

Ahí están las cuatro maneras y todas las preferencias, funcionando sobre la jornada real. Abre el
enlace antes de leer esto: se entiende en diez segundos.

## De qué va

En el legado, cada pestaña de servicio lleva una burbuja roja con **cuánta gente está presente ahora**
en esa terapia. Baja cuando se le quita el presente o cuando queda asistido. Es de lo más útil del
sistema viejo y no lo tenemos.

Palabras del dueño: «esa burbujita significa la cantidad de pacientes en presente, y eso desaparece
cuando le quitan el presente o ya fue asistido». Y sobre el aspecto: «que sea igual o mejor, más
bonito», con todo configurable.

## Lo que hay que construir

Un indicador por servicio en la barra que ya existe en `/frontdesk`. **No se añade ningún ajuste a esa
pantalla**: la barra solo lee. Los ajustes viven en otros dos sitios (más abajo).

El indicador tiene cuatro modos, y el usuario elige:

| Modo | Qué dibuja |
|---|---|
| `punto` | Un punto que late solo donde hay alguien. El más discreto, cabe en la barra actual |
| `presion` | Pastilla con el número y una línea que se llena según cuánta gente espera |
| `tramos` | Un tramo por paciente: se cuenta de un vistazo sin leer la cifra |
| `burbuja` | Como el legado, para quien quiera lo de siempre |

Y estas preferencias, todas del prototipo:

- `figura`: `circulo` · `cuadrado` · `barra`
- `color`: uno de la paleta del proyecto (violeta, verde, azul, ámbar, rojo, tinta)
- `verNumeros`: mostrar la cifra o solo la marca
- `latido`: animar los que tienen gente esperando
- `ocultarVacios`: esconder los servicios sin nadie
- `compacta`: barra apretada, para turnos con muchos servicios

Detalles que el prototipo ya resuelve y conviene copiar: el color aparece **solo** donde hay gente (el
resto de la barra en tinta), el vacío se marca con la figura en gris y sin latido, y las cifras van en
Geist Mono con `tabular-nums` para que no bailen al cambiar.

## El endpoint (lo estoy construyendo, aún NO existe)

```
GET /api/v1/frontdesk/presentes
```

Devuelve, para el centro de la sesión y el día de hoy, un conteo por servicio:

```jsonc
{
  "fecha": "2026-08-25",
  "servicios": [
    { "servicioId": "…", "clave": "laser", "labelKey": "servicio.laser", "presentes": 1 },
    { "servicioId": "…", "clave": "suero-vitc", "labelKey": "servicio.suero_vitc", "presentes": 4 },
    { "servicioId": "…", "clave": "nano", "labelKey": "servicio.nano", "presentes": 0 }
  ],
  "totalPresentes": 7
}
```

- Cuenta **solo el estado `presente`**. Los estados de una sesión son `pendiente`, `presente`,
  `en_terapia` y `asistido`: en terapia y asistido **no** cuentan, igual que en el legado.
- Trae **todos** los servicios del centro, con `presentes: 0` incluido — así el FE puede esconderlos
  o no según la preferencia, sin pedir otra cosa.
- Nombres en `labelKey` (i18n), no en texto.
- Permiso: `frontdesk.read`, el mismo con el que ya se ve el tablero.

Se actualiza por el stream que la pantalla ya escucha (`GET /frontdesk/stream`, SSE): al marcar
presente o asistir llega el evento y el contador se recalcula. **No hagas sondeo cada pocos segundos.**

## Las preferencias (endpoint por confirmar)

Vienen **ya resueltas** en una sola llamada: el FE no mezcla nada. La regla, dicha por el dueño: la
**corporativa manda sobre la personal**. Si la clínica fija el color, el usuario no lo ve cambiar.

Dónde se editan, y esto es parte del trabajo del FE:

1. **Corporativa** — en Configuración, por centro. Solo quien administra.
2. **Personal** — en el menú del avatar, junto a las demás preferencias de cada quien.

Te confirmo la ruta exacta y el nombre de las claves cuando cierre la spec del backend; el contrato de
la barra (los nombres de arriba) no va a cambiar, así que puedes montar el componente ya con valores
por defecto: `punto`, `circulo`, color primario, números encendidos, latido encendido, vacíos visibles.

## Lo que NO hay que hacer

- No añadir ajustes a la pantalla del frontdesk: la llena de cosas que nadie toca en plena jornada.
- No contar en el FE a partir de las filas del tablero: el conteo es del backend, y el tablero puede
  estar paginado o filtrado.
- No fijar las preferencias en el código: son datos, y la clínica los cambia sin desplegar.
