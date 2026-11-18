# CLAUDE.md — Sistema de Gestión Integral Frutera Agrosan (FAS)

> Documento vivo. Actualizar con cada decisión técnica relevante.  
> Última actualización: 18 de noviembre de 2026 · Versión 0.4

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
| PDF | Playwright (Chromium headless) | latest |
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
| `mantenedores-generales.md` | 25 maestros (Temporada, Pais, Region, Provincia, Comuna, Puerto, GrupoMercado, Mercado, Moneda, Bodega, TipoParametro, Parametro, Especie, GrupoVariedad, Variedad, Categoria, Calibre, Altura, TipoPallet, Etiqueta, TipoProduccion, UnidadMedida, TipoCuentaCorriente, TipoEmbarque, Zona) |
| `entidades.md` | Entidad, EntidadDireccion, EntidadContacto (`TipoEntidad` multiselect) |
| `usuarios-perfiles.md` | Usuario, Perfil, PerfilAcceso, ItemMenu |
| `empresas.md` | Empresa, EmpresaDireccion, EmpresaContacto, UsuarioEmpresa (multi-empresa/tenant; `empresaId` en tablas raíz — ver spec) |
| `materiales.md` | Articulo, Receta(+Detalle), TipoMovimiento, Movimiento(+Detalle), SaldoArticulo, ProformaMaterial(+Linea/CuotaPago), OrdenCompraMaterial(+Linea/CuotaPago) |
| `productores.md` | Predio, ProductorContrato, MovimientoCuentaCorriente, ConceptoLiquidacion(+Especie) |
| `calidad.md` | GrupoDefecto/Defecto(+DefectoEspecie), CaracteristicaMadurez, SolicitudInspeccion, InspeccionCaja(+Defecto/Madurez), InspeccionFoto |
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

> Las reglas provisionales de la v0.3 (`OC-{YYYY}-{NNNN}`, `LOTE-…`, `NV-…`, OC `APROBADA`, `StockMovimiento`/`DESPACHO_EXPORTACION`, NV `EMBARCADA`) **quedaron superseded** por los specs y no existen en el código (verificado 2026-11-18). Las reglas vigentes viven en cada spec:

- **Órdenes de Compra** (estados `BORRADOR → EMITIDA → RECEPCIONADA`, modalidad CAJAS/GRANEL, Instructivo de Embalaje, Recepción): ver `Docs/compras.md`.
- **Stock fruta / Pallets / Despacho** (Recepción → Pallet, calificación, Packing List que bloquea el despacho): ver `Docs/compras.md` y `Docs/ventas.md`.
- **Cierre Comercial (Nota de Venta) / Embarque / Instructivo** (folio correlativo por empresa, N° de Instructivo correlativo por prefijo de Tipo de Embarque, reapertura del Cierre): ver `Docs/ventas.md`.
- **Códigos y correlativos:** se generan desde Configuración → Prefijos de Código (`PrefijoCodigo`); ver `Docs/mantenedores-generales.md`.
- **Temporada:** todo documento transaccional lleva `temporadaId` desde la cabecera `X-Temporada-Id`; ver `Docs/00-entorno-general.md` §6 (E3).
- **DTE:** adaptador genérico con proveedor configurable por `DTE_PROVIDER`; el proveedor integrado es **LibreDTE** (`fas-api/src/modules/finanzas/facturacion/libredte.adapter.ts`), activo en producción con `DTE_PROVIDER=libredte` en Coolify; el default es `mock`. Emisión en 2 pasos (borrador temporal → firma). Reglas de cada documento (110, 33/34, 52, 61, 112): ver `Docs/cobranza.md`.
- **Cobranza** (cuotas, pagos y saldo a favor, paso a `PAGADA`, job diario BullMQ `VENCIDA`, NC): ver `Docs/cobranza.md`.

---

## 8. Variables de entorno

