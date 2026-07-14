# FAS — Prompt para Claude Code · Fase 0: Scaffold completo

## Contexto

Estás montando el proyecto **Sistema de Gestión Integral Frutera Agrosan (FAS)** desde cero.
El CLAUDE.md con la especificación completa está en `/Users/christiandroguett/sites/FAS/CLAUDE.md` — léelo antes de empezar.

---

## Lo que debes crear

Dos repositorios independientes dentro de `/Users/christiandroguett/sites/FAS/`:

```
FAS/
├── fas-api/     ← Backend Fastify + TypeScript + Prisma
├── fas-web/     ← Frontend Next.js 15 + Tailwind v4 + shadcn/ui
├── docker-compose.yml   ← ya existe
├── Makefile             ← ya existe
└── CLAUDE.md            ← ya existe
```

---

## Paso 1 — fas-api (Backend)

### Inicializar proyecto

```bash
cd /Users/christiandroguett/sites/FAS
mkdir fas-api && cd fas-api
npm init -y
```

### Instalar dependencias

```bash
# Core
npm install fastify @fastify/cors @fastify/helmet @fastify/jwt @fastify/swagger @fastify/swagger-ui

# ORM + DB
npm install prisma @prisma/client

# Validación
npm install zod

# Auth
npm install better-auth

# Colas
npm install bullmq ioredis

# Email
npm install resend

# PDF
npm install puppeteer

# Excel
npm install exceljs

# Utils
npm install pino dayjs decimal.js

# Dev
npm install -D typescript tsx @types/node vitest @vitest/coverage-v8 eslint prettier
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### package.json scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src --ext .ts",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "db:seed": "tsx prisma/seed.ts"
  }
}
```

### Estructura de directorios a crear

```
fas-api/src/
├── config/
│   └── env.ts              ← validación de variables de entorno con Zod
├── lib/
│   ├── prisma.ts           ← instancia singleton de PrismaClient
│   ├── redis.ts            ← instancia ioredis
│   └── queue.ts            ← setup BullMQ (worker base)
├── plugins/
│   ├── auth.plugin.ts      ← Better Auth integrado en Fastify
│   ├── cors.plugin.ts
│   ├── error-handler.ts    ← manejador global de errores tipados
│   └── swagger.plugin.ts   ← documentación OpenAPI
├── modules/
│   ├── auth/
│   │   ├── auth.routes.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.schema.ts
│   ├── users/
│   │   ├── users.routes.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── users.repository.ts
│   │   └── users.schema.ts
│   └── health/
│       └── health.routes.ts  ← GET /health para monitoreo
├── shared/
│   ├── errors.ts           ← clases BusinessError tipadas
│   ├── pagination.ts       ← helper paginación estándar
│   └── types.ts            ← tipos globales compartidos
└── server.ts               ← entry point, registra plugins y rutas
```

### Archivos clave a implementar

**src/config/env.ts** — validar al arrancar, lanzar error si falta variable crítica:
```typescript
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default('noreply@agrosan.cl'),
  DTE_PROVIDER: z.enum(['mock', 'chilesystems', 'simplefactura']).default('mock'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
})

export const env = envSchema.parse(process.env)
export type Env = z.infer<typeof envSchema>
```

**src/shared/errors.ts** — errores de negocio tipados:
```typescript
export class BusinessError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'BusinessError'
  }
}

export class NotFoundError extends BusinessError {
  constructor(resource: string, id?: string) {
    super('NOT_FOUND', `${resource}${id ? ` (${id})` : ''} no encontrado`, 404)
  }
}

export class UnauthorizedError extends BusinessError {
  constructor(message = 'No autorizado') {
    super('UNAUTHORIZED', message, 401)
  }
}

export class ForbiddenError extends BusinessError {
  constructor(message = 'Sin permisos para esta operación') {
    super('FORBIDDEN', message, 403)
  }
}

export class ConflictError extends BusinessError {
  constructor(message: string) {
    super('CONFLICT', message, 409)
  }
}
```

