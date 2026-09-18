# Handoff BE → FE — el médico del paciente desaparece en «Agregar cita» cuando es de OTRO centro

**Origen:** reporte del dueño, 17-sep-2026, con el récord 111 de Caguas (Lisandro Arciles
Infante) como caso real: su médico es Idamys Herrera, cuya ficha vive en Bayamón
(`serviceCenters: ["ef6f87b0-…"]`, home `clinicId` Bayamón). El modelo es correcto y ya
verificado por API: `GET /patients?codigoLegacy=136261` en Caguas devuelve `doctorId` +
`doctorName: "Idamys Herrera"` sin problema — el médico no está atado a un centro
(`docs/specs/el-medico-no-esta-atado-a-un-centro.md`).

## Causa exacta (leído en el código, no supuesto)

`components/tablero/agregar-cita-modal.tsx`:

- Línea 68: `medicos` (las opciones del `<Select>`) sale de
  `getOpciones(tablero, "medico", centroId)` — el catálogo de médicos **filtrado al centro
  activo** (`centrosServicio`/`serviceCenters` debe incluir ese centro).
- Línea 78: al elegir el paciente, `setMedicoId(p.doctorId)` **sí** guarda el ID correcto de
  Idamys Herrera en el estado.
- Líneas 149-158: el `<Select value={medicoId}>` (Radix/shadcn) solo puede mostrar una
  etiqueta si existe un `<SelectItem value={medicoId}>` entre las opciones. Como Idamys
  Herrera no está en `medicos` (no presta servicio en Caguas), no hay ningún `SelectItem` con
  ese `value` → el `<Select>` se ve **vacío**, aunque el estado interno (`medicoId`) sí tiene
  el valor correcto y el `POST /citas` que se enviaría sería correcto si el usuario no toca el
  campo.

**No es un bug de datos.** `doctorId`/`doctorName` del paciente están bien; es que el
desplegable solo ofrece médicos DEL centro y no hay una rama para "el médico ya asignado, sea
de donde sea".

## Lo que pide el dueño (textual)

> «no estoy de acuerdo con eso, debería de igual manera mostrar el médico dando una clara
> advertencia que ese médico no es de ese centro, pero es el médico, a menos que lo cambien o
> le asignen otro.»

## Fix propuesto (en `agregar-cita-modal.tsx`, mismo patrón que ya usa el archivo)

Cuando `paciente.doctorId` no está en `medicos` (el catálogo centro-scoped), agregar una
`SelectItem` EXTRA para ese médico —usando `paciente.doctorName` para la etiqueta— con algo
visual que marque "no es de este centro" (icono/color/sufijo, a criterio de diseño), en vez de
dejar el `<Select>` sin ítem coincidente. Ejemplo de forma (no de estilo):

```tsx
const medicoDelPaciente =
  paciente?.doctorId && !medicos.some((m) => m.value === paciente.doctorId)
    ? { value: paciente.doctorId, label: paciente.doctorName ?? paciente.doctorId, foraneo: true }
    : null;
```

y renderizar ese ítem antes o después de `medicos.map(...)`, con su marca de "otro centro". Si
el usuario lo cambia o asigna otro desde el propio `<Select>`, el comportamiento ya existente
no cambia — solo se añade la opción que hoy falta.

## Un hueco de tipos que van a pisar al hacerlo

`paciente.doctorName` (v2) / `medicoNombre` (v1) **existe en runtime** — verificado por HTTP
(`curl .../api/v2/patients?codigoLegacy=136261` devuelve `"doctorName":"Idamys Herrera"`) — pero
**no está en `lib/api/schema.d.ts`**: el BE lo agrega hoy como propiedad suelta sobre un tipo
intersección (`PacienteConEdad`, en `pacientes.service.ts`), sin un DTO de respuesta con
`@ApiProperty`, así que Swagger no lo documenta y el codegen no lo trae. Lo mismo le pasa a
`edad`, `sexoLabel` y `nombreMostrar` — es un hueco más amplio, no solo de `doctorName`.

**Mientras tanto:** usar `(paciente as unknown as { doctorName?: string }).doctorName` o
extender el tipo `Paciente` localmente; el campo SÍ llega, solo no está tipado. Voy a cerrar el
Swagger de estos 4 campos como trabajo de BE aparte (no bloquea este fix del `<Select>`, que ya
puede construirse hoy).
