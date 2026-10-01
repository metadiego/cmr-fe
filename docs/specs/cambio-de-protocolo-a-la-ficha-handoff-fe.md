# Handoff FE — Cambio de protocolo se muda a la FICHA del paciente

**Origen**: el dueño, 1-oct-2026: *«vamos a mover cambio de protocolo a la ficha del paciente, un
nuevo tab, y luego que esté hecho saca de las rutas del menú a cambio de protocolo»*.

La razón de fondo: un cambio de protocolo es una decisión sobre el tratamiento de **una persona**.
Buscarla desde una pantalla propia es empezar por el sitio equivocado; en su ficha ya se sabe de
quién se habla.

## Lo que hace falta en el FE

Una pestaña nueva en la ficha del paciente, junto a Citas e Historia. Dos llamadas, las dos ya
desplegadas:

### Lo que ya tuvo (para pintar la pestaña)

```
GET /api/v2/invoices/packages/protocol-change/:patientId
```

Devuelve los cambios **del más reciente al más viejo**, agrupados por cambio:

```json
[ { "cambioId": "…", "fecha": "2026-09-20T10:00:00Z", "motivo": "alergia",
    "medicoId": null, "actorId": "…",
    "paquetesCerrados": ["…"], "paquetesCreados": ["…"] } ]
```

Un cambio es **un hecho** —un día, un motivo, un médico— aunque mueva varios paquetes: por eso viene
agrupado y no una fila por paquete. `medicoId` puede ser `null`: la decisión pudo no registrarlo, y
eso se muestra, no se esconde.

### Lo que falta por hacer (la acción) — **sin cambios**

```
POST /api/v2/invoices/packages/protocol-change/:patientId
```

Idéntico a hoy, mismo cuerpo y mismo permiso (`tratamiento.cambio_protocolo`). Las terapias
pendientes que se ofrecen siguen saliendo de `GET /invoices/delivery-pending?patientId=`.

## Lo que el BE ya hizo

- **El ítem de menú `cambio-de-protocolo` está OCULTO** (`visible: false`). La ruta
  `/pacientes/cambio-de-protocolo` ya no aparece. Si la pantalla suelta sigue existiendo en el FE,
  podéis retirarla cuando la pestaña esté.
- Herramienta MCP de lectura nueva (`patient_protocol_changes`), mismo permiso.

## Lo que NO cambia

- El endpoint de aplicar el cambio, su cuerpo, su permiso y su comportamiento: iguales.
- Los dos cambios que ya existen en producción se ven en la pestaña desde el primer día.
