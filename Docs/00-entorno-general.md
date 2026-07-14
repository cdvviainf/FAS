# FAS — Entorno General

> **Documento raíz: directriz e índice de todo el proyecto.**
> Frutera Agrosan Sistema (FAS) · VIAIN Asesorías Informáticas · 2026
> Es la fuente de verdad transversal. Cada módulo tiene su propio `.md` (spec de 10 secciones) enlazado en el §8.

---

## 1. Propósito del documento

Servir como **directriz** (decisiones globales, stack, arquitectura, forma de trabajo, reglas transversales) e **índice** (estado y enlace de cada módulo). Todo `.md` de módulo extiende este documento y el `CLAUDE.md`; ante conflicto, manda este documento para lo transversal.

---

## 2. Visión y objetivo

Crear una aplicación que contemple el **100% de la operación de Frutera Agrosan**, reemplazando la **Plataforma Web Actual** y el uso de **EDGE**, sistematizando los procesos manuales desde la compra hasta la liquidación al productor (uva, carozos, cerezas para Américas, Europa y Asia).

Entrega en **3 etapas** con gates de alcance: (1) Operación core, (2) Automatización IA, (3) Liquidaciones y cierre.

---

## 3. Stack tecnológico canónico

| Capa | Tecnología |
|---|---|
| Backend | Node.js 22 · **Fastify 5** · TypeScript · Prisma · PostgreSQL 17 |
| Colas / async | BullMQ · Redis 7 |
| Auth | Better Auth |
| Frontend | **Next.js 15** (App Router) · React · TypeScript · Tailwind v4 · shadcn/ui |
| Repos | `fas-api`, `fas-web` en `/Users/christiandroguett/sites/FAS` |
| Validación | zod (entradas/salidas de API) |

> ⚠️ **Obsolescencia:** `agrosan_proyecto.html` muestra **NestJS + React 18** en la sección de stack. Es información desactualizada; el stack válido es el de esta tabla. Actualizar el HTML cuando se retome.

---

## 4. Arquitectura y contenedores (Docker)

### Topología de servicios

| Contenedor | Base | Rol | Entorno |
|---|---|---|---|
| `fas-web` | node:22 | Frontend Next.js 15 (SSR) | dev + prod |
| `fas-api` | node:22 | API REST Fastify 5 | dev + prod |
| `fas-worker` | node:22 | Jobs/colas BullMQ (misma imagen que `fas-api`, distinto comando) | dev + prod |
| `postgres` | postgres:17 | Base de datos | dev + prod |
| `redis` | redis:7 | Colas BullMQ + caché/sesión | dev + prod |
| `pgadmin` | dpage/pgadmin4 | Administración BD | solo dev |
| `redis-commander` | rediscommander | Administración Redis | solo dev |
| `proxy` | Caddy/Nginx/Traefik | TLS + routing | prod |

```
            ┌──────────┐
  internet→ │  proxy   │ (prod)
            └────┬─────┘
        ┌────────┴────────┐
   ┌────▼────┐       ┌────▼────┐
   │ fas-web │──API──│ fas-api │───┐
   └─────────┘       └────┬────┘   │
                          │        │
                ┌─────────▼──┐  ┌──▼────────┐
                │ postgres   │  │  redis    │◄── fas-worker (BullMQ)
                └────────────┘  └───────────┘
```

- El **worker** comparte código con `fas-api` (mismo build), arranca con otro entrypoint y consume colas BullMQ desde Redis.
- Redis cumple doble rol: backend de colas y caché/sesión.
- Empaquetado: Dockerfile multi-stage por servicio; orquestación con `docker-compose` (dev) y CI/CD vía **GitHub Actions**.
- Pendiente: el `docker-compose` actual solo tiene infra (postgres, redis, pgadmin, redis-commander); falta formalizar `fas-web`, `fas-api`, `fas-worker` y el `proxy` de prod.

---

## 5. Forma de trabajo

