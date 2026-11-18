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

> Verificado contra `docker-compose.yml`, `docker-compose.demo.yml` y `fas-api/src/server.ts` el 2026-11-18.

| Contenedor | Base | Rol | Entorno |
|---|---|---|---|
| `web` (fas-web) | node:22 | Frontend Next.js 15 | dev + Coolify |
| `api` (fas-api) | node:22 | API REST Fastify 5 **y** workers BullMQ (arrancan en el mismo proceso desde `server.ts`) | dev + Coolify |
| `postgres` | postgres:17 | Base de datos (en dev publicada en el puerto 5433) | dev + Coolify |
| `redis` | redis:7 | Colas BullMQ (con contraseña) | dev + Coolify |
| `pgadmin` | dpage/pgadmin4 | Administración BD | dev + demo |
| `redis-commander` | rediscommander | Administración Redis | solo dev |

```
  internet → proxy/TLS de Coolify
                  │
        ┌─────────┴─────────┐
   ┌────▼────┐         ┌────▼─────────────────┐
   │   web   │───API──▶│ api (+ workers BullMQ)│
   └─────────┘         └────┬────────────┬────┘
                            │            │
                     ┌──────▼─────┐ ┌────▼────┐
                     │  postgres  │ │  redis  │
                     └────────────┘ └─────────┘
```

- No hay un contenedor `fas-worker` aparte: las colas BullMQ (vencimientos de cobranza, seguimiento SII, correos, auditoría) se consumen dentro del proceso de `fas-api`.
- El proxy y el TLS de producción los provee **Coolify**; el repo no define un contenedor `proxy`.
- Empaquetado: un `Dockerfile` por repo (`fas-api/Dockerfile`, `fas-web/Dockerfile`).
- **CI/CD: no implementado** (no existe `.github/workflows`); el despliegue lo hace Coolify desde el repositorio.

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
  - **Supersesión (2026-11-16) — la empresa y la temporada del selector superior rigen TODO lo que se registra.**
    1. **Todo registro transaccional (cabecera) tiene `empresaId` y `temporadaId` NOT NULL** con FK compuesta `(empresaId, temporadaId) → temporadas(empresaId, id)`. Además de las 9 que ya la tenían (Cierre, OC fruta, Instructivo de Embalaje, Recepción, Reclamo, Solicitud de Inspección, Contrato, Movimiento de Cuenta Corriente, Solicitud de Pago), la llevan: Embarque, Solicitud de Reserva, Packing List del Embarque, Instructivo hijo, Pallet, Proforma de exportación, Factura de Exportación, Factura Nacional, Nota de Crédito, Provisión, Pago, Saldo a favor, Movimiento de materiales, OC de Materiales, Proforma de Materiales, Proforma a Productor y Documento del Generador DTE. Líneas, cuotas, adjuntos y tablas puente siguen colgando de su cabecera; tablas técnicas (`documentos_dte`, `documentos_emitidos`, auditoría, correos) y saldos de bodega quedan fuera.
    2. **La temporada viaja como la empresa:** la web manda la temporada activa en la cabecera `X-Temporada-Id` de cada request (junto a `X-Empresa-Id`). **Ningún formulario elige temporada** y ninguna API la acepta en el body (crear ni editar).
    3. **Al crear:** un documento **raíz** que registra el usuario toma la temporada de la cabecera (validada: de la empresa activa, no bloqueada ni eliminada); un request HTTP sin temporada activa se rechaza. Un documento **hijo** copia la de su padre (Embarque ← Cierre; Reserva/Packing/Instructivo hijo/Proforma/Factura Exportación ← Embarque; Pallet ← Recepción; Recepción con OC ← OC; Reclamo ← Embarque; Provisión ← Reclamo; NC ← Factura o Reclamo; Saldo a favor ← Pago; Movimiento inverso ← Movimiento; Proforma Materiales ← Movimiento; Factura Nacional ← Proforma/Embarque de origen; Movimiento de Cuenta Corriente automático ← Factura). No existen hijos de otra temporada. Procesos sin usuario (jobs, scripts) usan la del padre o, sin padre, la que corresponde por fecha.
    4. **La temporada no se cambia** después de crear el registro (si un llamador interno reenvía una distinta, se rechaza).
    5. **Todos los listados filtran por la temporada activa**, incluida Cobranza (cartera, documentos pendientes, saldos a favor y pagos). **La cabecera `X-Temporada-Id` manda en todos los listados** (incluidos Contratos del productor, Cuenta Corriente, Reclamos y Solicitudes de Pago/pendientes/despachado): un `?temporadaId=` distinto se ignora; el parámetro solo aplica a requests sin cabecera (procesos internos). Embarques, Gestión de Pallets y Stock Fruta filtran por la columna propia. El Kardex/PMP y los saldos de bodega de Materiales no filtran (son continuos). Monitor DTE sigue por rango de fechas de la temporada. Al cambiar la temporada en el selector, la web refresca todos los datos cargados.
    6. **Datos existentes** (migración `20261116150000_temporada_cabeceras`): los hijos toman la de su padre; los registros sin padre se asignan por la regla de corte del negocio — fecha desde el **2026-11-01 → temporada "2026-2027"**, anterior → **"2025-2026"** (buscada por código/descripción en la empresa; si no existe, por rango de fechas, luego predeterminada, luego la más reciente).
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

