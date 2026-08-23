# FE — El selector de centro del calendario va EN la pantalla, no en el nav

Backend desplegado y verificado en producción el 23-ago-2026.

## Qué se pide

Hoy, para que alguien mire el calendario de otro centro hay que darle ese centro, y entonces le
aparece el **selector global del nav** — que expone centros y cambia el contexto de toda la sesión.
Lo que se quiere es lo que ya hace la agenda de citas: el selector **dentro de la pantalla**
(«CMR Bayamon» en su cabecera), afectando solo a lo que esa pantalla muestra.

Se puede: el endpoint del calendario acepta el centro como parámetro, así que la pantalla pide otro
centro sin tocar el de la sesión.

## Los dos endpoints

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

**2. Los eventos de ese centro** — ya existía:

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
3. Cuando el centro elegido **no es el suyo**, el calendario es de solo lectura: esconde «Nuevo
   evento» y no dejes editar ni borrar. Crear, editar y borrar siguen yendo contra el centro de la
   sesión, no contra el elegido — no hay forma de crear un evento en otro centro desde aquí, y es a
   propósito.

## Caso real que ya funciona

Bonillo, gerente de Caguas, tiene concedida la **lectura** del calendario de Bayamón. Con esto:
ve Caguas y Bayamón en el desplegable, mira el de Bayamón sin salir de su centro, y allí no puede
tocar nada. Un gerente que solo tiene Caguas ve un único centro y ningún selector.
