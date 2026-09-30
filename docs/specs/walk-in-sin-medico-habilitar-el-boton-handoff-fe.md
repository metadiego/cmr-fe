# Handoff FE — el walk-in NO necesita médico: quitad el asterisco y habilitad el botón

**Origen**: el dueño, 30-sep-2026, con el modal «Add appointment · WALK-IN» delante: el paciente
SANCHEZ DE PIÑERO, PALMIRA, tipo **Consulta (Nueva)**, médico en «No doctor assigned», y
**«Add to board» deshabilitado**. Su regla: *«debe permitir pacientes sin médico, y si no tiene
médico asigna automáticamente "Sin Medico"»*.

## Lo verificado en el código del BE (no supuesto)

**El backend NO exige médico para este caso.** `CreateCitaDto.medicoId` es `@IsOptional()`, y la
única regla que lo pide está en `en-atencion-el-medico-se-sabe-despues.ts`, que exige médico **solo
cuando se cumplen TODAS**:

1. el tipo de cita lo requiere, **y**
2. la cita no trae médico, **y**
3. el canal **no** es `atencion`, **y**
4. **no** es primera vez, **y**
5. al paciente **ya lo atendieron antes**.

Un walk-in de **Consulta (Nueva)** es primera vez, así que la condición 4 no se cumple y **el BE
acepta la cita sin médico hoy mismo**. El asterisco y el botón bloqueado son del FE.

> Y hay una razón de negocio detrás, ya escrita: desde Atención el médico **se asigna al marcar
> presente**, no al agendar. Pedirlo antes es pedir un dato que recepción todavía no tiene — el
> mismo error que ya se corrigió con la enfermera en frontdesk.

## Lo que se pide al FE

1. **Quitar el `*` de DOCTOR** en el modal de walk-in.
2. **Habilitar «Add to board»** sin médico seleccionado.
3. **Mandar `medicoId` ausente** (no `null` en un campo que espere uuid, no cadena vacía): omitir la
   clave. El DTO es `@IsOptional() @IsUUID()`, así que una cadena vacía sí daría 400.
4. Dejar «No doctor assigned» como opción legítima del select, no como estado de error.

## Lo que hace el BE por su parte

Cuando la cita llega **sin médico**, el BE le estampa el **«Sin Medico» del centro** —el registro de
personal con `legacyCode = '000'`, que es como lo nombra el legado y como ya se respeta en las
fichas de paciente—. Así la cita nunca queda con el campo en blanco y los informes por médico
cuadran, sin que el FE tenga que elegir nada ni conocer ese id.

Si luego se asigna el médico de verdad al marcar presente, lo sustituye con normalidad: «Sin Medico»
es el valor por defecto, no un candado.

**Estado**: el «Sin Medico» de **Caguas** ya existía (`legacyCode 000`). El de **Bayamón faltaba** y
se crea con este trabajo. Se avisa aquí cuando esté desplegado.

## Lo que NO cambia

- El select de médicos sigue igual y se puede elegir uno desde el principio.
- Los tipos de cita que SÍ exigen médico en sus condiciones lo siguen exigiendo: esto no apaga la
  regla, solo deja de pedir lo que la regla nunca pidió.
