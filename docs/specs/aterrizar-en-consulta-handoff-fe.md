# Aterrizar directo en la pestaña Consulta al entrar a Frontdesk — Handoff FE

**BE:** PR #386 en revisión (`feat/frontdesk-starts-on-consultation`, cmr-be), sin desplegar
todavía.
**FE:** pendiente.

## Qué hace

Pedido del dueño: recepción (y quien más lo necesite) entra a Frontdesk y aterriza directo en la
pestaña **Consulta** — sin tener que buscarla y pulsarla cada vez.

## El campo (ya en `personal`, mismo endpoint de siempre)

`frontdeskStartsOnConsultation: boolean` — **dato de la PERSONA, nunca inferido del cargo**. Se
lee/escribe con el `GET/PUT personal/:id` que ya usa la ficha de Personal (campo nuevo en el
mismo payload, sin ruta nueva). Default `false`.

## Qué tocar en el FE

1. **Al entrar a `/frontdesk`**: si `frontdeskStartsOnConsultation` del usuario logueado es
   `true`, seleccionar la pestaña `consulta` (de `GET frontdesk/tabs`, ver
   `docs/specs/consulta-como-pestana-del-frontdesk-handoff-fe.md` de hoy mismo) como pestaña
   activa inicial, en vez de la primera o la última recordada.

2. **Al volver de facturar una consulta** — hoy el flujo "devuelve al módulo que lo invocó"
   (Frontdesk), pero a la pestaña que estuviera activa ANTES de ir a facturar, no
   necesariamente Consulta. Cambiar para que, cuando quien invocó fue Frontdesk y la acción fue
   facturar una consulta, el retorno aterrice específicamente en la pestaña `consulta` — sin
   importar cuál estaba activa antes de entrar a facturación.

3. **Toggle en la ficha de Personal** (`/configuration/staff`, junto a los demás campos
   editables de la persona): algo como «Entrar directo a Consulta en Frontdesk», con su
   `labelKey` i18n.

## Qué NO cambia

- `GET frontdesk/tabs` no cambia — el orden y las pestañas siguen igual.
- El resto de la navegación de Frontdesk (servicios, acciones, permisos) no se toca.

Razón completa: `cmr-be/docs/specs/entrar-directo-a-consulta-en-frontdesk.md`.
