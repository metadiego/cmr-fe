# FE — El selector de centro del calendario va EN la pantalla, no en el nav

Backend desplegado y verificado en producción el 23-ago-2026.

## Qué se pide

Hoy, para que alguien mire el calendario de otro centro hay que darle ese centro, y entonces le
aparece el **selector global del nav** — que expone centros y cambia el contexto de toda la sesión.
Lo que se quiere es lo que ya hace la agenda de citas: el selector **dentro de la pantalla**
(«CMR Bayamon» en su cabecera), afectando solo a lo que esa pantalla muestra.

Se puede: el endpoint del calendario acepta el centro como parámetro, así que la pantalla pide otro
centro sin tocar el de la sesión.

## El selector del NAV es OTRA cosa

Los dos selectores responden preguntas distintas y no deben confundirse:

- **El del nav** = «en qué centro estoy trabajando». Cambia el contexto de facturar, cobrar y
  agendar. Debe ofrecer solo los centros donde la persona **trabaja de verdad**:

  ```
  GET /api/v1/auth/me/centros/operativos
  ```
  Devuelve los centros donde tiene un **rol**. Un centro donde solo hay un acceso puntual —mirar el
  calendario del otro centro— **no sale aquí**: ofrecerlo invita a mudarse a un sitio donde no se
  puede hacer nada. **Si devuelve un solo centro, no enseñes el selector del nav.**

  Deja de usar `auth/me/centros` para llenarlo: esa lista trae todos los centros asignados, que es
  justo lo que produce el problema.

- **El de la pantalla** = «qué estoy mirando». Solo afecta a esa pantalla y no toca la sesión.

## Los endpoints del calendario

**1. Qué centros ofrecer en el selector** — nuevo:

```
GET /api/v1/calendario/centros
```
Devuelve los centros cuyo calendario puede ver quien pregunta, **con nombre**:
```jsonc
[{ "id": "ef6f87b0-…", "nombre": "CMR Bayamon", "codigo": "bay", … }]
```
- Úsalo para llenar el desplegable. **No uses `auth/me/centros`** aquí: esa lista trae todos los
  centros de la persona, y en algunos no puede ver el calendario — el selector ofrecería opciones
  que al pulsarlas dan 403.
- **Si devuelve un solo centro, no enseñes el selector.** No hay nada que elegir.

**2. Dónde puede CREAR** — nuevo:

```
GET /api/v1/calendario/centros/escritura
```
Misma forma que el anterior, pero filtrado por el permiso de creación. **Con esto se decide si
enseñar «Nuevo evento»**: si el centro elegido no está en esta lista, el calendario va en solo
lectura. No lo deduzcas de «es o no mi centro» — puede haber alguien con escritura concedida en
otro centro, y al revés.

**3. Los eventos de ese centro** — ya existía:

```
GET /api/v1/calendario/eventos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&centroId=<id>
```
- Sin `centroId` manda el centro de la sesión, como hasta ahora.
- Con `centroId` se comprueba de verdad: hace falta tener ese centro **y** el permiso de lectura
  **en él**. Si no, responde 403. Hasta hoy no comprobaba nada y cualquiera podía leer el calendario
  ajeno pasando el identificador; ya está cerrado.
- Devuelve los eventos de ese centro **más los globales** (los que valen para toda la empresa).

## Lo que la pantalla debería hacer

1. Al abrir, pedir `GET /calendario/centros`. Uno solo → sin selector. Varios → selector en la
   cabecera del calendario, como en la agenda de citas, con el centro de la sesión preseleccionado.
2. Al cambiar de centro, volver a pedir los eventos con `centroId`. **No tocar el centro de la
   sesión** ni el selector del nav: al salir de la pantalla, la persona sigue donde estaba.
3. **Solo lectura según el permiso, no según el centro.** Enseña «Nuevo evento» si el centro
   elegido está en `/calendario/centros/escritura`; si no, esconde la acción. Editar y borrar igual:
   el backend lo comprueba y responderá 403, así que no ofrezcas lo que va a fallar.

   Esto CAMBIÓ respecto a la primera versión de este documento, que decía que crear iba siempre al
   centro de la sesión «a propósito». Estaba mal: eso ataba la capacidad al código. Ahora se puede
   conceder escritura en otro centro desde la pantalla de accesos, y entonces:

   ```
   POST /api/v1/calendario/eventos   { …, "centroId": "<centro elegido>" }
   ```

   Con `centroId` el evento nace en ese centro. Sin él, en el de la sesión, como siempre. Si no
   tiene el permiso allí, 403 — el mismo criterio que la lectura.

## Cada uno toca lo suyo

Regla nueva del dueño: **nadie edita ni borra lo que agendó otra persona, salvo el admin.**

- Al crear, el backend guarda quién lo hizo. Los eventos que se editan o borran se comprueban contra
  ese autor: si no eres tú, responde 403 con el motivo escrito («lo agendó otra persona»).
- Los ~3.500 eventos importados del legado **no traen autor**: solo el admin puede tocarlos.
- En pantalla: enseña editar y borrar solo en los eventos propios. Con el resto, o los escondes o los
  dejas visibles pero inertes — lo que no vale es ofrecer un botón que va a dar 403.
- El evento trae su autor en la respuesta, así que la decisión se toma sin llamadas extra.

## Facilidad de uso: lo que pide el dueño

Esto tiene que resolverse **desde la pantalla, sin pedirle nada a nadie**. En concreto:

- Que se vea de un vistazo en qué centro estás y qué estás mirando, sin abrir menús.
- Que cambiar de centro en una pantalla sea un clic, y que quede claro que no cambió tu sesión.
- Que «solo lectura» se lea sin explicación: el distintivo que ya pusiste al lado del selector
  funciona bien.
- Nada de opciones que fallan al pulsarlas: si un endpoint va a responder 403, esa opción no se
  ofrece. Los tres endpoints de arriba existen precisamente para eso.

## Caso real que ya funciona

Bonillo, gerente de Caguas, tiene concedida la **lectura** del calendario de Bayamón. Verificado
en producción el 23-ago:

| | |
|---|---|
| Selector del **nav** | `CMR Caguas` — uno solo, así que no se enseña |
| Calendario, donde **lee** | `CMR Bayamon`, `CMR Caguas` |
| Calendario, donde **escribe** | `CMR Caguas` |

Un gerente que solo tiene Caguas: un centro en el nav, uno en el calendario, ningún selector.
