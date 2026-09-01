# Handoff BE — datos para gating data-driven del flujo láser (técnico + campos requeridos)

## Contexto
El BE ya valida y rechaza (PR #164): En terapia exige técnico si `requiereTecnico`; Asistido exige los
campos requeridos del servicio. El FE ya muestra ese 400 (toast) y habilita el botón siguiente solo tras el
paso previo. Falta que el FE **deshabilite proactivamente** (mejor UX) SIN hardcode — para eso necesita
DATOS del BE, hoy ausentes.

## Lo que el FE necesita del BE (data-driven, nada hardcodeado)

### 1) Campos requeridos por servicio → `servicio.formAcciones`
Hoy `GET /servicios` devuelve `formAcciones: null` (verificado en prod, láser). Para poder bloquear
**Asistido** hasta que estén completos los inputs requeridos (p. ej. áreas/aplicadas), exponer:
```jsonc
"formAcciones": {
  "campos": [
    { "clave": "aplicadas", "labelKey": "fd.col.aplicadas", "requerido": true, "en": "asistido" }
  ]
}
```
- `clave`: la columna/dato de la sesión que debe estar lleno.
- `requerido`: bool. `en`: en qué transición se exige (asistido).
Con eso el FE deshabilita Asistido mientras falte un requerido, y ya no depende solo del rechazo 400.

### 2) Marca de "estado requerido" en la columna del select → `render.requiereEstado`
Para deshabilitar el **select de técnico** hasta que la sesión esté `presente` (regla: "agregar técnico
requiere estar presente"), la columna `fd_tecnico` debe declararlo por dato, p. ej.:
```jsonc
"render": { "optionsSource": "tecnicos", "writeBinding": "sesion.tecnicoId", "requiereEstado": "presente" }
```
El FE deshabilita cualquier select editable cuyo `render.requiereEstado` no se cumpla aún (genérico, no
hardcodea `fd_tecnico`). Aplica igual a enfermera u otros a futuro.

## FE (cuando lleguen los datos)
- Asistido `disabled` si algún `formAcciones.campos[].requerido` (para esa transición) está vacío en la fila.
- Select `disabled` si `render.requiereEstado` no está cumplido (comparando con el estado/sellos de la sesión).
Sin datos → el FE se queda como hoy (BE rechaza + toast), que ya es correcto pero menos guiado.

## Aceptación
- Quitar `requiereEstado` de la columna → el select deja de bloquearse (prueba de que es data-driven).
- Marcar un campo `requerido:false` → Asistido deja de exigirlo. Todo por dato, sin tocar FE.
