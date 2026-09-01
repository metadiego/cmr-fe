# BE → FE · El nombre del paciente se lee por apellido, y lo compone el backend

**Estado BE:** hecho, desplegado y verificado en producción el 1-sep-2026.
**Qué hay que hacer en el FE:** sustituir 27 composiciones manuales por un campo.

---

## Por qué

En pantalla el paciente sale «MIGUEL MAISONETT MARQUEZ». La clínica lo lee como un expediente:
**apellido primero**. Llegaron quejas por eso.

El dato **no está mal**: comparados 161.039 pacientes contra el legado, 160.960 idénticos y **cero
invertidos**. Lo que falla es la presentación.

Y el nombre se compone hoy en **27 sitios, en 18 ficheros** (`${p.nombres} ${p.apellidos}`), entre
ellos `venta-general.tsx`, `programar-citas-modal.tsx`, `facturacion/[id]/page.tsx` y
`paciente-form-sheet.tsx`. Arreglarlos uno a uno garantiza que dentro de un mes alguno siga al revés.

## Lo que devuelve el BE ahora

Cada paciente, en **cualquier** respuesta que lo incluya, trae:

```json
{
  "nombres": "MIGUEL",
  "apellidos": "MAISONETT MARQUEZ",
  "nombreMostrar": "MAISONETT MARQUEZ, MIGUEL"
}
```

Verificado en producción ahora mismo con `GET /api/v1/pacientes?q=MAISONETT`.

- Se compone en el punto por donde pasan **todas** las respuestas de pacientes, así que ninguna
  pantalla queda fuera.
- Sin apellido no deja coma colgando («ADMINCITAS»); sin ninguno de los dos, cadena vacía.
- El orden es **configuración del centro** (`apellido_nombre` por defecto, o `nombre_apellido`): si
  mañana facturación quiere el otro, se cambia sin desplegar y sin tocar el FE.
- La **lista ya viene ordenada por apellido**, coherente con cómo se muestra.

## Lo que hay que cambiar

Sustituir cada `` `${p.nombres ?? ""} ${p.apellidos ?? ""}`.trim() `` por:

```ts
p.nombreMostrar || t("sinNombre")
```

Los campos `nombres` y `apellidos` **siguen viniendo** y no cambian: los formularios de edición se
quedan como están. `nombreMostrar` es solo para MOSTRAR.

**No compongas el nombre en el front.** Si en alguna pantalla hace falta otro orden, es configuración
del centro, no un `if` en el componente.

## Cómo verificarlo

```bash
curl -s -G "https://api.centrodemedicinaregenerativa.com/api/v1/pacientes" \
  --data-urlencode "q=MAISONETT" -H "authorization: Bearer <jwt>" \
  -H "X-Tenant-ID: ef6f87b0-cfb8-4d33-84c6-9ce51848f8e1"
```

Debe devolver `"nombreMostrar": "MAISONETT MARQUEZ, MIGUEL"`.
