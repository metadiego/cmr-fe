# Handoff BE — color y parpadeo de las horas disponibles del planificador, configurables

**Origen**: pedido del dueño (2026-09-27) — sin construir nada todavía, solo investigación y
confirmación, mismo criterio que `scheduling-bridge-reverse-sync-handoff-be.md`.

## De qué se habla exactamente

En `components/agenda/therapy-day-scheduler.tsx`, cada hora disponible del servicio activo se
pinta con un tinte verde y una animación de parpadeo:

```
border-success/40 bg-success/10 hover:bg-success/20   ← color
animate-pulse                                          ← parpadeo
```

## Hallazgo importante: EL COLOR YA ES CONFIGURABLE, casi sin trabajo nuevo

`bg-success`/`border-success` no son un verde fijo — son clases de Tailwind que leen la variable
CSS `--success` (`app/globals.css:41-42`), y esa variable **ya es un token del motor de temas por
capas que el BE sirve hoy** (`lib/theme/config.ts:27`, `ThemeColorKey` incluye `"success"`; el
mismo sistema system→center→user→override que ya expone `GET/PUT /me/preferences`, ya con su
propia puerta de API). En otras palabras: **si alguien cambia el color "success" del tema desde
la configuración que ya existe, estas horas cambian de color solas** — no hace falta ningún
endpoint nuevo para esto.

**Ojo con el alcance**: `success` es un token COMPARTIDO — lo usan también las insignias "Fits" /
"As requested" del mismo planificador y probablemente otras partes de la app. Cambiarlo cambia
todo lo verde del sistema, no solo estas horas. **Pregunta para el dueño, no supuesta**: ¿eso es
lo que quiere (verde consistente en toda la app), o quiere un color INDEPENDIENTE solo para el
indicador de disponibilidad, que pueda diferir del "success" general? Si es lo segundo, sí hace
falta una clave nueva en el mismo `ThemeConfig` (p. ej. `colors.disponibilidad` o similar) — mismo
motor, un campo más, nada que inventar de cero.

## Lo que SÍ es nuevo: el interruptor de parpadeo

No existe ningún campo hoy para apagar/prender `animate-pulse`. Encontrado en vivo dos veces esta
semana: se quitó por parecer un glitch visual (PR #75) y se repuso porque al dueño le gusta (revert
directo a main, mismo día) — la señal es que ESTO es justo el tipo de preferencia que debería vivir
en configuración, no en una decisión de código que hay que revertir a mano cada vez que cambia de
opinión.

**Propuesta (a confirmar, no construida)**: extender el mismo `ThemeConfig`/motor de capas con un
booleano, p. ej. `availability?: { blinkEnabled?: boolean }` (default `true`, para no cambiar el
comportamiento actual). Mismo mecanismo de siempre: `GET/PUT /me/preferences`, misma resolución
por capas (sistema → centro → usuario → override), mismo MCP que ya expone preferencias. **Cero
endpoints nuevos** — es un campo más en un sobre que el BE ya guarda como JSONB libre
(`lib/theme/config.ts:3-6`, "el BE guarda config de tema como blob JSONB libre").

## Lo que hace falta del BE

1. Confirmar que un campo nuevo en el JSONB de tema (`availability.blinkEnabled`, y opcionalmente
   `colors.disponibilidad` si el dueño quiere un color independiente) no rompe nada del lado BE —
   como es JSONB libre, probablemente no hace falta migración, pero **confirmar, no asumir**.
2. Si el dueño confirma que quiere un color independiente (no reusar "success"): agregar esa clave
   al catálogo de `ThemeColorKey` documentado (ahora mismo solo vive en el FE,
   `lib/theme/config.ts:11-32` — confirmar si el BE valida contra una lista cerrada de claves o
   acepta cualquier clave dentro del JSONB libre).

## Lo que hace falta del FE (una vez el dueño confirme, NO construido aún)

- Leer `effective.availability?.blinkEnabled` (default `true`) desde `PresentationProvider`/el
  mismo mecanismo que ya aplica el tema, y condicionar la clase `animate-pulse` en
  `therapy-day-scheduler.tsx:478` a ese valor.
- Si se decide un color independiente: agregar la UI de selección en el editor de tema existente
  (`components/theme/theme-editor.tsx`), mismo patrón que los demás colores — no una pantalla
  aparte.