- **Spec-first:** antes de implementar, cada área se define en un `.md` con el **template de 10 secciones** (estándar oficial; ver abajo).
- **Etapas con gates:** no se entra a la siguiente etapa sin cerrar la anterior; decisiones de alcance se toman explícitamente antes de codear.
- **Claude Code** ejecuta el desarrollo desde estos specs; **Codex** hace QA/revisión. Los specs deben quedar autocontenidos (decisiones cerradas con default, no preguntas abiertas).
- **Reglas no negociables** del `CLAUDE.md` aplican siempre.

**Template de spec por módulo (10 secciones):**
`0. Contexto · 1. Objetivo · 2. Alcance (construye / NO construye) · 3. Decisiones cerradas (default) · 4. Modelo de datos (Prisma) · 5. Reglas/invariantes · 6. Contratos API · 7. Frontend · 8. Criterios de aceptación (Given/When/Then) · 9. Plan de implementación · 10. Definition of Done`

---

## 6. Reglas generales del entorno

- **E1 — Entorno basado en template.** La UI se monta sobre un template/admin shell común. La **página principal será un dashboard** (cuál exactamente, *por definir*).
- **E2 — Usuarios y perfiles (autorización).** Los usuarios se asocian a **perfiles**. Cada perfil define el **nivel de acceso por ítem de menú** (cada módulo): `SIN_ACCESO`, `LECTURA` (solo lectura) o `TOTAL` (lectura/escritura). Better Auth gestiona la **autenticación**; los perfiles gestionan la **autorización** a nivel de aplicación.
  - *Reconciliación:* donde los specs de módulo dicen "rol `MATERIALES`/`ADMIN`", se mapea a "perfil con nivel ≥ `LECTURA`/`TOTAL` sobre los ítems de ese módulo". `ADMIN` = perfil con `TOTAL` sobre Configuración.
  - *Default:* un perfil por usuario (ampliable a multi-perfil si se requiere). Modelo y CRUD especificados en `usuarios-perfiles.md` (el menú y la matriz de permisos se apoyan en el catálogo `ItemMenu`).
- **E3 — Temporada como variable de sesión.** La **temporada activa** vive en la sesión del usuario y se puede **cambiar sin cerrar sesión** (selector en la barra superior). Los módulos con datos dependientes de temporada deben declararlo y filtrar/etiquetar por `temporadaId`. Cada spec de módulo indica si es *season-scoped*.
- **E4 — Menú segmentado por secciones.** El menú se agrupa por secciones (**Configuración, Compras, Productores, Ventas, Operaciones, Finanzas, Calidad, Liquidaciones**) y dentro de cada una sus opciones. Ver mapa en §8.
- **E5 — Responsivo.** El sitio debe funcionar correctamente en escritorio, tablet y móvil. Además, el registro de **inspecciones de calidad en origen** se entrega como **PWA offline-first** (ver `calidad.md`).

---

## 7. Convenciones transversales

- **IDs:** **toda tabla** lleva `id Int @id @default(autoincrement())` (índice técnico). Para identificación humana se agrega `codigo String` (maestros, único según el módulo) o `numero Int` correlativo (documentos operativos: solicitud, reclamo). **Excepción:** `Usuario.id` es `String` porque lo gestiona Better Auth.
- **Softdelete:** maestros usan `eliminadoEn` (filtros `WHERE eliminado_en IS NULL`). En operativos, los registros de movimiento son **inmutables** (se corrigen con reversos, no se borran).
- **Auditoría:** maestros y entidades relevantes registran `creado/actualizado/eliminado` (fecha+hora+usuario).
- **Dinero/cantidades:** `Decimal` con precisión explícita; nunca `float`.
- **Validación:** zod en toda entrada/salida de API.
- **Naming de dominio:** en español (`codigo`, `descripcion`, `temporada`…), consistente con los specs existentes.
- **API:** prefijo por módulo (`/api/config`, `/api/materiales`, …).
- **Descripción extranjera:** un solo idioma.
- **DTE:** mediante **adaptador genérico** a proveedor de mercado (no se construye motor propio).
- **IA:** se consume como **servicio externo**, no se desarrolla internamente.

