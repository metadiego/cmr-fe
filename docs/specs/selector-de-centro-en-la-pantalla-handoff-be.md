# FE — El selector de centro va EN la pantalla. Un patrón para todas.

> ## LO PRIMERO: la pantalla de CITAS necesita su selector
>
> En `/citas` **no hay selector de centro**. Hay que ponerlo, en la barra de la propia pantalla,
> junto a «Doctores - todos» y «Nueva Cita» — exactamente como se hizo en el calendario.
>
> Y el del **nav sale de ahí para el call center**: ya no lo verán, porque cambiar el centro de la
> sesión pasó a exigir el permiso `centros.cambiar`, que solo tiene gerencia. Si Karola no tiene un
> selector en `/citas`, se queda sin poder agendar en el otro centro. **Esta parte no es opcional.**
>
> - Llenarlo con `GET /api/v1/me/centros-donde-puedo?permiso=citas.read`
> - «Nueva Cita» solo si el centro elegido está en `…?permiso=citas.create`
> - Pedir la agenda con `GET /api/v1/citas/agenda-dia?fecha=…&centroId=<elegido>`
> - Cambiar de centro ahí **no** toca la sesión.
> - **Y lo que cuelga del centro cambia con él**: el desplegable de médicos tiene que recargarse
>   con `GET /api/v1/personal/por-capacidad/medico?centroId=<elegido>`. Hoy enseña los del centro de
>   la sesión aunque la pantalla mire otro, y así se puede agendar con un médico que no está allí
>   (visto en pantalla: en Bayamón salían Emma González y Javier Lillo, que son de Caguas).

Backend desplegado y verificado en producción el 23-ago-2026. Esto **sustituye** al handoff del
calendario: el mismo patrón vale para citas, facturación, inventario y lo que venga.

## El problema que resuelve

Para que alguien mirara el calendario del otro centro había que darle ese centro, y entonces le
aparecía el **selector global del nav** — que cambia el contexto de toda la sesión y expone centros
donde no puede hacer nada. Lo que se quiere es lo que ya hace pacientes: el selector
**dentro de la pantalla**, afectando solo a lo que esa pantalla muestra. **Citas todavía NO lo
tiene** — es lo primero que hay que hacer.

## Los dos selectores no son el mismo

| | Selector del **nav** | Selector de la **pantalla** |
|---|---|---|
| Pregunta | ¿En qué centro **trabajo**? | ¿Qué estoy **mirando**? |
| Afecta a | Toda la sesión: facturar, cobrar, agendar | Solo esa pantalla |
| Se llena con | `GET /auth/me/centros/operativos` | `GET /me/centros-donde-puedo?permiso=…` |
| Quién lo ve | Solo con el permiso `centros.cambiar` | Cualquiera que tenga el permiso de esa pantalla |
| Si devuelve uno | **No se enseña** | **No se enseña** |

### El del nav no es para todo el mundo

Cambiar el centro de la sesión mueve dónde se **factura, se cobra y se agenda**. Alguien puede
emitir una factura en el centro equivocado sin darse cuenta, y eso no se deshace con un clic. Por
eso depende del permiso **`centros.cambiar`**, que hoy solo tiene gerencia.

**El FE no necesita comprobar el permiso**: `/auth/me/centros/operativos` ya devuelve un único
centro —el suyo— a quien no lo tiene. Con la regla de «si devuelve uno, no se enseña», el selector
desaparece solo para quien no debe cambiarse.

La diferencia que importa: **leer no factura**. Quien no puede mudarse de centro sigue pudiendo
mirar el otro desde cada pantalla, que es lo que no hace daño.

`/auth/me/centros/operativos` devuelve donde la persona tiene un **rol**. Un centro donde solo hay
un acceso puntual no sale ahí: ofrecerlo invita a mudarse a un sitio donde no puede trabajar.
**Deja de llenar el nav con `auth/me/centros`**, que trae todos los centros asignados.

## El endpoint para CUALQUIER pantalla

```
GET /api/v1/me/centros-donde-puedo?permiso=citas.read
→ [{ "id": "ef6f87b0-…", "nombre": "CMR Bayamon", "codigo": "bay", … }]
```

