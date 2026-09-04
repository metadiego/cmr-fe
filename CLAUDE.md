# CLAUDE.md

Guía para Claude Code (claude.ai/code) al trabajar en este repositorio.

Complementa a [`AGENTS.md`](./AGENTS.md) (gstack y QA con navegador real), que sigue vigente.
Las reglas de Next 16 que abren ese fichero mandan sobre cualquier recuerdo de versiones
anteriores: **lee `node_modules/next/dist/docs/` antes de escribir código de framework.**

# CMR FE — cliente web

Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn/ui. Es un **cliente fino sobre
`cmr-be`**: casi nada de lógica de negocio vive aquí. La autenticación es Supabase y el dato
sale del API. El contrato entre los dos repos está en `../CLAUDE.md` (raíz del monorepo).

## Comandos

```bash
npm run dev          # next dev en el puerto 8080
npm run build        # next build (Turbopack)
npm run lint         # eslint — BLOQUEA en CI
npm run typecheck    # tsc --noEmit
npm test             # node --test (ver el aviso de abajo)
npm run format       # prettier
npm run gen:api      # regenera lib/api/schema.d.ts desde el OpenAPI del BE
```

**El despliegue lo hace Vercel**, no GitHub Actions. `.github/workflows/ci.yml` es solo la
puerta: typecheck → lint → tests → build, en cada PR y cada push a `main`.

## Dos trampas del tooling que cuestan una hora si no se saben

1. **Las pruebas NO son vitest ni jest.** Son `node --test --experimental-strip-types`. Correr
   `npx vitest run` devuelve «No test suite found in file» en los 15 ficheros y parece que el
   repo está roto: no lo está, es el runner equivocado. Se corre con `npm test`. Por eso la CI
   pide **Node 22** — `--experimental-strip-types` no existe antes de 22.6, y con Node 20 las
   pruebas no fallarían: no llegarían a correr, y el run saldría verde.
2. **Solo se ejecuta lo que está en `lib/`.** El glob es `"lib/**/*.test.ts"`. Una prueba puesta
   en `components/` o en `app/` **no la corre nadie** y nadie te avisa. Si algún día hay pruebas
   de componente, hay que ampliar el glob en el mismo commit que las añade.

## Guardarraíles — lo que NO puede volver a pasar

El assessment de agosto (`../cmr-be/docs/plans/assessment-hallazgos-2026-08.md`) dejó dos
hallazgos que son de este repo, y ninguno se arregló por estar escrito. Ahora hay algo que
falla detrás de cada uno.

### 1. Nada se apaga para que pase la CI
Los cuatro pasos (`typecheck`, `lint`, `test`, `build`) bloquean. **Ninguno se comenta, se pone
en `continue-on-error` ni se salta para sacar un cambio.** Si uno se pone rojo, el rojo es el
trabajo. Durante meses este repo llegó a producción sin que nada lo mirase, mientras el backend
tenía puerta desde el 2-sep; esa asimetría es lo que se acaba de cerrar.

### 2. Los techos de fichero solo bajan (`npm run lint`)
`frontdesk-board.tsx` (2.582 líneas) y la pantalla de una factura (2.274) llevan meses
señaladas por escrito y han seguido creciendo en cada informe. Son justo los dos sitios por
donde pasa el dinero, y un fichero de dos mil líneas no se revisa: se hojea.

- **Un fichero nuevo nace por debajo de 600 líneas.** Sin excepciones.
- Los que ya eran grandes llevan su tamaño de hoy como techo en `DEUDA` (`eslint.config.mjs`).
  Esa lista **solo puede menguar**: al partir un componente, se baja el número o se borra la
  línea.
- **Añadir una entrada a `DEUDA`, o subir un techo, no es una decisión de paso**: es admitir
  deuda y va hablada con el dueño y explicada en el commit. Ante la duda, se parte el componente.
- Exentos a propósito: `components/ui/**` (primitivas de shadcn, las regenera su CLI) y
  `lib/api/schema.d.ts` (generado desde el OpenAPI del BE).

### 3. Una prueba no se borra en silencio
Al mover, renombrar o partir código, **el número de pruebas no baja**. Si una prueba sobra, se
dice en el commit y se explica por qué. La CI ve pruebas que fallan, no pruebas que desaparecen
— y con el glob limitado a `lib/`, una prueba que se mueve fuera de `lib/` desaparece sin
romper nada.

### 4. El dinero se prueba, aunque cueste
La cobertura de hoy son **109 pruebas sobre helpers puros de `lib/`** y **cero pruebas de
componente o de página**, sobre 66 páginas y 165 componentes. Es la I-11 del assessment y sigue
abierta. Lo que toque facturación, caja o frontdesk **lleva su prueba en `lib/`**: si el cálculo
no se puede probar sin montar un componente, es que la lógica está en el sitio equivocado —
sácala a `lib/` y pruébala ahí. Orden sugerido en `docs/specs/tests-por-donde-empezar.md`.

### 5. Las claves del API vienen en español; no las "arregles" a mano
El backend ya sirve **`/api/v2` en inglés**, pero este cliente consume **`/api/v1`** en
`lib/api/client.ts` y las respuestas llegan con claves españolas (`nombre`, `cantidad`,
`fechaNacimiento`). **No se renombra un campo suelto al vuelo**: la migración a v2 es un trabajo
propio, pantalla a pantalla, con su handoff en `docs/specs/api-v2-en-ingles.md`. Un rename
parcial deja la pantalla mitad en un idioma y mitad en otro, que es peor que no empezar.

### 6. Este fichero y el repo no pueden divergir
Si cambias un script, la CI, el runner de pruebas o un techo, **actualiza este fichero en el
mismo commit**. En el backend, `CLAUDE.md` llegó a prohibir un comando que ya era seguro y a
describir una CI que no existía: una instrucción obsoleta es peor que ninguna, porque se obedece
a ciegas.

## Cosas que conviene saber del código

- **`lib/env.ts` revienta al importarse** si falta `NEXT_PUBLIC_SUPABASE_URL` o
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Por eso el build de CI pasa credenciales falsas: compilar no
  llama ni a Supabase ni al API.
- **`lib/api/client.ts`** es la única puerta al backend: `apiFetch` antepone `/api/v1`,
  desenvuelve `.data` del sobre `{ data, meta }` y lanza `ApiError`. Si el BE cambia el sobre,
  se cambia aquí.
- **El cliente de Supabase del navegador es un singleton a propósito** (`lib/supabase/client.ts`):
  recrearlo en cada llamada dejaba sin correr el refresco del token y la sesión moría a los ~15
  minutos. No lo conviertas en una factory.
- **Tenancy**: el centro activo va como `X-Tenant-ID`, sacado de
  `session.user.app_metadata.clinic_id`.
