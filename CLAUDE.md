# CLAUDE.md — Sistema de Gestión Integral Frutera Agrosan (FAS)

> Documento vivo. Actualizar con cada decisión técnica relevante.  
> Última actualización: Junio 2026 · Versión 0.3

---

## 0. Fuente autoritativa y supersesión (reconciliación QA)

> Los **specs por módulo en `Docs/`** son la **fuente autoritativa** de modelos de datos, contratos de API y autorización. Este `CLAUDE.md` mantiene el **contrato global** (contexto, stack, estructura, convenciones, entorno, Docker y reglas para Claude Code).
>
> **Secciones superseded:** el schema Prisma legacy (antes §5) y el listado de rutas legacy (antes §6) fueron **reemplazados** por el mapa de modelos y la regla de prefijo de abajo. Cada modelo/ruta concreta vive en su spec.
>
> **Convenciones canónicas (reconciliadas con los specs):**
> - **IDs:** toda tabla lleva `id Int @id @default(autoincrement())`. Cuando se requiere identificación humana, se agrega `codigo String` (único según la regla de cada módulo). *(Reemplaza la antigua regla de `cuid`/`UUID`.)*
> - **Autorización:** por **perfil + ítem de menú + nivel** (`SIN_ACCESO`/`LECTURA`/`TOTAL`), ver `Docs/usuarios-perfiles.md`. El enum `UserRole` queda **obsoleto**.
> - **Prefijo de API:** `/api/<módulo>` (sin versión). Ej.: `/api/config`, `/api/materiales`, `/api/calidad`.
> - **Frontend:** route group `(app)` bajo `src/app/` (ej. `src/app/(app)/<modulo>`).
> - **Naming de dominio:** español (`codigo`, `descripcion`, `creadoEn`, `creadoPor`, `eliminadoEn`...).

---

## Decisiones Canónicas

### Decisión canónica — Base del frontend (fas-web)

Template base: next-shadcn-dashboard-starter (Kiranism).
Stack alineado: Next.js 15 App Router, React 19, Tailwind v4, shadcn/ui.
Se adopta como ESQUELETO, no como aplicación final: se forkea y se adapta.

Reglas de adaptación (obligatorias):
1. AUTH: arrancar Clerk por completo (rutas, middleware, providers) y
   reemplazar por Better Auth contra fas-api. El boundary de FKs a Usuario
   se mantiene String (no migra a Int).
2. DATA FETCHING: NO usar la capa de fetching propia del template (Server
   Actions / fetch de Next para datos de negocio). Usar TanStack Query + ky
   contra fas-api.
3. NAVEGACIÓN: reemplazar el sidebar de ejemplo por la estructura real de
   ItemMenu + perfiles, respetando niveles LECTURA / TOTAL.
4. Quitar módulos no usados del template (kanban, e-commerce, etc.).

Se conserva del template: TanStack Tables server-side (search/filter/
paginación), formularios React Hook Form + Zod, theming por CSS variables
(remarcar a identidad Frutera Agrosan).

---

## 1. Contexto del proyecto

**Cliente:** Frutera Agrosan SpA — empresa de compra, exportación y consignación de fruta fresca (uvas, carozos, cerezas) a mercados de Sudamérica, Norteamérica, Europa y Asia.

**Objetivo:** Reemplazar una plataforma legacy ASP/SQL Server con un sistema web moderno que cubra el ciclo completo de la operación: desde la negociación de compras hasta la liquidación al productor.

**Operado por:** VIAIN Asesorías Informáticas. El cliente (Agrosan) no tiene equipo TI interno — toda la infraestructura la gestiona VIAIN.

---

## 2. Repositorios

| Repo | Descripción | Path local |
|------|-------------|------------|
| `fas-api` | Backend — API REST | `/Users/christiandroguett/sites/FAS/fas-api` |
| `fas-web` | Frontend — Next.js | `/Users/christiandroguett/sites/FAS/fas-web` |

Ambos repos son independientes. La comunicación es exclusivamente vía API REST (JSON). No hay SSR con fetch al backend directo — el frontend consume la API pública.

---

## 3. Stack tecnológico