> Verificado contra el código el **2026-11-18** (`main` 6db046c).
> Estado del spec: `📝 Borrador` · `✅ Spec cerrado` · `⏳ Sin spec`. Estado de implementación: `✅ Implementado` · `🟡 Implementado parcial` · `⏳ Sin implementar` · `⏳ Sin spec` (no hay spec que implementar). Las aclaraciones van en "Pendientes conocidos". (`⏳ Sin implementar` se agregó al vocabulario del plan de higiene por decisión del 2026-11-18, para módulos con spec pero sin código.)

| Módulo | Sección | Spec | Estado del spec | Estado de implementación | Pendientes conocidos |
|---|---|---|---|---|---|
| Entorno General | — | `00-entorno-general.md` | ✅ Spec cerrado | ✅ Implementado | Documento transversal (este archivo) |
| Mantenedores Generales | Configuración | `mantenedores-generales.md` | ✅ Spec cerrado | ✅ Implementado | Ninguno |
| Usuarios y Perfiles | Configuración | `usuarios-perfiles.md` | ✅ Spec cerrado | ✅ Implementado | Ninguno |
| Entidades | Configuración | `entidades.md` | ✅ Spec cerrado | ✅ Implementado | Ninguno |
| Empresas (multi-empresa) | Configuración | `empresas.md` | ✅ Spec cerrado | ✅ Implementado | Ninguno |
| Temporada | Configuración | `temporada.md` | 📝 Borrador | ✅ Implementado | El spec es anterior a la temporada en cabeceras (commit `88851f1`); se reescribe en la Etapa 2 del plan de higiene |
| Integraciones (AGL360, TC, LibreDTE) | Configuración | `integraciones.md` | ✅ Spec cerrado | ✅ Implementado | Ninguno |
| Auditoría | Transversal | `auditoria.md` | ✅ Spec cerrado | ✅ Implementado | Ninguno (modelo `AuditLog`, módulo `auditoria`) |
| Motor de Documentos (PDF) | Transversal | `agrosan_etapa4_motor_documentos.md` | ✅ Spec cerrado | ✅ Implementado | La cabecera del doc aún dice "Propuesta v0.1"; documentos restantes migran al formato banner ES/EN por fases |
| Materiales | Operaciones | `materiales.md` | ✅ Spec cerrado | ✅ Implementado | Ninguno |
| Administración de Productores | Productores | `productores.md` | ✅ Spec cerrado | 🟡 Implementado parcial | Proceso de liquidación (Etapa 3) |
| Compras (OC, Instructivo de Embalaje, Recepción) | Compras | `compras.md` | 📝 Borrador | ✅ Implementado | Cabecera "v0.1" desactualizada (Etapa 2); recepción de OC GRANEL bloqueada; especie por línea en Solicitud de Inspección diferida |
| Ventas (Cierre Comercial, Embarque, Instructivo, Packing List, Reserva) | Ventas | `ventas.md` | 📝 Borrador | ✅ Implementado | Cabecera "BORRADOR DE CONTEXTO" desactualizada (Etapa 2) |
| API Solicitudes AGL360 | Ventas | `api-solicitudes.md` | ✅ Spec cerrado | ✅ Implementado | Ninguno |
| Webhook AGL360 → FAS | Ventas | `webhook-fas.md` | ✅ Spec cerrado | ✅ Implementado | Ninguno (`embarques.routes.ts`) |
| Cobranza / Facturación (Proforma, DTE 110, 33/34, 52, Cuotas, Pagos, NC) | Facturación y Cobranza | `cobranza.md` | ✅ Spec cerrado | 🟡 Implementado parcial | ND (DTE 56) y NC parciales genéricas; NC 112 parcial por validar en certificación; Factura Nacional: referencias a Nota de Venta/Instructivo y unidad en Proforma a Productor; Generador DTE fase 2 (emisión SII) |
| Gestión de Cobranza (CRM) | Ventas | `cobranza-gestion.md` | ✅ Spec cerrado | ⏳ Sin implementar | Todo el módulo |
| Score de riesgo de clientes | Ventas | `cobranza-score-riesgo.md` | 📝 Borrador | ⏳ Sin implementar | Punto abierto §3: frecuencia/mecanismo de recálculo |
| Anexo Entidades cliente – cobranza | Configuración | `anexo-entidades-cliente-cobranza.md` | ✅ Spec cerrado | ⏳ Sin implementar | `estadoActivo` no existe en el schema; depende del Score de riesgo |
| Calidad — Control en origen | Calidad | `calidad.md` | ✅ Spec cerrado | 🟡 Implementado parcial | PWA offline-first de inspecciones (no existe) |
| Reclamos | Calidad / Ventas | `reclamos.md` | ✅ Spec cerrado | ✅ Implementado | Ninguno |
| Anexo Reclamos – provisión | Calidad / Ventas | `anexo-reclamos-provision.md` | ✅ Spec cerrado | ✅ Implementado | Ninguno (`EstadoProvision`, ítem `RECLAMO_PROVISION`) |
| Operaciones — Stock fruta | Operaciones | `compras.md` / `ventas.md` | 📝 Borrador | ✅ Implementado | Sin spec propio: Pallets y Stock Fruta se especifican en Compras y Ventas |
| Finanzas — Costos | Finanzas | — | ⏳ Sin spec | ⏳ Sin spec | `CostoOperacional` y `StockLote` del schema son restos del scaffold sin uso |
| Liquidaciones | Liquidaciones | — | ⏳ Sin spec | ⏳ Sin spec | Spec por escribir |
| Dashboard de inicio | Dashboard | — | ⏳ Sin spec | ⏳ Sin spec | `/dashboard/overview` es la página de ejemplo del template (E1) |
| Automatización IA | — | — | ⏳ Sin spec | ⏳ Sin spec | Etapas 2/3 |

