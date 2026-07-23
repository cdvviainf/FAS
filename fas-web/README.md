# fas-web

Frontend del Sistema de Gestión Integral Frutera Agrosan (FAS). Next.js 15 (App Router) + React 19 + TypeScript + Tailwind v4 + shadcn/ui + TanStack Query.

Consume exclusivamente la API REST de `fas-api` (repo hermano, independiente) — no hay SSR con acceso directo a base de datos. Ver `/Users/christiandroguett/sites/FAS/CLAUDE.md` para el contrato global del proyecto y `Docs/` (en la raíz del monorepo) para los specs por módulo.

> **Antes de escribir código:** este proyecto usa una versión de Next.js con cambios que rompen convenciones conocidas (p. ej. `middleware.ts` → `proxy.ts`). Lee `AGENTS.md` y la documentación local en `node_modules/next/dist/docs/` antes de asumir comportamiento de versiones anteriores.

## Stack

- Next.js 15 App Router, React 19, TypeScript
- Tailwind CSS v4 + shadcn/ui
- TanStack Query v5 (server state) + `ky` (cliente HTTP)
- React Hook Form / TanStack Form + Zod (formularios y validación)
- Better Auth (cliente) — autenticación contra `fas-api`, cookies proxeadas vía `src/app/api/auth/[...all]/route.ts` para evitar problemas de cookies cross-domain

## Desarrollo local

Requiere que `fas-api` (y sus servicios Docker: PostgreSQL, Redis) estén corriendo — ver `Makefile` y `docker-compose.yml` en la raíz del monorepo (`make up`).

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run start
npm run lint
```

## Variables de entorno (`.env.local`)

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL pública de `fas-api` (navegador), ej. `http://localhost:3001/api`. |
| `INTERNAL_API_URL` | (solo servidor, opcional) URL de `fas-api` alcanzable desde dentro del contenedor Next.js (ej. `http://api:3001`), usada por el proxy de auth para evitar que `localhost` resuelva al propio contenedor `web` en Docker. |

Ver `.env.local.example` para la plantilla completa.

## Estructura

```
src/
├── app/
│   ├── auth/           # Rutas públicas (login)
│   ├── dashboard/       # Rutas protegidas (route group canónico)
│   └── api/             # Route handlers internos (proxy de auth, mínimos)
├── components/
│   ├── ui/               # shadcn/ui (no modificar directamente)
│   └── layout/           # Sidebar, topbar, shell del dashboard
├── features/             # Un directorio por módulo de negocio (service, queries, types, components)
├── config/
│   └── nav-config.ts    # Estructura del menú lateral
├── hooks/
│   └── use-item-acceso.ts  # usePuedeLeer / usePuedeEscribir (permisos por perfil + ítem de menú + nivel)
└── lib/
    ├── auth-client.ts   # Cliente Better Auth
    └── utils.ts
```

## Autorización en el frontend

El acceso no es por rol sino por perfil + ítem de menú + nivel (`SIN_ACCESO` / `LECTURA` / `TOTAL`). Todo botón o acción que modifique datos debe verificar `usePuedeEscribir(item)` antes de renderizarse — el backend es la autoridad final, pero la UI no debe ofrecer acciones que el backend igualmente rechazaría.
