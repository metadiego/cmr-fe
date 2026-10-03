# Traer al día deja al paciente PRESENTE, y cada quien elige con qué pestaña abre Consulta

**BE:** desplegado y verificado en producción el 3-oct-2026. **FE:** tres cosas, todas de pantalla.

## De dónde sale

Yadira, de mostrador: llega el paciente, ella pulsa **agregar cita** y se la pone para hoy — a eso
le llaman **«traerla al día»**. El sistema mejoró y ahora el call center ya trae a los pacientes
**confirmados**, pero eso le dejó una lista de 49 nombres delante, y cuando el paciente que tiene
enfrente ya está en esa lista, el sistema la mandaba a buscarlo.

> «lo que deseo es que siga siendo así para ellos […] el usuario solo hace exactamente lo que viene
> haciendo con el botón de dar citas»

## 1. El gesto no cambia, pero ahora deja al paciente presente

Ya está en el BE, **sin que el FE tenga que hacer nada distinto**: el mismo `POST` de crear cita.

- **Si el paciente no tenía cita hoy** → se crea y nace presente.
- **Si ya estaba confirmado** → no se crea otra ni hay que buscarla: se reutiliza la cita viva y se
  ejecuta el Presente completo — sella la llegada, abre el récord y empuja al EHR.
- **Si ya estaba presente o más avanzado** → no se repite nada (la hora de llegada no se mueve).

## 2. El paciente NUEVO sigue pidiendo sus datos, y ahí entra lo tuyo

Al nuevo no se le puede marcar presente sin los cinco datos del EHR. El `POST` responde **400** con:

```json
{ "error": { "code": "PACIENTE_DATOS_REQUERIDOS",
             "faltantes": ["docId", "sexo", "fechaNacimiento"] } }
```

Es el mismo error que ya manejas en el modal de Presente. **Lo que hay que añadir:** si el usuario
cierra ese modal con ESC o como sea, **dejar la pantalla filtrada en ese paciente** para poder
rematarlo. El dueño insistió en esto:

> «si por alguna razón se cierra el modal, dejar filtrado ese paciente, que aunque no lo creas pasa
> y mucho; los casos que pueden parecer locos, inverosímiles, algo que nunca pasaría, sí suceden»

Repetir «citar» también lo resuelve —el sistema no duplica— pero no debe depender de que ella se
acuerde.

## 3. Con qué pestaña abre el tablero de Consulta: es de la PERSONA

Campo nuevo en la ficha de personal. Verificado en producción:

```
GET/PUT /api/v1/personal/:id   → pestanaInicialConsulta: "presente" | null
GET/PUT /api/v2/staff/:id      → consultationBoardInitialTab
```

- `"presente"` → el tablero abre en Presente **aunque esté vacío**. Es lo que quiere mostrador: no
  ve la lista de confirmados y hace lo de siempre.
- `null` (lo que tienen todos hoy) → abre como abre ahora. **Nadie nota el cambio hasta que lo
  pide.**

Acepta la clave de cualquier estado del tablero, no solo `presente`: si mañana alguien quiere abrir
en Triage, es un dato, no código.

**Dónde ponerlo en la UI:** en la ficha de personal, junto a «aterriza directo en la pestaña
Consulta» (`frontdeskStartsOnConsultation`), que es su hermano. El dueño pidió que se vea «bien
identificado e intuitivo» — algo como «Al abrir Consulta, mostrar: [Como está configurado ▾ /
Solo los presentes]».

**El orden de las pestañas NO se toca.** Confirmada seguirá antes que Presente para todos: lo que
cambia es cuál viene **seleccionada** al abrir, que es de quien mira.

Razón completa: `cmr-be/docs/specs/traer-al-dia-deja-al-paciente-presente.md`.
