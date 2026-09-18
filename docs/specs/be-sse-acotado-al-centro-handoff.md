# Handoff BE → FE — los streams SSE ya solo entregan el CENTRO ACTIVO

**Origen:** `cmr-be`, PR 2 de la auditoría 2026-09. Spec del BE:
`cmr-be/docs/specs/sse-tenancy-por-centro.md`.
**Estado del BE:** hecho, 333 suites / 3.758 tests verdes, build verde.

## Qué cambió en el BE

Los cinco streams SSE entregaban **todos los eventos de todos los centros a cualquiera con
sesión** — `pacienteNombre`, `record`, `servicioNombre` incluidos. La causa: pasaban
`user.clinicId`, que en el camino JWT nunca se puebla (nadie escribe el claim `clinic_id`), y
`null` significaba «todos los canales».

Ahora cada stream resuelve el **centro activo del request** (el `X-Tenant-ID` ya validado por
`AuthGuard`) y filtra por él. Afecta a:

- `GET /api/v2/tablero/stream` (`lib/api/citas-stream.ts` → `useCitaStream`)
- `GET /api/v2/communications/alertas/stream` (`lib/api/comunicaciones.ts` → `alertas-bell`)
- `GET /api/v{1,2}/citas/stream`, `/frontdesk/stream`, `/ahora-mismo/stream`

| Principal | Antes | Ahora |
|---|---|---|
| Admin / master **sin** `X-Tenant-ID` | todos los centros | **igual**: todos los centros |
| Admin / master **con** `X-Tenant-ID` | todos los centros | solo ese centro |
| Personal de UN centro (sin header) | todos los centros | **solo el suyo** |
| Personal multicentro con centro elegido | todos los centros | **solo el activo** |
| API key de clínica | su centro | igual |

**Nada de esto rompe una pantalla que ya mandaba `X-Tenant-ID`**: recibe menos eventos, nunca
más. Lo que sí cambia es el significado de «sin centro».

## Lo que el FE tiene que revisar (dos ficheros, un patrón)

### 1. `components/agenda/dia-view.tsx` — la opción «todos los centros»

```ts
const [centro, setCentro] = React.useState<string>(ALL); // ← arranca en ALL
...
centroId: centro === ALL ? null : centro,               // ← sin X-Tenant-ID
```

`ALL` → sin header. Para un **admin/master** sigue funcionando igual (ve todos los centros). Para
un **no-admin** eso ya hoy devuelve **409** en `AuthGuard` (`An active clinic must be selected`),
así que el stream de esa pantalla nunca ha llegado a abrirse para ellos; lo que cambia es que
antes, si llegaba a abrirse por cualquier otra vía, entregaba centros ajenos. **Acción:** que la
opción «todos los centros» solo se ofrezca a quien es admin/master, y que para el resto arranque
en su centro activo.

Mismo patrón, mismo repaso: `components/paneles/panel-enfermeria.tsx:92`
(`centroId: centro ?? null`).

### 2. Los dos bucles de reconexión — parar también en 400 y 409

`hooks/use-cita-stream.ts:88-92` y `components/comunicaciones/alertas-bell.tsx:101-103` paran solo
en **401/403**; cualquier otro estado reconecta con backoff. Un no-admin sin centro elegido recibe
**409** (`AuthGuard`) o **400 `TENANT_REQUIRED`** (cinturón nuevo del handler), y hoy eso deja el
bucle reintentando para siempre — el mismo fallo que ya os costó 36k `UNAUTHORIZED` en la bitácora.

```ts
// use-cita-stream.ts y alertas-bell.tsx
if (status === 400 || status === 401 || status === 403 || status === 409) {
  setLive(false);
  break;
}
```

Y, cuando el estado sea 400/409, la pantalla debería decir **«elige un centro»**, no «sin
conexión»: el cuerpo del error trae `{ code: "TENANT_REQUIRED", labelKey: "tenant.requerido" }`.

## Lo que NO hay que hacer

**No pidáis que el BE ponga `clinic_id` en el JWT.** Es la tentación obvia y está descartada: el
personal es multicentro y el centro activo se elige **por request** (`CONVENTIONS.md` §3). Un claim
quedaría rancio en cuanto alguien conmuta de centro. El header es la verdad.

## Fuera de alcance (queda en el BE)

- `TablerosController` sigue sin `@Roles`/`@Permissions` de clase: cualquier principal autenticado
  alcanza `/tablero/stream`. Va en el PR 4 del BE, no lo arregla este cambio.
- Los streams siguen sin filtrar por `entidad` en el servidor (el FE ya filtra en cliente): ancho de
  banda y orden, no una fuga.