### fas-api (Backend)
| Capa | Tecnología | Versión |
|------|-----------|---------|
| Runtime | Node.js | 22 LTS |
| Lenguaje | TypeScript | 5.x |
| Framework | Fastify | 5.x |
| Validación | Zod | 3.x |
| ORM | Prisma | 5.x |
| Base de datos | PostgreSQL | 17 |
| Caché / Colas | Redis + BullMQ | latest |
| Auth | Better Auth | latest |
| Email | Resend | latest |
| PDF | Puppeteer | latest |
| Excel | ExcelJS | latest |
| Tests | Vitest | latest |

### fas-web (Frontend)
| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js | 15 (App Router) |
| Lenguaje | TypeScript | 5.x |
| UI base | React | 19 |
| Estilos | Tailwind CSS | v4 |
| Componentes | shadcn/ui | latest |
| Estado servidor | TanStack Query | v5 |
| Formularios | React Hook Form + Zod | latest |
| HTTP client | ky | latest |

### Infraestructura
- **Contenedores:** Docker + Docker Compose
- **Panel:** Coolify (self-hosted en VPS del cliente)
- **CI/CD:** GitHub Actions
- **Despliegue:** VPS propio (on-premise o nube privada)

---

## 4. Estructura de directorios

### fas-api
```
fas-api/
├── src/
│   ├── config/           # Variables de entorno, configuración global
│   ├── lib/              # Instancias compartidas (prisma, redis, resend, etc.)
│   ├── plugins/          # Plugins Fastify (auth, cors, swagger, error-handler)
│   ├── modules/          # Módulos de negocio (un directorio por módulo)
│   │   ├── auth/
│   │   ├── users/
│   │   ├── productores/
│   │   ├── compras/
│   │   │   ├── ordenes-compra/
│   │   │   └── pagos/
│   │   ├── ventas/
│   │   │   ├── notas-venta/
│   │   │   └── cobranza/
│   │   ├── operaciones/
│   │   │   ├── stock/
│   │   │   └── materiales/
│   │   ├── finanzas/
│   │   │   ├── costos/
│   │   │   └── facturacion/  # Adaptador DTE genérico
│   │   └── calidad/
│   │       └── lotes/
│   ├── shared/           # DTOs, tipos, utilidades compartidas
│   └── server.ts         # Entry point
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── tests/
├── docker/
├── .env.example
├── package.json
└── tsconfig.json
```

### Estructura de cada módulo
```
modulo/
├── modulo.routes.ts      # Definición de rutas Fastify
├── modulo.controller.ts  # Handlers de rutas (thin — solo orquesta)
├── modulo.service.ts     # Lógica de negocio
├── modulo.repository.ts  # Queries Prisma (acceso a datos)
├── modulo.schema.ts      # Schemas Zod (validación request/response)
└── modulo.types.ts       # Tipos TypeScript del módulo
```

### fas-web
```
fas-web/
├── src/
│   app/                  # App Router Next.js
│   ├── (auth)/           # Rutas públicas (login, etc.)
│   ├── (app)/            # Rutas protegidas (route group canónico)
│   │   ├── layout.tsx
│   │   ├── compras/
│   │   ├── ventas/
│   │   ├── operaciones/
│   │   ├── finanzas/
│   │   └── calidad/
│   ├── api/              # Route handlers internos Next.js (mínimos)
│   └── layout.tsx
│   components/
│   ├── ui/               # shadcn/ui (no modificar directamente)
│   ├── shared/           # Componentes reutilizables propios
│   └── modules/          # Componentes por módulo de negocio
│   lib/
│   ├── api.ts            # Cliente HTTP (ky) con base URL y auth headers
│   ├── auth.ts           # Helpers de sesión Better Auth (client side)
│   └── utils.ts
│   hooks/                # React hooks reutilizables
│   types/                # Tipos compartidos (idealmente generados desde API)
├── public/
├── .env.local.example
├── package.json
└── tsconfig.json
```

---

## 5. Base de datos — Modelo de datos (Etapa 1)