### fas-api (.env)
```env
# App
NODE_ENV=development
PORT=3001
API_BASE_URL=http://localhost:3001

# Database
DATABASE_URL=postgresql://fas_user:fas_pass@localhost:5433/fas_db

# Redis
REDIS_URL=redis://:fas_redis_pass@localhost:6379

# Auth (Better Auth)
BETTER_AUTH_SECRET=change_me_in_production
BETTER_AUTH_URL=http://localhost:3001

# Email (Resend)
RESEND_API_KEY=re_xxxx
EMAIL_FROM=noreply@agrosan.cl

# DTE
DTE_PROVIDER=mock            # mock (default) | libredte (producción, configurado en Coolify)
# DTE_AMBIENTE=certificacion  # o produccion
# (credenciales de LibreDTE: ver fas-api/.env.example y Configuración → Integraciones)

# CORS
CORS_ORIGIN=http://localhost:3000

# Motor de Documentos (PDF) — Playwright. Vacío en desarrollo (usa el
# Chromium que instala `npx playwright install chromium`); en producción
# (imagen Alpine) apunta al Chromium del sistema — ver fas-api/Dockerfile.
PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

### fas-web (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

---

## 9. Docker Compose

La configuración vigente vive en los propios archivos (no se duplica aquí para que no se desactualice):

- `docker-compose.yml` — desarrollo: `postgres` (puerto **5433**), `redis` (con contraseña), `pgadmin`, `redis-commander`, `api`, `web`.
- `docker-compose.demo.yml` — despliegue en Coolify: `postgres`, `redis`, `api`, `web`, `pgadmin`; variables desde Coolify.
- Los workers BullMQ corren dentro de `api` (no hay contenedor worker aparte). Topología: `Docs/00-entorno-general.md` §4.

---

## 10. Fases de implementación — Etapa 1

> Verificado contra el código el 2026-11-18. Donde el alcance cambió respecto del plan original, el texto refleja lo construido.

### Fase 0 — Scaffold
- [x] Inicializar `fas-api`: Fastify + TypeScript + Prisma + Zod + Better Auth
- [x] Inicializar `fas-web`: Next.js 15 + Tailwind v4 + shadcn/ui + TanStack Query
- [x] Docker Compose con PostgreSQL + Redis funcionando (`docker-compose.yml`, `docker-compose.demo.yml` para Coolify)
- [ ] CI/CD básico (GitHub Actions: lint + test + build) — no existe `.github/workflows`
- [x] Schema Prisma completo con migraciones (`fas-api/prisma/migrations`)
- [x] Plugin de error handling global en Fastify (`plugins/error-handler.ts`)
- [x] Plugin Swagger/OpenAPI en Fastify (`plugins/swagger.plugin.ts`)
- [x] Layout base del dashboard en fas-web (sidebar por ItemMenu + perfiles, topbar con empresa y temporada)

### Fase 1 — Auth + Usuarios
- [x] Login / logout / sesión (Better Auth)
- [x] Gestión de usuarios y perfiles (CRUD admin, restablecer contraseña) — `Docs/usuarios-perfiles.md`
- [x] Middleware de autenticación + guard de autorización por perfil/ítem de menú/nivel (`plugins/auth-guard.ts`)
- [x] Pantalla de login en fas-web
- [x] Guard de rutas protegidas en fas-web (`src/proxy.ts` + `route-access-guard.tsx`)

### Fase 2 — Maestros
- [x] Productores (Entidad tipo PRODUCTOR + ficha, predios, contrato) — `Docs/productores.md`
- [x] Clientes (Entidad tipo CLIENTE / CLIENTE_NACIONAL) — `Docs/entidades.md`
- [x] Especies / Variedades y resto de mantenedores — `Docs/mantenedores-generales.md`
- [x] Materiales: Artículos y Recetas — `Docs/materiales.md`

### Fase 3 — Compras
- [x] Órdenes de Compra con líneas (CAJAS y GRANEL) — `Docs/compras.md`
- [x] Flujo de estados `BORRADOR → EMITIDA → RECEPCIONADA` (reemplaza BORRADOR → ENVIADA → APROBADA)
- [x] PDF de OC con el Motor de Documentos (Playwright, decisión #12; reemplaza Puppeteer)
- [x] Pagos a productores (Solicitud de Pago) — `Docs/productores.md`
- [x] Saldo por productor (Cuenta Corriente) — `Docs/productores.md`

### Fase 4 — Operaciones
- [x] Recepción de fruta (pallets), con OC, de proceso — `Docs/compras.md`
- [x] Control de calidad (Solicitud de Inspección, calificación de pallets) — `Docs/calidad.md`
- [x] Vista de stock disponible con filtros (Stock Fruta, Gestión de Pallets)
- [x] Movimientos de stock fruta: despacho por Embarque, edición de stock (`OPER_STOCK_EDICION`), eliminación de pallet
- [x] Materiales e insumos: movimientos, saldos, Kardex, OC y Proformas de Materiales — `Docs/materiales.md`

### Fase 5 — Ventas
- [x] Cierre Comercial (Nota de Venta) con líneas — `Docs/ventas.md`
- [x] Embarque / Instructivo / Packing List / Solicitud de Reserva AGL360 (la NV no tiene estados; reapertura del Cierre por permiso `VENTAS_REABRIR_CIERRE`)
- [x] PDF de Cierre Comercial (Sales Order ES/EN)
- [ ] Cobranza / CRM — Cobranza construida (`Docs/cobranza.md`); Gestión de Cobranza (CRM, `Docs/cobranza-gestion.md`) y Score de riesgo sin implementar
- [x] Registro de pagos de clientes y saldo a favor — `Docs/cobranza.md`

### Fase 6 — Finanzas
- [ ] Registro de costos operacionales — sin spec
- [x] Adaptador DTE (mock + LibreDTE)
- [x] Emisión de facturas: Exportación (110) desde Proforma, Nacional (33/34), Guía de Despacho (52), NC (61/112)
- [x] Seguimiento de documentos DTE (Monitor DTE + seguimiento automático del estado SII)

### Fase 7 — QA y Puesta en Marcha
- [ ] Tests de integración de módulos críticos — hay suite (`fas-api/tests/integration`), cobertura parcial
- [ ] Migración de datos desde la Plataforma Web Actual — parcial: cargadores masivos (maestros, recetas, direcciones/contactos, stock inicial)
- [x] Despliegue en VPS con Coolify
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
| 6 | Proveedor DTE: **LibreDTE** (`libredte.adapter.ts`). Activo vía `DTE_PROVIDER=libredte` en Coolify/producción (confirmado 2026-11-18); el default del código y de los compose es `mock` | ✅ Confirmado |
| 7 | IDs `Int autoincrement` + `codigo` texto en todas las tablas | ✅ Confirmado |
| 8 | Autorización por perfil + ítem de menú + nivel (sin roles) | ✅ Confirmado |
| 9 | Prefijo API `/api/<módulo>` (sin versión) | ✅ Confirmado |
| 10 | Frontend route group `(app)` bajo `src/app/` | ✅ Confirmado |
| 11 | Specs de `Docs/` = fuente autoritativa de modelos/rutas/permisos | ✅ Confirmado |
| 12 | Motor de Documentos (PDF): Playwright **(supersede Puppeteer)**; React+TSX como lenguaje de plantillas (`react-dom/server`, SSR sin cliente); registro central (`documentos.registry.ts`) dentro de `fas-api` — sin microservicio `docs-service` aparte ni monorepo `apps/`/`packages/` (2026-08-18, adapta `Docs/agrosan_etapa4_motor_documentos.md` al stack real; ver reconciliación al inicio de ese doc) | ✅ Confirmado |
| 13 | `documentos_emitidos.pdf` como `Bytes` en Postgres (mismo patrón que adjuntos de Recepción/Solicitud) — sin S3/MinIO en esta etapa | ✅ Confirmado |

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
