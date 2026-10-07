# Handoff BE — "paciente nuevo" para el candado del EHR mira la señal equivocada

## El bug (dueño, 07-oct-2026, en producción real)

Varios pacientes de tipo **Seguimiento** (regulares de la clínica) disparan el modal de "faltan
datos del EHR" al marcar Presente — un bloqueo que según el contrato (`be-ehr-integration-presente-handoff.md`)
**solo debe aplicar a pacientes nuevos**.

## Causa real (verificada leyendo el código, no supuesta)

`EhrIntegrationService.esPacienteNuevo()` (`ehr-integration.service.ts`, alrededor de la línea
316):

```ts
/** Nuevo = nunca se le selló una llegada antes. Una cita agendada que nunca llegó no cuenta. */
private async esPacienteNuevo(pacienteId: string): Promise<boolean> {
  const citas = await this.citasRepo.find({ where: { pacienteId } });
  return !citas.some((c) => !!c.llegadaEn);
}
```

Mira si el paciente **alguna vez tuvo un "Presente" sellado** (`llegadaEn`). El dueño señala
correctamente por qué esa es la señal equivocada:

> Presente nada tiene que ver con si el paciente es nuevo o de seguimiento — cualquiera puede estar
> presente. Un paciente puede marcarse Presente y marcharse sin ser atendido; ese Presente NO
> significa que la próxima consulta ya es de seguimiento.

Un paciente que llegó, se marcó Presente, y se fue sin ser visto queda "ya no nuevo" para siempre
— exactamente el caso real que se está viendo hoy en producción (confirmado: el bug de hoy
`278e7b6d`/`1f15ed15` en citas, que hacía que el auto-presente nunca sellara `llegadaEn`, es una
causa ADICIONAL de pacientes con historial sucio, pero el defecto de fondo es independiente de ese
bug y seguiría existiendo aunque `llegadaEn` estuviera perfecto).

## El pedido

`esPacienteNuevo()` debe mirar si el paciente alguna vez tuvo una cita **efectivamente atendida**
(`estado = 'atendida'` / su columna de sello equivalente, p. ej. `atendidaEn`), NO si alguna vez
tuvo un `llegadaEn`. "Es Seguimiento" = ya fue atendido al menos una vez. Hasta que eso pase, sigue
contando como nuevo — sin importar cuántas veces haya estado Presente sin ser visto.

## No-scope

- No se pide tocar `checkReadiness()` ni la combinación `bloquear: habilitadoParaElTipo && !listo
  && (bloquearSoloNuevos ? nuevo : true)` — esa fórmula está bien, el insumo (`nuevo`) es lo que
  está mal calculado.
- No se pide backfill de datos históricos salvo que el BE lo considere necesario al cambiar la
  fuente de verdad (pacientes que hoy están mal clasificados por este bug podrían quedar
  corregidos solos en cuanto `esPacienteNuevo()` mire `atendida` en vez de `llegadaEn`).