**src/plugins/error-handler.ts** — capturar todo en Fastify:
```typescript
import { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { BusinessError } from '../shared/errors.js'

export async function errorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    // Error de validación Zod
    if (error instanceof ZodError) {
      return reply.status(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: error.flatten() }
      })
    }
    // Error de negocio
    if (error instanceof BusinessError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details }
      })
    }
    // Error genérico
    app.log.error(error)
    return reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' }
    })
  })
}
```

**src/server.ts** — entry point:
```typescript
import Fastify from 'fastify'
import { env } from './config/env.js'
import { errorHandler } from './plugins/error-handler.js'

const app = Fastify({
  logger: {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
})

// Plugins
await app.register(import('@fastify/cors'), { origin: env.CORS_ORIGIN })
await app.register(import('@fastify/helmet'))
await errorHandler(app)

// Rutas
await app.register(import('./modules/health/health.routes.js'))
// await app.register(import('./modules/auth/auth.routes.js'), { prefix: '/api/auth' })

// Arrancar
await app.listen({ port: env.PORT, host: '0.0.0.0' })
app.log.info(`FAS API corriendo en http://localhost:${env.PORT}`)
```

### .env

```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://fas_user:fas_pass@localhost:5432/fas_db
REDIS_URL=redis://:fas_redis_pass@localhost:6379
BETTER_AUTH_SECRET=fas_super_secret_key_cambiar_en_produccion_32chars
BETTER_AUTH_URL=http://localhost:3001
RESEND_API_KEY=re_test_placeholder
EMAIL_FROM=noreply@agrosan.cl
DTE_PROVIDER=mock
CORS_ORIGIN=http://localhost:3000
```

### prisma/schema.prisma

Construir el `schema.prisma` consolidado a partir de los **specs de `Docs/`** (ver el mapa de modelos en `CLAUDE.md` §5). Todo modelo usa `id Int @id @default(autoincrement())` (+ `codigo` texto donde aplique) y autorización por perfil/ítem de menú. Para el scaffold inicial basta con los modelos de `usuarios-perfiles.md` (Usuario, Perfil, PerfilAcceso, ItemMenu) y maestros base. Luego:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

---

## Paso 2 — fas-web (Frontend)

### Inicializar proyecto

```bash
cd /Users/christiandroguett/sites/FAS
npx create-next-app@latest fas-web \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-turbopack
```

### Instalar dependencias adicionales

```bash
cd fas-web

# Estado y fetch
npm install @tanstack/react-query @tanstack/react-query-devtools ky

# Formularios
npm install react-hook-form @hookform/resolvers zod

# Auth client
npm install better-auth

# UI adicional
npx shadcn@latest init   # elegir: Default style, Zinc color, CSS variables: yes

# Componentes shadcn necesarios para el scaffold
npx shadcn@latest add button input label card table badge
npx shadcn@latest add dropdown-menu avatar separator
npx shadcn@latest add sidebar  # para el layout del dashboard

# Utils
npm install dayjs clsx class-variance-authority lucide-react
```

### Estructura de directorios a crear

```
fas-web/src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx        ← pantalla de login
│   ├── (app)/                ← route group canónico (rutas protegidas)
│   │   ├── layout.tsx          ← layout con sidebar + topbar
│   │   ├── page.tsx            ← dashboard home / resumen
│   │   ├── compras/
│   │   │   └── page.tsx
│   │   ├── ventas/
│   │   │   └── page.tsx
│   │   ├── operaciones/
│   │   │   └── page.tsx
│   │   ├── finanzas/
│   │   │   └── page.tsx
│   │   └── calidad/
│   │       └── page.tsx
│   ├── layout.tsx              ← root layout con QueryClientProvider
│   └── globals.css
├── components/
│   ├── ui/                     ← shadcn (no tocar)
│   ├── shared/
│   │   ├── page-header.tsx     ← título + breadcrumb reutilizable
│   │   ├── data-table.tsx      ← tabla genérica con paginación
│   │   └── loading-spinner.tsx
│   └── layout/
│       ├── app-sidebar.tsx     ← sidebar con navegación por módulos
│       └── top-bar.tsx         ← topbar con usuario y logout
├── lib/
│   ├── api.ts                  ← cliente ky con base URL y auth headers
│   ├── auth-client.ts          ← Better Auth client
│   └── utils.ts                ← cn(), formatCLP(), formatDate()
├── hooks/
│   └── use-api.ts              ← wrapper TanStack Query reutilizable
└── types/
    └── index.ts                ← tipos compartidos del dominio