### Convenciones (canónicas — ver §0)
- **IDs:** `id Int @id @default(autoincrement())` en TODAS las tablas. `codigo String` (texto) para identificación humana donde aplique.
- **Auditoría/timestamps (naming español):** `creadoEn`/`creadoPor`, `actualizadoEn`/`actualizadoPor`, `eliminadoEn`/`eliminadoPor`.
- **Soft delete:** `eliminadoEn DateTime?` donde el spec lo exige; filtros `WHERE eliminado_en IS NULL`.
- **Montos/cantidades:** `Decimal` (nunca float). Precisión según cada spec.
- **Autorización:** perfil + ítem de menú + nivel (no roles).

### Schema Prisma — mapa de modelos (autoritativo en `Docs/`)

> El schema Prisma legacy fue **superseded**. El modelo de datos vive en los specs por módulo. Todo modelo usa `id Int autoincrement` (+ `codigo` texto donde aplique). El `schema.prisma` consolidado es la unión de los modelos de estos specs:

| Spec (`Docs/`) | Modelos principales |
|---|---|
| `mantenedores-generales.md` | 24 maestros (Temporada, Pais, Region, Provincia, Comuna, Puerto, GrupoMercado, Mercado, Moneda, Bodega, TipoParametro, Parametro, Especie, GrupoVariedad, Variedad, Categoria, Calibre, Altura, TipoPallet, TipoProduccion, UnidadMedida, TipoCuentaCorriente, TipoEmbarque, Zona) |
| `entidades.md` | Entidad, EntidadDireccion, EntidadContacto (`TipoEntidad` multiselect) |
| `usuarios-perfiles.md` | Usuario, Perfil, PerfilAcceso, ItemMenu |
| `materiales.md` | Articulo, Receta(+Detalle), TipoMovimiento, Movimiento(+Detalle), SaldoArticulo |
| `productores.md` | Predio, ProductorContrato, MovimientoCuentaCorriente, ConceptoLiquidacion(+Especie) |
| `calidad.md` | TipoDefecto/GrupoDefecto/Defecto, CaracteristicaMadurez, SolicitudInspeccion, InspeccionCaja(+Defecto/Madurez), InspeccionFoto |
| `reclamos.md` | CaracteristicaReclamoCliente, CriterioCumplimiento, Reclamo(+Documento/DatoCliente/Cumplimiento) |
| Compras · Ventas · Operaciones · Finanzas · Liquidaciones | Pendientes de spec |

> **Modelos legacy reemplazados:** `User/UserRole` → `Usuario/Perfil` (usuarios-perfiles); `Productor` → `Entidad` tipo `PRODUCTOR` (entidades + productores); `Cliente` → `Entidad` tipo `CLIENTE`; `Material` → `Articulo` (materiales); `Especie/Variedad` → maestros (mantenedores). `OrdenCompra/StockLote/NotaVenta/Cobranza/CostoOperacional/DocumentoDTE/InspeccionCalidad` se rediseñan en sus specs respectivos.

---

## 6. API REST — Convenciones (rutas por módulo en `Docs/`)

### Convenciones globales (canónicas)
- **Prefijo:** `/api/<módulo>` (sin versión). Ej.: `/api/config`, `/api/materiales`, `/api/productores`, `/api/calidad`.
- **Auth:** sesión Better Auth; autorización por perfil + ítem de menú + nivel.
- **Paginación:** `?page=1&limit=20` → `{ data, meta: { total, page, limit, totalPages } }`.
- **Errores:** `{ error: { code, message, details? } }`.
- **Fechas:** ISO 8601. **Montos:** string decimal (nunca float).

> El **listado de rutas legacy `/api/v1/...` fue superseded**. Las rutas concretas de cada módulo están en su spec (`Docs/<modulo>.md`, sección "Contratos API").

---

## 7. Reglas de negocio críticas

> Reglas **provisionales**: se refinan en los specs de Compras/Ventas/Operaciones/Finanzas cuando se escriban. Toda referencia a "rol" se reemplaza por perfil + ítem de menú + nivel.

### Órdenes de Compra
- Una OC en estado `APROBADA` no puede modificarse — solo anularse y crear nueva.
- El número de OC se genera automáticamente: `OC-{YYYY}-{NNNN}` (secuencial por año).
- Crear/editar OC requiere nivel `TOTAL` en el ítem de menú de Compras (perfil).
- La aprobación requiere el permiso específico de aprobación de OC (ítem de menú dedicado).

