# El idioma de la pantalla — lo que toca al frontend

El backend ya está hecho y verificado en producción (2-sep-2026). El idioma **por defecto es
inglés** y cada persona puede cambiarlo; su elección se recuerda y no afecta a nadie más.

## Lo que ya tienes

**`GET /api/v1/auth/me`** trae dos campos nuevos:

- `idioma` — el que toca a esta persona, ya resuelto (`"en"` si nunca eligió).
- `idiomasDisponibles` — la lista de los que puede elegir, hoy `["en","es"]`.

Vienen en la misma llamada que ya haces al arrancar, así que **el primer render puede salir en el
idioma correcto sin una segunda petición ni un parpadeo**. Léelo de ahí, no de una constante.

**`PUT /api/v1/me/preferences`** guarda la elección. El cuerpo es la capa del usuario:

    { "config": { "idioma": "es" } }

Devuelve el config guardado. Para volver al defecto, manda el config sin la clave `idioma`.

**`GET /api/v1/me/preferences`** sigue devolviendo la configuración efectiva completa, ahora con
`idioma` e `idiomasDisponibles` resueltos, si prefieres leerlo de ahí en la pantalla de ajustes.

Un idioma que no esté en la lista se rechaza con 400 y el mensaje dice cuáles valen
(`labelKey: preferencias.idiomaNoDisponible`). Así que el selector puede confiar en la lista.

## Lo que hay que hacer del lado del frontend

1. **El selector**, en el menú de usuario o en preferencias. Píntalo **con la lista que viene del
   API**: si la escribes a mano, añadir un idioma dejará de ser una fila y volverá a ser un
   despliegue del frontend.
2. **Aplicarlo al arrancar**, con el `idioma` de `/auth/me`, antes del primer render.
3. **Guardar el cambio** con el `PUT` de arriba y aplicarlo sin recargar.
4. **Las traducciones.** Los textos ya se piden por `labelKey`; lo que falta es completar el
   diccionario **inglés**, que ahora es el idioma por defecto. Este es el trabajo grande y es el que
   de verdad decide si la pantalla se ve bien: sin diccionario, el selector cambia el idioma y no
   cambia nada en la pantalla.
5. **Los mensajes de error del API** ya viajan con `labelKey`: tradúcelos por ahí, no por el texto.

## Lo que no cambia

El idioma de la **API** no depende de esto: `/api/v1` responde con los campos en español y
`/api/v2` en inglés, y eso lo elige el programa, no la persona. Ver
`cmr-fe/docs/specs/api-v2-en-ingles.md`.

Backend: `docs/specs/idioma-por-usuario.md` y `docs/plans/idioma-por-usuario.md`.