Dime el permiso, te digo en qué centros lo tiene, con nombre. **No hay un endpoint por dominio** y
no hace falta pedir uno nuevo cuando aparezca una pantalla más.

Por pantalla se piden dos:

| Pantalla | Para llenar el selector | Para decidir si ofrecer las acciones |
|---|---|---|
| Citas / agenda | `permiso=citas.read` | `permiso=citas.create` |
| Calendario | `permiso=calendario.read` | `permiso=calendario.create` |
| Facturación | `permiso=factura.read` | `permiso=factura.create` |
| Inventario | `permiso=inventario.read` | `permiso=inventario.ajustar` |

Un permiso que no existe responde **400**, no una lista vacía: así un error de escritura no se
confunde con «no puedes en ningún sitio».

## Cómo pedir los datos de otro centro

Los endpoints aceptan `centroId`: en la query si es lectura, en el cuerpo si es escritura.

```
GET  /api/v1/calendario/eventos?desde=…&hasta=…&centroId=<elegido>
GET  /api/v1/citas/agenda-dia?fecha=…&centroId=<elegido>
POST /api/v1/calendario/eventos   { …, "centroId": "<elegido>" }
```

Sin `centroId`, el centro de la sesión, como siempre. **No cambies el centro de la sesión**: al
salir de la pantalla, la persona sigue donde estaba.

El backend comprueba de verdad: hace falta tener ese centro **y** el permiso de esa acción **en él**.
Si no, 403. Por eso los dos endpoints de arriba: **no ofrezcas una opción que va a fallar.**

## Todo lo que cuelga del centro se recarga al cambiarlo

Cambiar el centro en la pantalla no es solo cambiar la lista principal: **todos los desplegables que
dependen del centro tienen que volver a pedirse con ese `centroId`**, o se elige un dato de un centro
para guardarlo en otro.

| Qué | Cómo pedirlo con el centro elegido |
|---|---|
| Médicos y demás personal | `GET /personal/por-capacidad/:capacidad?centroId=…` |
| Listado de personal | `GET /personal?capacidad=medico&centroId=…` |
| Pacientes | ya filtran por el centro de la sesión; si la pantalla mira otro, hay que pedirlo — avísanos y lo abrimos igual |
| Agenda del día | `GET /citas/agenda-dia?fecha=…&centroId=…` |
| Eventos del calendario | `GET /calendario/eventos?desde=…&hasta=…&centroId=…` |

Comprobado en producción: con la sesión en Bayamón salen sus 10 médicos; pidiendo Caguas, los 5 de
Caguas. Si un desplegable no se recarga, el usuario ve nombres del centro equivocado y puede guardar
con ellos.

## Solo lectura: según el permiso, no según el centro

Si el centro elegido no está en la lista de escritura, esconde las acciones (crear, editar, borrar) y
marca la pantalla como solo lectura — el distintivo que ya se puso junto al selector del calendario
funciona bien. **No lo deduzcas de «es o no mi centro»**: puede haber alguien con escritura concedida
en otro centro, y al revés.

## Cada uno toca lo suyo (calendario)

Nadie edita ni borra lo que agendó otra persona, salvo el admin. El evento trae su autor, así que la
decisión se toma sin llamadas extra: enseña editar y borrar solo en los propios. Los ~3.500 eventos
importados del legado no traen autor y solo el admin puede tocarlos.

## Facilidad de uso: lo que pide el dueño

- Que se vea de un vistazo en qué centro estás y qué estás mirando, sin abrir menús.
- Cambiar de centro en una pantalla, un clic, y que quede claro que no cambió la sesión.
- Ninguna opción que falle al pulsarla. Los endpoints existen exactamente para eso.
- Si solo hay un centro, no se enseña ningún selector: no hay nada que elegir.

## Verificado en producción

| | |
|---|---|
| Karola (call center) | agenda en los dos centros, y puede agendar en los dos; nada de facturación |
| Bonillo (gerente de Caguas) | calendario de los dos, escritura solo en Caguas; nav: solo Caguas |
| Gerente de un solo centro | un centro en todo: ningún selector |