### Stock / Lotes
- Un lote solo puede despacharse si tiene `estadoCalidad = APROBADO` o `APROBADO_CONDICIONADO`.
- El stock disponible = `cantidadCajas - SUM(movimientos DESPACHO_EXPORTACION)`.
- No se puede despachar más stock del disponible — validar en el servicio, no solo en el frontend.
- El código de lote se genera automáticamente: `LOTE-{YYYY}-{NNNN}`.

### Notas de Venta
- Una NV solo puede incluir lotes con stock disponible > 0.
- Al confirmar una NV, se crea automáticamente un `StockMovimiento` tipo `DESPACHO_EXPORTACION`.
- El número de NV se genera automáticamente: `NV-{YYYY}-{NNNN}`.
- Una NV `EMBARCADA` o posterior no puede editarse.

### DTE — Adaptador genérico
- El sistema prepara el payload interno y lo envía al proveedor DTE configurado vía variable de entorno.
- La integración con el proveedor real se implementa en `src/modules/finanzas/facturacion/dte.adapter.ts`.
- En desarrollo/staging, usar un mock adapter que retorna documentos dummy.
- El proveedor DTE se configura con: `DTE_PROVIDER=mock|chilesystems|simplefactura`.

### Cobranza
- Al registrar pago completo, `estado` cambia a `PAGADA` automáticamente.
- Si `fechaVencimiento < today` y estado es `PENDIENTE`, marcar como `VENCIDA` (job diario en BullMQ).

---

## 8. Variables de entorno

### fas-api (.env)
```env
# App
NODE_ENV=development
PORT=3001
API_BASE_URL=http://localhost:3001

# Database
DATABASE_URL=postgresql://fas_user:fas_pass@localhost:5432/fas_db

# Redis
REDIS_URL=redis://localhost:6379

# Auth (Better Auth)
BETTER_AUTH_SECRET=change_me_in_production
BETTER_AUTH_URL=http://localhost:3001

# Email (Resend)
RESEND_API_KEY=re_xxxx
EMAIL_FROM=noreply@agrosan.cl

# DTE
DTE_PROVIDER=mock
# DTE_PROVIDER=chilesystems
# DTE_API_URL=https://api.chilesystems.cl
# DTE_API_KEY=xxxx
# DTE_RUT_EMISOR=76.XXX.XXX-X
# DTE_AMBIENTE=certificacion  # o produccion

# CORS
CORS_ORIGIN=http://localhost:3000

# Puppeteer
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

### fas-web (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

---

## 9. Docker Compose

```yaml
# docker-compose.yml (desarrollo)
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: fas_user
      POSTGRES_PASSWORD: fas_pass
      POSTGRES_DB: fas_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build: ./fas-api
    ports:
      - "3001:3001"
    env_file: ./fas-api/.env
    depends_on:
      - postgres
      - redis
    volumes:
      - ./fas-api:/app
      - /app/node_modules

  web:
    build: ./fas-web
    ports:
      - "3000:3000"
    env_file: ./fas-web/.env.local
    depends_on:
      - api

volumes:
  postgres_data:
