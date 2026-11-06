# Correo: completar el dominio solo — handoff BE → FE

**Fecha:** 6-nov-2026 · **Pedido por:** el dueño

> «En el cuadre, donde se escribe el email —y funciona perfectamente—, vamos a ayudar un poco con el
> dominio, que es extenso y propenso a errores: '@centrodemedicinaregenerativa.com'. Que si va, ya esté
> allí; y si se van a agregar más, que lo agregue.»

## El dato (BE, ya en producción)

Los dominios de la casa son configuración, no código. Están en la preferencia **del sistema**
`email.domains`, que es una lista ordenada; el primero es el principal.

- Verificado el 6-nov con `GET /api/v2/me/preferences`: `effective.email.domains = ["centrodemedicinaregenerativa.com"]`.
- Para agregar otro dominio, el admin lo agrega a la lista desde el editor de preferencias del sistema
  (`PUT /preferences/system`). Hay que **fusionar** la configuración, nunca reemplazarla, igual que ya se
  hace con `caja.emailRecipients`.

## Qué construir

Un componente de correo compartido, `EmailInput` o similar, que se use en **todos** los campos de correo:
el cuadre, el cuadre total, la exportación y la ficha. No un parche solo para el cuadre.

1. Si se escribe solo el usuario, sin `@` (por ejemplo `sheila.gonzalez`), al confirmar (Enter, coma,
   Tab o salir del campo) se completa con `@` y el **primer** dominio de `email.domains`.
2. Al escribir `@`, se sugieren los dominios de la lista (por ejemplo `@centr…` →
   `@centrodemedicinaregenerativa.com`). Con Tab o Enter se acepta la sugerencia.
3. Un correo completo con otro dominio (por ejemplo gmail) se respeta tal cual.
4. Cuando hay varios destinatarios (como chips), cada uno se completa por su cuenta.
5. Si `email.domains` está vacío o no existe, el campo se comporta como hoy y no inventa nada.
6. Textos nuevos (ayuda o placeholder) con `labelKey` en `es` y `en`.

## Verificación

En el cuadre de prueba de Bayamón, escribir `larciles` y pulsar Enter. El chip tiene que quedar como
`larciles@centrodemedicinaregenerativa.com`, y el envío tiene que llegar.
