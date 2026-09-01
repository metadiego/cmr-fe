# HANDOFF BE — Enriquecer el aviso del Panel (nombre/récord del paciente + sección + servicio)

> El panel funciona; falta DATO en el payload. Hoy el aviso a pantalla completa no puede mostrar el
> PACIENTE porque el endpoint/SSE solo devuelve ids. Es lo que el/la enfermera necesita ver.

## Verificado en prod (GET /paneles/enfermeria/notificaciones y POST /notificar)
La notificación devuelve solo:
`{ id, panelId, seccionId, sesionId, citaId, pacienteId, estado, notificadaPorId, aceptadaPorId, aceptadaEn, meta }`
→ **sin** `pacienteNombre`, **sin** `record`, sin `servicioNombre`, y la sección viene como `seccionId`
(no `seccion`/`color`/`audio`). El FE ya resuelve la sección (color/label/audio) desde
`/paneles/enfermeria/definicion`, pero el **paciente** no lo puede pintar.

## Pedido (enriquecer en la LISTA y en el evento SSE)
En `GET /paneles/:clave/notificaciones` y en el evento SSE `entidad:"panel_notificacion"` (`estado`),
incluir además de los ids:
- `pacienteNombre` (nombre completo para el título gigante).
- `record` (número de récord del paciente — clave para que la enfermera lo identifique).
- `servicioNombre` (servicio que originó el aviso, p. ej. "Sueroterapia Vitamina C").
- `seccion` (clave, p. ej. `intravenoso`), `color`, `audio` (para no depender de un join en el FE; el SSE
  debe ser autosuficiente).
- (opcional) `sesionNumero`/`sesionesTotales` si es barato, para mostrar "sesión X de N" en el aviso.

## Nota
Ojo: `record` sale del paciente y hoy ~60% están sin récord por la migración incompleta
(ver `pacientes-record-backfill-historia-handoff-be.md`). Al enriquecer, mandar `record` cuando exista.
El FE ya está listo para pintar estos campos en cuanto lleguen (título = `pacienteNombre`, subtítulo =
`record` + `servicioNombre`; color/sección desde el payload o la definición).
