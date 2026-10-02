> **CORREGIDO el 2026-10-02, el diagnóstico de abajo estaba al revés.** El `grep canal` que dio
> "cero resultados" buscó el nombre VIEJO: el campo se renombró `canal`→`channel` en la
> migración a inglés del 3-sep-2026 (commit `b78674ed`), y bajo ese nombre SÍ se manda — siempre,
> fijo (`channel: "callcenter" as const`), desde el primer commit del componente (`07a3dee0`).
> El bug real es el opuesto al descrito aquí: `CitaModal` es un modal COMPARTIDO por 3 pantallas
> (`medicas-calendar.tsx`, `dia-view.tsx` — ambas call-center de verdad — y
> `acciones-paciente-sheet.tsx`, la ficha del paciente, que NO es call-center), y las 3 mandaban
> `callcenter` por igual. Cualquier cita creada desde la ficha del paciente, por CUALQUIER
> personal con acceso a ella, ya le atribuía la cartera del paciente a quien la creó — en
> producción, desde julio-2026. Arreglado agregando un prop `canal` explícito a `CitaModal`:
> `medicas-calendar.tsx`/`dia-view.tsx` pasan `"callcenter"`, `acciones-paciente-sheet.tsx` no
> pasa nada (cae al default del BE, `atencion`). El resto de este documento es el diagnóstico
> ORIGINAL (incorrecto), dejado tal cual para que quede el rastro de por qué se pensó así.

# Bug — la pantalla de call-center nunca manda `canal`, así que nadie estrena cartera

**Reportado por:** call-center / control de citas, WhatsApp, 02-oct-2026 — *"al crear paciente
nuevo, no indica usuario de Control de citas"*. Confirmado por el dueño: el usuario de
call-center debe aparecer y **permanecer** como dueño del paciente, sin que nadie lo
sobre-escriba — es la cartera de ese agente (comisiones). Ver memoria
`el-paciente-es-cartera-de-su-agente.md`.

## Causa raíz, verificada leyendo el código (no supuesta)

`components/agenda/cita-modal.tsx` — la pantalla de `/scheduling/appointments/...`, usada por
**call-center/control de citas** — **nunca manda `canal` en el payload de `POST citas`**
(`grep canal` sobre el fichero: cero resultados).

Del lado de `cmr-be` (`el-paciente-es-cartera-de-su-agente.ts`, `duenoDeLaCartera`), la regla ya
está bien construida (regla del dueño, 22-sep-2026, con su propio caso real: 236 citas con 8
personas de recepción sentadas en el campo de comisiones):

```ts
// Paciente sin agente todavía: solo lo estrena quien agenda DESDE el call-center.
if (canal === CANAL_CALLCENTER && autorLogueado) return autorLogueado;
return null;
```

`CANAL_CALLCENTER = 'callcenter'`. Como el servidor resuelve `canal ?? 'atencion'`
(`citas.service.ts`, `quienFirmaLaCita` → `dto.canal ?? 'atencion'`) cuando el cliente no lo
manda, **toda cita creada desde esta pantalla entra como si viniera de Atención** — nunca
"estrena" al agente de call-center como dueño, aunque la persona esté genuinamente logueada como
agente de call-center citando a un paciente sin cartera todavía.

**No es un bug de lectura (eso ya se revisó y es correcto — ver
`bug-primera-vez-fuerza-medico-handoff-fe.md` del mismo lote): es que el dato nunca se manda al
crear.**

## El fix (en el FE)

En `components/agenda/cita-modal.tsx`, al construir el payload de `POST citas` desde
`/scheduling/appointments` (y cualquier otra pantalla que sea genuinamente call-center, si la
hay), agregar:

```ts
canal: 'callcenter',
```

**No tocar nada más** — la regla de "la cartera sigue al paciente y nunca se sobrescribe" ya vive
entera en el backend (`duenoDeLaCartera`), probada, y sigue intacta: esto solo le da el dato que
le falta para activarse donde corresponde.

## Qué significa "permanece sin sobrescribirse" (ya construido, no hace falta nada más)

Confirmado leyendo el mismo fichero (`agenteDelPaciente`, `CAMPOS_QUE_EDITA_UPDATE` en
`el-paciente-es-cartera-de-su-agente.ts`): una vez un paciente tiene agente, **ninguna cita nueva
ni edición posterior lo cambia** — `callcenterId` ni siquiera está en la lista de campos que
`update()` puede tocar. Eso ya funciona; lo único que falta es que la PRIMERA cita de un paciente
nuevo, hecha desde esta pantalla, pueda estrenar al agente correcto en vez de nacer sin dueño.

## Qué NO se tocó

- No se cambió nada en `cmr-be` — la regla ya existe y es correcta.
- No se tocó producción — verificado por lectura de código y `grep`, sin crear citas de prueba.
