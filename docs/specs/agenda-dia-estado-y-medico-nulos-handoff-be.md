# HANDOFF BE — `agenda-dia` proyecta `estado: null` y `medico: "Sin Medico"` con datos reales (regresión)

**Descubierto probando en producción el 12-ago** (cita de LISANDRO ARCILES INFANTE, record 111, Caguas,
`d5ae3799-6f2d-4a0c-ad39-22e55d46ccd6`). El dueño reportó que **desapareció el botón/desplegable para pasar
la cita a "confirmada"** en `/citas/agenda/2026-08-12`, y que el estado sale como texto crudo `citas.estado.`.

## La verdad del servidor (dogfood, no suposición)

`GET /api/v1/citas/:id` de esa misma cita, ahora mismo:

```
estado = "programada"   medicoId = "7856f0b2-65e9-46a1-b485-cfaa7b248395"   hora = "07:00"   tipoCitaId = "3416b2ae-…"
```

Pero `GET /api/v1/citas/agenda-dia?fecha=2026-08-12` proyecta esa fila así:

```jsonc
{
  "id": "d5ae3799-…",
  "estado": null,                 // ← DEBERÍA ser "programada"
  "medico": "Sin Medico",         // ← DEBERÍA ser el nombre del médico 7856f0b2-…
  "medico__valor": "7856f0b2-…",  // el id SÍ está bien resuelto
  "hora": null, "tipo": null,     // (ok: se muestran en el encabezado de la franja)
  ...
}
```

La definición `citas_cc` está bien: `estados = [programada, confirmada]`, transición
`confirmar: programada → confirmada`. El FE está bien: pinta el desplegable de estado data-driven y, con un
`estado` válido, dejaría elegir "Confirmada" → dispara `confirmar` → la cita entra al tablero de Atención.

## Los dos huecos del BE (proyección de `agenda-dia`)

1. **`estado` llega `null`** aunque la cita tiene estado real (`programada`). Con `estado` vacío, el
   selector del FE queda en modo candado (no hay estado que casar con el catálogo) y no se puede confirmar.
   **Proyectar la clave real del estado** (`@.estado`) en cada fila. Es una **regresión**: antes funcionaba.

2. **`medico` (display) llega `"Sin Medico"`** aunque `medico__valor`/`medicoId` es un id válido. El
   resolvedor de nombre no está encontrando al médico. **Resolver el nombre del médico** cuando hay
   `medicoId`; solo mostrar "Sin médico" cuando de verdad no hay ninguno.

## Cómo se comprueba al terminar (el FE lo verifica, sin adivinar)

- `GET /citas/agenda-dia?fecha=<hoy>&centroId=<Caguas>` → la fila de esa cita trae `estado:"programada"` y
  `medico:"<nombre real>"`.
- En pantalla, la columna Estado vuelve a ser un desplegable (Agendada/Confirmada); al elegir "Confirmada"
  la cita pasa a `confirmada` y aparece en el tablero de Atención (que filtra `visibleEnAtencion`).

## Contexto

- Proyección: la arma el motor de tableros al resolver los `binding` (`@.estado`, el select de médico).
  `medico__valor` (el id) se resuelve bien; falla el DISPLAY de `estado` y el DISPLAY de `medico`.
- Cita de ejemplo: `d5ae3799-6f2d-4a0c-ad39-22e55d46ccd6` (Caguas). Reproducible hoy.
- Del lado del FE ya se dejó: selector de médico que nunca sale vacío ("Sin médico" por defecto), crear la
  cita ya "Confirmada" (toggle, por defecto en citas de hoy), y un respaldo para que un estado vacío nunca
  pinte `citas.estado.` a medias. Pero el desplegable de la fila solo revive cuando el BE mande el estado.
