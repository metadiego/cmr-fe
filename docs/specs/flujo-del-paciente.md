# El flujo del paciente (dos flujos)

> Relato del dueño (12-ago-2026), organizado. Esta es la hoja de ruta: el producto se desarrolla siguiendo
> el recorrido del paciente, no por dominios aislados.

Hay **dos flujos** distintos. El primero es la **consulta médica** (Citas → Atención). El segundo es la
**venta de servicios** (Facturación general → Frontdesk de Servicios). Un mismo paciente puede pasar por
uno, por el otro, o por los dos.

---

## Flujo 1 — Consulta médica: Citas → Atención

1. **Agendar (Call Center).** Llama el paciente; el equipo de call center crea la cita en el módulo de
   **Citas**. La cita puede ir a **cualquier fecha**, sin problema.
2. **Nuevo o de seguimiento.** El paciente es **nuevo** o **de seguimiento**.
3. **Confirmar = entra a Atención.** Cuando la cita se **confirma**, el paciente entra al módulo de
   **Atención** (el segundo tramo del flujo). *Solo entra a Atención si está confirmada.*
4. **Llega a la clínica → Presente.** Cuando el paciente realmente llega, se marca **Presente**.
5. **Vitales + enfermera.** Se le toman los **vitales**; en ese paso se asigna la **enfermera/o** que lo
   atendió — para llevar la **estadística de ese enfermero/a**.
6. **Pasa al médico.**
   - Si es **nuevo**, se le **asigna un médico**.
   - Si es de **seguimiento**, ya debería **tener su médico**.
7. **Acciones → Factura.** Hay un botón **"Acciones"** donde se le hace la **factura** al paciente.
8. **Lo que se registra en este flujo:**
   - Estadística del **paciente** (que fue atendido).
   - Estadística del **médico**.
   - **Registro** del paciente (queda como atendido).

### Regla del "nuevo" (importante)

El paciente es **nuevo una sola vez**: deja de serlo **después de su primera cita ATENDIDA**.
Si fue citado muchas veces (p. ej. 10) pero **nunca fue atendido**, sigue siendo **nuevo**. Lo que quita el
"nuevo" es haber sido **atendido**, no haber sido citado.

---

## Flujo 2 — Venta de servicios: Facturación general → Frontdesk de Servicios

1. **Facturación general.** El mismo paciente (u **otro cualquiera**) entra por **Facturación general** y se
   le hace su **factura**.
2. **Emitir = entra al Frontdesk de Servicios.** Cuando se **emite** la factura, el paciente entra al
   **frontdesk de Servicios**.
3. **Los servicios vendidos.** Ahí el paciente entra a los distintos **servicios** que le fueron vendidos.
   El consumo puede ser **por dosis, por cantidad, por sesión, por vial** — sea como sea, el paciente entra.
4. **Lo que se registra en este flujo:**
   - Estadística del **médico** (si el servicio lleva médico).
   - Estadística de la **enfermera/o** (si lo aplica una enfermera).
   - Estadística del **técnico** (si lo aplica un técnico).
   - **Registro absoluto de la disponibilidad de terapias** del paciente (qué terapias lleva y cuánto le
     queda).

---

## Resumen de disparadores y registros

| Flujo | Disparador de entrada | Quién lo mueve | Estadísticas que alimenta |
|---|---|---|---|
| 1 · Atención | Cita **confirmada** | Call center → recepción → enfermera → médico | Paciente atendido, médico, registro |
| 2 · Servicios | Factura **emitida** | Facturación → frontdesk | Médico / enfermera / técnico según el servicio, disponibilidad de terapias |

## Notas de implementación (estado actual)

- El paso "confirmar → entra a Atención" hoy está **roto por el BE**: `agenda-dia` proyecta `estado:null` y
  `medico:"Sin Medico"` pese a tener datos reales, así que el desplegable para confirmar en la agenda no
  funciona. Handoff: `docs/specs/agenda-dia-estado-y-medico-nulos-handoff-be.md`.
- Crear la cita ya **confirmada** (para citas de hoy) y el selector de médico que nunca sale vacío ya están
  en el FE.