---

## 9. Glosario y decisiones globales

- **Plataforma Web Actual:** el sistema legado que se reemplaza (nunca "ASP legacy" ni "plataforma legacy").
- **EDGE:** herramienta de gestión operacional a eliminar.
- **Temporada:** ciclo (fecha inicio/término) que delimita la operación; variable de sesión (E3).
- **Adaptador DTE:** capa genérica hacia un proveedor de facturación electrónica de mercado. Proveedor integrado: **LibreDTE** (`fas-api/src/modules/finanzas/facturacion/libredte.adapter.ts`). El proveedor activo lo define `DTE_PROVIDER` (`mock` por defecto en el código, `.env.example` y los compose); en producción (`appfas.agrosanexp.com`) está configurado `DTE_PROVIDER=libredte` en Coolify (confirmado por Christian Droguett, 2026-11-18).
- **Maestro vs operativo:** maestro = catálogo de Configuración (con `codigo` texto, softdelete); operativo = transacción del negocio (con `numero` correlativo, inmutable donde aplique). Ambos con `id Int autoincrement`.

---

## 10. Pendientes del entorno (checklist)

- [ ] Definir el **dashboard** de inicio (E1). Hoy `/dashboard/overview` es la página de ejemplo del template.
- [x] Spec de **Usuarios y Perfiles** (E2). → `usuarios-perfiles.md` (commit `a39e606`)
- [x] Confirmar qué módulos son **season-scoped** (E3). → §6 E3, supersesión 2026-11-16 (commit `88851f1`)
- [x] Formalizar los servicios en Docker (§4) → `docker-compose.yml` (dev) y `docker-compose.demo.yml` (Coolify) con `api` y `web`; decisión vigente: los workers BullMQ corren dentro de `api` (sin contenedor `fas-worker`) y Coolify provee proxy/TLS (sin contenedor `proxy`).
- [x] Elegir el **template/admin shell** → next-shadcn-dashboard-starter (Kiranism), ver `CLAUDE.md` "Decisiones canónicas".
- [x] Elegir el **proveedor DTE** → LibreDTE (commits `4e52a10`, `bcea6d3`; activo en producción vía `DTE_PROVIDER=libredte` en Coolify; ver §9).
- [ ] Actualizar el stack en `agrosan_proyecto.html` (§3).
- [ ] Specs de las áreas operativas restantes (§8): Finanzas — Costos, Liquidaciones, Dashboard.
