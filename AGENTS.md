<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## gstack (QA con navegador real)

gstack está instalado en `~/.claude/skills/gstack`. Usa `/browse` para cualquier navegación web;
nunca las herramientas `mcp__claude-in-chrome__*`.

- `/qa` — recorre la app en un navegador real y arregla lo que encuentra (un commit por arreglo).
- `/qa-only` — igual, pero solo reporta.
- `/review` — revisa la rama contra main ANTES de mezclar.
- `/design-review` — ojo de diseñador: espaciados, jerarquía, inconsistencias.
- URL de pruebas: `https://cmr-fe-gamma.vercel.app` (o `localhost:8080` en local).
- Guía completa del flujo: `.personal/GUIA-QA-CON-GSTACK.md`.