---

## 8. Índice de módulos (tablero de estado)

### Mapa de menú por sección

| Sección | Opciones (ítems de menú) |
|---|---|
| **Dashboard** | Inicio (dashboard — por definir) |
| **Configuración** | 24 mantenedores generales · Usuarios · Perfiles |
| **Compras** | Órdenes de compra |
| **Productores** | Administración de productores (ficha, predios) · Contrato · Cuenta corriente · Conceptos de liquidación |
| **Ventas** | Notas de venta · Cobranza / CRM |
| **Operaciones** | Materiales (artículos, recetas, movimientos, consulta de stock) · Stock fruta |
| **Finanzas** | Gestión de costos · Gestión de pagos · Facturación |
| **Calidad** | Control de calidad en origen (solicitudes · inspecciones · mantenedores defectos/madurez) · Validación de lotes · Reclamos |
| **Liquidaciones** | Liq. clientes · Matriz de costos · Determinación de precios · Liq. productor |

### Estado de specs

| Módulo | Sección | Etapa | Spec | Estado |
|---|---|---|---|---|
| Entorno General | — | — | `00-entorno-general.md` | ✅ Este documento |
| Mantenedores Generales | Configuración | 1 | `mantenedores-generales.md` | ✅ Listo |
| Materiales | Operaciones | 1 | `materiales.md` | ✅ Listo |
| Administración de Productores | Productores | 1/3 | `productores.md` | ✅ Listo |
| Entidades (Proveedor/Productor/Cliente/Transporte) | Configuración | 1 | `entidades.md` | ✅ Listo |
| Usuarios y Perfiles (Seguridad) | Configuración | 1 | `usuarios-perfiles.md` | ✅ Listo |
| Compras (OC) | Compras | 1 | — | ⏳ Pendiente |
| Ventas (Notas de venta, Cobranza) | Ventas | 1 | — | ⏳ Pendiente |
| Operaciones — Stock fruta | Operaciones | 1 | — | ⏳ Pendiente |
| Finanzas (Costos, Pagos, Facturación) | Finanzas | 1 | — | ⏳ Pendiente |
| Calidad (Validación lotes, Reclamos) | Calidad | 1/3 | — | ⏳ Pendiente |
| Calidad — Control en origen (web + PWA) | Calidad | 1 | `calidad.md` | ✅ Listo |
| Calidad — Reclamos | Calidad | 1/3 | `reclamos.md` | ✅ Listo |
| Liquidaciones | Liquidaciones | 3 | — | ⏳ Pendiente |
| Automatización IA (PL, facturas, agentes) | — | 2/3 | — | ⏳ Pendiente |

---

## 9. Glosario y decisiones globales

- **Plataforma Web Actual:** el sistema legado que se reemplaza (nunca "ASP legacy" ni "plataforma legacy").
- **EDGE:** herramienta de gestión operacional a eliminar.
- **Temporada:** ciclo (fecha inicio/término) que delimita la operación; variable de sesión (E3).
- **Adaptador DTE:** capa genérica hacia un proveedor de facturación electrónica de mercado (ChileSystems / SimpleFactura — decisión pendiente).
- **Maestro vs operativo:** maestro = catálogo de Configuración (con `codigo` texto, softdelete); operativo = transacción del negocio (con `numero` correlativo, inmutable donde aplique). Ambos con `id Int autoincrement`.

---

## 10. Pendientes del entorno (checklist)

- [ ] Definir el **dashboard** de inicio (E1).
- [x] Spec de **Usuarios y Perfiles** (E2). → `usuarios-perfiles.md`
- [ ] Confirmar qué módulos son **season-scoped** (E3).
- [ ] Formalizar `fas-web`, `fas-api`, `fas-worker` y `proxy` en Docker (§4).
- [ ] Elegir el **template/admin shell** y selección del proveedor DTE.
- [ ] Actualizar el stack en `agrosan_proyecto.html` (§3).
- [ ] Specs de las áreas operativas restantes (§8).