```

---

## 10. Fases de implementación — Etapa 1

### Fase 0 — Scaffold (arrancar aquí)
- [ ] Inicializar `fas-api`: Fastify + TypeScript + Prisma + Zod + Better Auth
- [ ] Inicializar `fas-web`: Next.js 15 + Tailwind v4 + shadcn/ui + TanStack Query
- [ ] Docker Compose con PostgreSQL + Redis funcionando
- [ ] CI/CD básico (GitHub Actions: lint + test + build)
- [ ] Schema Prisma completo con migración inicial
- [ ] Plugin de error handling global en Fastify
- [ ] Plugin Swagger/OpenAPI en Fastify
- [ ] Layout base del dashboard en fas-web (sidebar, topbar, rutas protegidas)

### Fase 1 — Auth + Usuarios
- [ ] Login / logout / refresh token
- [ ] Gestión de usuarios y perfiles (CRUD admin) — ver `Docs/usuarios-perfiles.md`
- [ ] Middleware de autenticación + guard de autorización por perfil/ítem de menú/nivel
- [ ] Pantalla de login en fas-web
- [ ] Guard de rutas protegidas en fas-web

### Fase 2 — Maestros
- [ ] CRUD Productores
- [ ] CRUD Clientes
- [ ] CRUD Especies / Variedades
- [ ] CRUD Materiales y tarifas

### Fase 3 — Compras
- [ ] CRUD Órdenes de Compra con items
- [ ] Flujo de aprobación (BORRADOR → ENVIADA → APROBADA)
- [ ] Generación de PDF de OC (Puppeteer)
- [ ] Gestión de pagos a productores
- [ ] Vista de saldo pendiente por productor

### Fase 4 — Operaciones
- [ ] Ingreso manual de lotes (recepción de fruta)
- [ ] Control de calidad por lote
- [ ] Vista de stock disponible con filtros
- [ ] Movimientos de stock (despacho, merma, ajuste)
- [ ] Gestión de materiales e insumos

### Fase 5 — Ventas
- [ ] CRUD Notas de Venta con items (selección desde stock)
- [ ] Flujo de estados (BORRADOR → CONFIRMADA → EMBARCADA → ...)
- [ ] Generación PDF de NV
- [ ] Módulo de cobranza / CRM
- [ ] Registro de pagos de clientes

### Fase 6 — Finanzas
- [ ] Registro de costos operacionales
- [ ] Adaptador DTE genérico (mock funcionando, proveedor real enchufable)
- [ ] Emisión de facturas asociadas a NV
- [ ] Seguimiento de documentos DTE

### Fase 7 — QA y Puesta en Marcha
- [ ] Tests de integración módulos críticos
- [ ] Migración de datos desde sistema legacy
- [ ] Despliegue en VPS con Coolify
- [ ] Capacitación key users

---

## 11. Decisiones técnicas tomadas

| # | Decisión | Estado |
|---|----------|--------|
| 1 | Fastify 5 en lugar de NestJS | ✅ Confirmado |
| 2 | DTE vía API de mercado con adaptador genérico | ✅ Confirmado |
| 3 | IA como servicios externos — no desarrollados en Etapa 1 | ✅ Confirmado |
| 4 | Despliegue VPS + Coolify operado por VIAIN | ✅ Confirmado |
| 5 | Repos separados: fas-api y fas-web | ✅ Confirmado |
| 6 | Proveedor DTE específico | ⏳ Pendiente |
| 7 | IDs `Int autoincrement` + `codigo` texto en todas las tablas | ✅ Confirmado |
| 8 | Autorización por perfil + ítem de menú + nivel (sin roles) | ✅ Confirmado |
| 9 | Prefijo API `/api/<módulo>` (sin versión) | ✅ Confirmado |
| 10 | Frontend route group `(app)` bajo `src/app/` | ✅ Confirmado |
| 11 | Specs de `Docs/` = fuente autoritativa de modelos/rutas/permisos | ✅ Confirmado |

---

## 12. Reglas para Claude Code

1. **Nunca omitir validación Zod** en ningún endpoint — validar request body, params y query params siempre.
2. **Repository pattern obligatorio** — las queries Prisma van en `.repository.ts`, nunca en el service ni en el controller.
3. **Transacciones Prisma** para cualquier operación que modifique más de una tabla.
4. **Nunca exponer campos sensibles** en respuestas API (passwords, tokens internos).
5. **Siempre usar `Decimal` de Prisma** para montos — nunca `number` de JavaScript.
6. **Los controladores son thin** — solo reciben el request, llaman al service y devuelven la respuesta. Cero lógica de negocio.
7. **Los errores de negocio son excepciones tipadas** — crear clases `BusinessError` con código y mensaje, capturar en el error handler global de Fastify.
8. **Soft delete en entidades principales** — nunca `DELETE` físico en tablas de negocio.
9. **Logs estructurados** con Pino (incluido en Fastify) — nunca `console.log` en producción.
10. **Variables de entorno validadas al arrancar** con Zod — si falta una variable crítica, el proceso no inicia.
11. **Los specs de `Docs/` son autoritativos** sobre modelos, rutas y permisos; ante conflicto con este archivo, mandan los specs (y `Docs/00-entorno-general.md` para lo transversal).
