# HANDOFF BE — Incluir `pie` en el payload de `/laser/formato/:tipo` (HILT/MLS)

> Competencia BE. Contexto: el handoff `HANDOFF-formato-campos-secciones-pie` (§5) pide el **pie del
> legacy en TODOS los formatos, también HILT/MLS**. El FE ya lo pinta en el documento genérico
> (`/formatos/:clave/armado` sí trae `pie`), pero **`/laser/formato/:tipo` NO lo devuelve**.

## Estado hoy
`GET /api/v1/laser/formato/hilt` (y `mls`) devuelve solo:
```json
{ "tipo": "hilt", "secciones": [ … ] }
```
No trae `pie` (ni `membrete`, pero eso el FE ya lo resuelve por su lado). El genérico sí:
```json
{ "pie": { "prefijo": "f-b/", "usuario": "<uuid>", "login": "", "fechaHora": "2026-07-30 16:41" }, … }
```

## Qué se necesita
Agregar el mismo objeto `pie` al payload de `/laser/formato/:tipo`, con el MISMO shape y semántica que en
`/formatos/:clave/armado` (para que el FE lo pinte con el mismo código):
```jsonc
"pie": { "prefijo": "f-b/", "usuario": "<uuid del usuario>", "login": "<login o vacío>", "fechaHora": "YYYY-MM-DD HH:mm" }
```
El FE lo imprime como `{prefijo}{login || usuario} - {fechaHora}`, pequeño y alineado a la izquierda al
final de la hoja (idéntico al legacy `f-b/ usuario - 2026-07-30 16:41`).

## Efecto en el FE (una vez llegue el dato)
El componente de láser (`FormatoRender` en `components/frontdesk/formatos-modal.tsx`) pintará el pie igual
que el genérico; es un cambio de ~3 líneas en el FE en cuanto el `pie` venga en la respuesta. Sin el dato,
el FE no lo puede fabricar (prefijo/usuario/login/fechaHora son del BE/legacy, no del cliente).

---

## RESUELTO EN EL BE — 2026-07-30, ya en producción (PR #201)

`GET /laser/formato/hilt` y `/mls` ya devuelven `pie`, con el mismo shape que el genérico:

```json
"pie": { "prefijo": "f-b/", "usuario": "Glorimar Lebron", "login": "<authUserId>", "fechaHora": "2026-07-30 17:10" }
```

**Cambio respecto a lo que pediste:** `usuario` ahora trae el **nombre real del perfil**, no el uuid.
Lo detectó `/review`: el token solo lleva el `id`, así que el genérico venía imprimiendo
`f-b/ fcdc1ccc-8cd6-… - fecha`. El BE lo resuelve contra el perfil (misma fuente que el cuadre de
caja). `login` es el authUserId. Si quien imprime es una API key, `usuario` dice `api-key`.

Sigue valiendo lo del handoff principal: píntalo como `{prefijo}{login || usuario} - {fechaHora}`,
pero **prefiere `usuario`** ahora que es legible: `f-b/ Glorimar Lebron - 2026-07-30 17:10`.
