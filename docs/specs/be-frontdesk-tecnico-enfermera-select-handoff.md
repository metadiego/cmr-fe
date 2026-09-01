# Handoff BE — TERAPEUTA/TÉCNICO (y Enfermera) como SELECT editable en el Frontdesk

## Pedido del dueño (paridad con el legacy `laser.png`)
En el frontdesk viejo, la columna **TERAPEUTA** es un desplegable por fila para asignar el técnico que
atiende esa sesión. En el nuestro sale una rayita porque la columna es de **solo lectura**.

## Estado actual (verificado en prod)
`GET /tablero/columnas?tablero=servicios`:
- `fd_tecnico` → `tipo: "texto"`, `binding: "tecnico.nombre"`, `editable: false`, `render: null`.
- `enfermera` → `tipo: "texto"`, `binding: "enfermera.nombre"`, `editable: false`, `render: null`.

## Lo que debe hacer el BE (idéntico al patrón de DOSIS ya entregado, PR #137/#138)
Redefinir esas columnas (POR API del constructor, no SQL) como **select editable**:
- `fd_tecnico`: `tipo: "select"`, `editable: true`,
  `render: { optionsSource: "<fuente de técnicos>", writeBinding: "sesion.tecnicoId" }`.
- `enfermera` (o una `fd_enfermera` activa): `tipo: "select"`, `editable: true`,
  `render: { optionsSource: "<fuente de enfermeras>", writeBinding: "sesion.enfermeraId" }`.
- **optionsSource** de personal: que devuelva el personal elegible del centro (idealmente filtrable por el
  `requiereTecnico`/`requiereEnfermera` del servicio; en el legacy era `loginpass.exclusivo = codconsulta`).
  Resolver por el MISMO endpoint de opciones data-driven (`GET /tablero/opciones?tablero=<servicio>&columna=fd_tecnico`).
- `editarCelda`/dispatch para entidad `sesion` ya soporta writeBinding (dosis) → reusar: escribir
  `sesion.tecnicoId` / `sesion.enfermeraId` con evento `campo_editado` (antes/después + actor).

## FE: NADA nuevo
El renderer del frontdesk YA pinta cualquier columna `select` editable como dropdown data-driven y escribe
vía `editarCelda` (lo hace con `fd_dosis`). En cuanto el BE cambie el tipo + optionsSource + writeBinding,
el selector de Terapeuta/Enfermera aparece solo, sin tocar FE.

## Aceptación
- En Láser, la columna Terapeuta es un desplegable con los técnicos del centro; elegir uno fija
  `sesion.tecnicoId` (auditable) y se ve al instante.
- Un técnico nuevo del centro aparece en el desplegable sin tocar código (data-driven).
