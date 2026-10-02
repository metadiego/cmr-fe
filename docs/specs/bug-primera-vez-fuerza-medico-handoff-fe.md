# Bug — "Primera vez" nace en `false` y fuerza a pedir médico a pacientes nuevos

**Reportado por:** call-center / control de citas, WhatsApp, 02-oct-2026 — *"al citar a paciente
nuevo pide que se le asigne medico nuevo"*. Confirmado por el dueño: *"cuando el paciente es
nuevo NO debe exigir ningún médico"* — el médico se asigna después, en Frontdesk → tab Consulta,
nunca al citar desde call-center.

## Causa raíz, verificada leyendo el código (no supuesta)

`components/agenda/cita-modal.tsx`:

```
108:  const [esPrimeraVez, setEsPrimeraVez] = React.useState(cita?.isFirstVisit ?? false);
132:  const esPrimeraVezEff = yaSeguimiento ? false : esPrimeraVez;
133:  const medicoRequired = !!tipo?.requiresDoctor && !esPrimeraVezEff;
190:        isFirstVisit: esPrimeraVezEff,
```

La casilla **"Primera vez" nace SIN marcar**, y el payload manda **siempre** un booleano
explícito (`isFirstVisit: false` por defecto) — nunca "sin decidir".

Del lado de `cmr-be` (`un-paciente-conocido-es-seguimiento.ts`, `marcaDePrimeraVisita`):

```ts
export function marcaDePrimeraVisita(entrada) {
  if (entrada.declarado !== undefined) return entrada.declarado;   // ← SIEMPRE entra aquí
  if (esPacienteConocido(entrada.paciente)) return false;          // ← nunca se alcanza
  return entrada.tipoEsPrimeraVisita;
}
```

El backend YA tiene un chequeo inteligente basado en los datos del paciente (récord, historial,
médico asignado) para decidir si de verdad es primera vez — pero **solo corre cuando el cliente
NO declara nada** (`declarado === undefined`). Como el FE manda `false` explícito siempre que
nadie toca la casilla, ese chequeo nunca se ejecuta: el backend obedece ciegamente el `false` del
FE, y como la mayoría del personal de call-center no sabe (o no tiene por qué saber) que debe
marcar "Primera vez" a mano para cada paciente nuevo, el sistema trata a casi todos como
seguimiento — y entonces si el tipo "Consulta (Nueva)" exige médico, lo exige también a ellos.

## El fix (en el FE)

**No mandar `isFirstVisit` en el payload a menos que el usuario haya tocado la casilla
explícitamente.** Pasar de un booleano forzado a un estado de tres posiciones
(`undefined | true | false`):

- Al abrir el modal: `esPrimeraVez` nace `undefined` (no `false`).
- `onCheckedChange` lo pone en `true`/`false` según lo que el usuario marque.
- En el payload: `isFirstVisit: esPrimeraVez` (puede viajar `undefined`, y el backend entonces
  SÍ corre su propio chequeo por los datos — que es exactamente el diseño original, documentado
  en `cmr-be/docs/specs/un-paciente-conocido-es-seguimiento.md`).

Con esto: un paciente genuinamente nuevo (sin récord, sin historial, sin médico en ficha) nunca
exige médico, sin que nadie tenga que acordarse de marcar una casilla — y si el personal SÍ sabe
que es un conocido que viene por otra vía, puede seguir desmarcando/marcando a mano, y eso sigue
mandando sobre los datos (comportamiento actual, no cambia).

## Qué NO se tocó

- No se cambió nada en `cmr-be` — la lógica de `seExigeMedico`/`marcaDePrimeraVisita` ya hace lo
  correcto; el bug es que nunca llega a correr.
- No se tocó producción — todo esto se verificó leyendo código y con un GET real contra
  `/api/v2/appointments/day-agenda`, sin crear ninguna cita de prueba.