```

### Archivos clave a implementar

**src/lib/api.ts** — cliente HTTP centralizado:
```typescript
import ky from 'ky'

export const api = ky.create({
  prefixUrl: process.env.NEXT_PUBLIC_API_URL,
  hooks: {
    beforeRequest: [
      (request) => {
        const token = typeof window !== 'undefined'
          ? localStorage.getItem('fas_token')
          : null
        if (token) request.headers.set('Authorization', `Bearer ${token}`)
      }
    ],
    afterResponse: [
      async (request, options, response) => {
        if (response.status === 401) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('fas_token')
            window.location.href = '/login'
          }
        }
      }
    ]
  }
})
```

**src/app/layout.tsx** — root layout con providers:
```typescript
import { QueryProvider } from '@/components/providers/query-provider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
```

**src/app/(app)/layout.tsx** — layout protegido con sidebar:
```typescript
import { AppSidebar } from '@/components/layout/app-sidebar'
import { TopBar } from '@/components/layout/top-bar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
```

**src/components/layout/app-sidebar.tsx** — navegación principal:
```typescript
// Sidebar construido dinámicamente desde el menú del usuario (GET /api/config/me/menu),
// filtrado por su perfil (ítems con nivel >= LECTURA). Secciones canónicas (00-entorno-general.md §8):
// - Dashboard (home)
// - Configuración → Mantenedores, Entidades, Usuarios, Perfiles
// - Compras → Órdenes de Compra
// - Productores → Ficha, Predios, Contrato, Cuenta corriente, Conceptos de liquidación
// - Ventas → Notas de Venta, Cobranza
// - Operaciones → Materiales, Stock fruta
// - Finanzas → Costos, Pagos, Facturación
// - Calidad → Control en origen (+ PWA), Reclamos, Validación de lotes
```

### .env.local

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

---

## Paso 3 — Verificar que todo levanta

```bash
# 1. Servicios Docker (desde /FAS)
make up

# 2. Esperar que postgres esté healthy, luego migrar
cd fas-api
npm run db:migrate

# 3. Levantar API
npm run dev
# → debe responder en http://localhost:3001/health

# 4. Levantar frontend (otra terminal)
cd fas-web
npm run dev
# → debe abrir en http://localhost:3000
```

---

## Criterios de éxito del scaffold

- [ ] `GET http://localhost:3001/health` responde `{ status: "ok" }`
- [ ] `GET http://localhost:3001/docs` muestra Swagger UI
- [ ] `http://localhost:3000` muestra la pantalla de login (aunque sea placeholder)
- [ ] `http://localhost:5050` muestra pgAdmin con la BD `fas_db` visible
- [ ] `npx prisma migrate dev` corre sin errores con el schema consolidado desde los specs de `Docs/`
- [ ] `npm run dev` en ambos repos sin errores de TypeScript

---

## Notas para Claude Code

- Leer CLAUDE.md completo antes de escribir cualquier línea de código.
- El modelo de datos es la **unión de los specs de `Docs/`** (mapa en `CLAUDE.md` §5). IDs `Int autoincrement` + `codigo` texto; autorización por perfil/ítem de menú/nivel.
- Las 10 reglas de la sección 12 del CLAUDE.md son **no negociables**.
- No instalar NestJS, Express, ni ningún otro framework — solo Fastify 5.
- El DTE por ahora usa `DTE_PROVIDER=mock` — no implementar integración real todavía.
- Si algo no está especificado, preguntar antes de inventar.
