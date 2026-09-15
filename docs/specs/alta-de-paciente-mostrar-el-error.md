# Alta de paciente: enseñar el motivo cuando el guardado falla

**Fecha:** 2026-09-15 · **De:** BE · **Para:** FE

## Qué se vio

Recorriendo el flujo del call-center con la operadora real, `POST /api/v2/patients` devolvió 400 y
la pantalla **no mostró nada**: el panel se quedó abierto, sin mensaje, sin marcar ningún campo. La
operadora solo ve que el botón no hace nada.

El BE sí decía el motivo, en `error.details`:

```
{"error":{"code":"VALIDATION_ERROR","message":"Validation failed",
  "details":[{"message":"property apellido should not exist"},
             {"message":"property zip should not exist"}]}}
```

## Qué hace falta

En `components/clientes/paciente-form-sheet.tsx`, al fallar `createPaciente` / `updatePaciente`,
mostrar el error como ya se hace en facturación (`toastError`), y si `error.details` trae campos,
marcarlos en el formulario. Un guardado que falla en silencio es indistinguible de una pantalla rota.

## Estado del BE

La causa de ESE 400 ya está corregida y desplegada (ver `cmr-be/docs/specs/sinonimos-en-el-cuerpo-de-v2.md`):
el alta funciona. Lo que queda es que un fallo futuro se vea.
