# Módulo: Empresas (Multi-empresa / Multi-tenant) — FAS

> **Spec de módulo para desarrollo autónomo con Claude Code.** Extiende `CLAUDE.md` y `00-entorno-general.md`.
>
> | | |
> |---|---|
> | **Etapa** | 1 (estructural transversal) |
> | **Sección de menú** | Configuración › Empresas (Fase 4) |
> | **Backend** | `fas-api` · prefijo `/api/config/empresas` (Fase 4) |
> | **Frontend** | `fas-web` · `app/dashboard/configuracion/empresas/` (Fase 4) |
> | **Depende de** | Mantenedores Generales (`Pais`, `Comuna`), Usuarios/Perfiles |
> | **Usado por** | TODO el sistema (scoping por `empresaId` en la fase de tenancy) |
> | **Estado** | Fase 2a implementada (Prisma Client Extension + Mercado/GrupoMercado/ConfiguracionCorreo/PrefijoCodigo) — QA ronda 8: `APROBADO_CON_OBSERVACIONES`, `TESTS_OK` |

---

## 0. Contexto

El sistema opera para **dos empresas** del cliente que comparten la misma lógica de negocio pero manejan **datos completamente separados**: **Frutera Agrosan** y **AGDry**. Cada empresa tiene sus propios maestros, transacciones y configuraciones de sistema (SMTP hoy; facturador electrónico y otras a futuro).

El aislamiento es una **partición de datos a nivel de servidor** (`empresaId` en las tablas raíz), **no** un simple selector de UI. Es un mecanismo distinto al de Temporada (que hoy es solo un selector en `localStorage`).

---

## 1. Decisiones cerradas (Christian, 2026-07-31)

| # | Decisión | Valor |
|---|---|---|
| 1 | Modelo de tenancy | Row-level: columna `empresaId` en las tablas **raíz** |
| 2 | Perfiles / permisos | **Globales por usuario** (mismo perfil en todas sus empresas). `Perfil`/`ItemMenu`/`PerfilAcceso` NO llevan `empresaId` |
| 3 | Maestros universales | Geografía (`Pais`/`Region`/`Provincia`/`Comuna`/`Zona`) y `Moneda` quedan **globales** (compartidos). El resto de maestros, por empresa |
| 4 | Mercado / GrupoMercado | **Por empresa** (no globales). Fuerza el refactor País↔Mercado (ver §5) |
| 5 | Tablas hijas/detalle | **Heredan** del padre vía FK; NO llevan `empresaId` propio |
| 6 | Enforcement | Prisma Client Extension + AsyncLocalStorage (inyecta `empresaId` en modelos raíz) |
| 7 | Empresa activa | Selector espejo del de Temporada. 1 empresa → autoselección; 2 → el usuario elige. Header `X-Empresa-Id`, validado en `requireAuth` contra las membresías |
| 8 | Cambio de empresa | Resetea la Temporada a la predeterminada de la empresa seleccionada + invalida cache de TanStack Query |

---

## 2. Modelo de datos — Fase 0 (implementado)

### `Empresa`
Maestro base. `id Int autoincrement`, `codigo String @unique`, `razonSocial` (requerido). Campos opcionales: `nombreFantasia`, `rut`, `giro`, `email`, `telefono`. `activo`, auditoría y soft-delete estándar. Relaciones a `EmpresaDireccion[]`, `EmpresaContacto[]`, `UsuarioEmpresa[]`.

- **Unicidad:** `codigo` es único a nivel de BD (`@unique`). `rut` **no** tiene restricción única por ahora (puede quedar nulo hasta que se complete desde la UI).
- **Soft delete:** `eliminadoEn` como el resto de maestros.

### `EmpresaDireccion` / `EmpresaContacto`
Sub-tablas espejo de `EntidadDireccion`/`EntidadContacto`. Una empresa puede tener múltiples direcciones y contactos. `esPorDefecto`/`esRepresentanteLegal` son banderas; la unicidad de "una sola por defecto" es **responsabilidad del servicio** (Fase 4), no invariante de BD.

### `UsuarioEmpresa` (membresía N:M)
Un usuario puede tener acceso a **una, ambas o ninguna** empresa. `@@unique([usuarioId, empresaId])`. No guarda perfil (los permisos son globales, decisión #2).

### `Usuario.empresaPredeterminadaId` (nullable)
Empresa activa por defecto al iniciar sesión.

- **Invariante:** la empresa predeterminada **debe** estar entre las membresías del usuario. Esta coherencia es **responsabilidad del servicio** (se valida al asignar empresas en el form de Usuario, Fase 4), **no** una invariante persistente en BD. Nullable porque un usuario recién creado puede no tener empresas todavía.

---

## 2.b Contexto de empresa — Fase 1 (implementado)

### Backend

- **`empresaContext`** (`src/lib/empresa-context.ts`): `AsyncLocalStorage<{ empresaId: number | null }>`. Se inicializa en un hook `onRequest` global (`app.ts`) con `{ empresaId: null }` y se **muta** (no se reemplaza) dentro de `requireAuth` una vez resuelto el valor real — la misma referencia de store persiste a través de todo el ciclo del request, incluida la capa de repositorio que en Fase 2 (Prisma Client Extension) lo leerá sin depender de `request`.
- **`requireAuth`** (`src/plugins/auth-guard.ts`) resuelve `empresaId` así: si viene el header `X-Empresa-Id`, valida que el usuario sea miembro (`UsuarioEmpresa`) — `400 EMPRESA_INVALIDA` si no es un entero, `403 EMPRESA_NO_AUTORIZADA` si no es miembro. Si no viene el header, usa `empresaPredeterminadaId` como fallback. El resultado queda en `request.fasEmpresaId` y en el store ALS.
- **Modo soft:** si el usuario no tiene ninguna empresa asignada (ni header ni predeterminada), `fasEmpresaId` queda `null` y el request **no se bloquea** — todavía no hay `empresaId` en ninguna tabla raíz, el aislamiento real llega en Fase 2. Este modo es transitorio y se retira cuando el backfill de Fase 3 garantice que todo usuario activo tiene al menos una empresa.
- **Endpoint `GET /api/config/me/empresas`** (solo `requireAuth`, sin ítem de menú — es información propia del usuario, no un mantenedor administrable): retorna `{ empresas: [{id, codigo, razonSocial}], empresaPredeterminadaId }`, usado por el selector del frontend.
- **Seed:** además de crear `AGROSAN`/`AGDRY`, asigna (idempotente, solo usuarios sin membresías) `UsuarioEmpresa` → AGROSAN y `empresaPredeterminadaId` = AGROSAN a todo `Usuario` existente. Es un backfill de **membresía**, no de `empresaId` en tablas raíz (eso sigue siendo Fase 3) — decisión tomada para que el mecanismo de Fase 1 tenga datos reales con los que probarse.

### Frontend

- **`EmpresaProvider`** (`src/contexts/empresa-context.tsx`), espejo de `TemporadaProvider`: consulta `config/me/empresas`, persiste `empresaActiva.id` en `localStorage` (`fas_empresa_id`), valida contra la lista recibida y auto-selecciona si el usuario solo tiene una empresa. Se registra en `providers.tsx` **antes** de `MenuAccesoProvider`/`TemporadaProvider` (empresa es de mayor jerarquía).
- **Header `X-Empresa-Id`:** `lib/api.ts` agrega un hook `beforeRequest` a `ky` que lee `fas_empresa_id` de `localStorage` directamente (no vía React Context — `api` es un singleton de módulo fuera del árbol de componentes). El proxy genérico de Next.js (`app/api/[...path]/route.ts`) ya reenvía todos los headers, incluido este.
- **Reset de Temporada al cambiar de empresa (decisión #8):** `TemporadaProvider` ahora consume `useEmpresa()` y, cuando `empresaActiva.id` cambia (no en el mount inicial), limpia su `localStorage` y su estado para forzar un refetch de la predeterminada. `EmpresaProvider.setEmpresaActiva` además invalida todo el cache de TanStack Query. **Nota:** como `Temporada` sigue siendo un mantenedor global (sin `empresaId` — eso llega en Fase 2/3), este reset hoy no cambia qué temporada se obtiene; el mecanismo queda listo para cuando el endpoint de predeterminada quede scoped por empresa.

---

## 2.c Prisma Client Extension y primer slice tenant — Fase 2a (en desarrollo)

- **`prisma-tenancy.ts`** (`src/lib/prisma-tenancy.ts`): extensión de Prisma Client (`$extends`) que intercepta todas las operaciones (`$allOperations`) sobre un set fijo de "modelos tenant" (`Mercado`, `GrupoMercado`, `ConfiguracionCorreo`, `PrefijoCodigo` — la lista crece con Fase 3). Para esos modelos: inyecta `empresaId` en `where` (reads/deletes/count/aggregate/groupBy), en `data` (`create`/`createMany`/`createManyAndReturn`), y en ambos `where`+`data` para `update`/`updateMany`/`upsert` (incluida la rama `update` del propio `upsert`) — siempre con el valor resuelto por el servidor prevaleciendo sobre cualquier valor que el caller pudiera incluir. Cualquier operación no clasificada explícitamente lanza un error (fail-closed) en vez de dejarla pasar sin aislamiento.
  - **Sin store ALS** (fuera de un request — seed, scripts): no enforce, el caller debe pasar `empresaId` explícito.
  - **Store presente pero `empresaId` null** (request sin empresa resuelta): lanza `EmpresaRequeridaError` (`EMPRESA_REQUERIDA`, 409).
  - **Escrituras anidadas (limitación de Prisma Client Extensions, no de este código):** la extensión solo ve el modelo de nivel superior de cada operación — una escritura *anidada* (ej. `pais.update({ data: { mercado: { update: {...} } } })`, `empresa.update({ data: { mercados: { create: {...} } } })`) no vuelve a pasar por `$allOperations` para el modelo anidado, así que no se le inyecta `empresaId` ahí. Mantener a mano una lista de "modelo.campo" a bloquear no escala — cada relación nueva hacia un modelo tenant fue apareciendo como un vector nuevo en rondas sucesivas de QA (`Pais`, `SolicitudInspeccion`, `NotaVenta`, `Empresa`). Diseño final, en `contieneEscrituraAnidadaTenant`:
    - `RELACIONES_POR_MODELO` deriva del **DMMF** que Prisma genera con el schema completo (`Prisma.dmmf.datamodel.models`) el mapa, **por modelo**, de qué campo es una relación real y a qué modelo apunta.
    - El recorrido rastrea el modelo de contexto en cada nivel: solo avanza a `modeloDestino` cuando la clave actual **es** una relación real de ese modelo; si no lo es (los verbos-envoltorio de Prisma `create`/`update`/`upsert`/`where`/`data`, o cualquier otro campo), sigue recorriendo con el **mismo** modelo — así destapa envoltorios como `{ update: [{ where, data: {...} }] }` sin perder de vista a qué modelo pertenece `data`, y evita bloquear un campo escalar homónimo (ej. `Cliente.mercado` es un enum, no aparece en el mapa de relaciones de `Cliente`).
    - Objetos y arreglos se recorren por igual (una relación a-muchos con `update: [...]` se descompone elemento por elemento).
    - **Sin límite de profundidad**: los payloads vienen de JSON (body HTTP parseado por Fastify/Zod), acíclico por construcción — no hay riesgo de recursión infinita, y un límite arbitrario dejaría relaciones legítimas más profundas sin inspeccionar.
    - Se ejecuta con cualquier contexto ALS presente, **incluso si `empresaId` es null** (modo soft de Fase 1) — en ese caso lanza `EmpresaRequeridaError` igual que una operación directa sin empresa; con empresa resuelta, lanza un error genérico de tenant-hijack. Sin contexto ALS (scripts/seed) sigue sin enforcement, igual que el resto de la extensión.
    - Adicionalmente, `Mercado`↔`GrupoMercado` queda cerrado también a nivel de BD con una FK compuesta `(empresaId, grupoMercadoId) → grupos_mercado(empresaId, id)` (ver migración).
  - Aplicada sobre el cliente exportado en `src/lib/prisma.ts` (`withTenancy(new PrismaClient(...))`).
- **`Mercado`/`GrupoMercado`**: agregan `empresaId` (self-safe: nullable → backfill AGROSAN → `NOT NULL`) + único parcial `(empresaId, codigo)` solo entre filas activas (mismo patrón que `PrefijoCodigo`, no representable en el DSL de Prisma — ver migración). No existía ningún `@unique`/`@@unique` de código antes de esta fase. La migración también asegura (`INSERT ... ON CONFLICT DO NOTHING`) que `AGROSAN` exista antes del backfill — el entrypoint de despliegue corre `prisma migrate deploy` sin ejecutar el seed antes, así que la migración no puede depender de que alguien ya lo haya corrido manualmente.
- **`ConfiguracionCorreo`**: pasa de singleton global a una fila por empresa (`empresaId @unique`). `mailer.ts` cachea el transporter por empresa (`Map<empresaId, Transporter>`) en vez de una única variable global.
- **`PrefijoCodigo`**: único pasa de `(modelo)` a `(empresaId, modelo)` — cada empresa configura su propio prefijo/dígitos por mantenedor.
- **Cola de correos (BullMQ):** el worker corre fuera de cualquier request Fastify, así que no hay contexto ALS por defecto. `CorreoJobData`/`RecordatorioJobData` ahora llevan `empresaId`, y `iniciarWorkerCorreos` envuelve el procesamiento de cada job en `empresaContext.run({ empresaId: job.data.empresaId }, ...)` antes de invocar `enviarCorreo`/`procesarRecordatorio`. Los 6 sitios de `solicitudes.service.ts` que encolan correo pasan `empresaId: getEmpresaIdActual()` (resuelto en el momento de encolar, dentro del request original). **Decisión (Christian, 2026-08-02):** los jobs ya encolados en Redis antes de este deploy (sin `empresaId`) no se migran — se acepta que fallen (`EMPRESA_REQUERIDA`, 3 reintentos y luego dead-letter, visibles en Redis Commander). No hay usuarios reales en producción todavía.
- **Explícitamente fuera de este sub-ciclo:** el refactor País↔Mercado (`MercadoPais`, Fase 2b) y el resto de ~62 modelos candidatos a `empresaId` (Fase 3) — sus folios (OC/Recepción/NV/Solicitudes/Instructivo) siguen globales hasta que sus propias tablas se migren.

---

## 3. Seed y migración

- **Seed:** crea `AGROSAN` ("Frutera Agrosan SpA") y `AGDRY` ("AGDry", solo el nombre; el resto se completa en la UI). Idempotente vía `findFirst`+`create`, ahora protegido por `codigo @unique`.
- **Backfill (fase de tenancy):** todos los datos existentes se asocian a Agrosan (empresa base). Los usuarios existentes quedan solo en Agrosan como predeterminada; AGDry se asigna manualmente.
- **Migraciones self-safe:** al agregar `empresaId` a tablas pobladas → nullable → backfill=Agrosan → `NOT NULL`. Nunca `NOT NULL` directo (ver incidente 2026-07-29).

---

## 4. Fases

| Fase | Contenido | Estado |
|---|---|---|
| **0** | `Empresa` + `EmpresaDireccion` + `EmpresaContacto` + `UsuarioEmpresa` + `Usuario.empresaPredeterminadaId` + seed | **Implementada** |
| **1** | Contexto de empresa: `requireAuth` valida `X-Empresa-Id` (AsyncLocalStorage) · `EmpresaProvider` en front · cambio de empresa resetea Temporada | **Implementada (QA ronda 3: APROBADO_CON_OBSERVACIONES)** |
| **2a** | Prisma Client Extension (tenancy) · `empresaId` en `Mercado`/`GrupoMercado`/`ConfiguracionCorreo`/`PrefijoCodigo` · `ConfiguracionCorreo` por empresa | **En desarrollo** |
| **2b** | Refactor País↔Mercado: elimina `Pais.mercadoId`, crea `MercadoPais` | Pendiente |
| **3** | Migración de datos self-safe por lotes del resto de tablas raíz (~62 modelos) | Pendiente |
| **4** | UI: mantenedor de Empresas (RUT, direcciones, contactos, SMTP) · form de Usuario ampliado (empresas + predeterminada, con validación de invariante §2) | Pendiente |

---

## 5. Refactor País ↔ Mercado (Fase 2)

`Pais` es geografía global, pero **a qué mercado pertenece un país es una decisión comercial de cada empresa**. Como `Mercado`/`GrupoMercado` pasan a ser por empresa (decisión #4), la FK global→tenant `Pais.mercadoId` deja de ser válida. Resolución:

- Se **elimina `Pais.mercadoId`**.
- Nace **`MercadoPais`** (`empresaId`, `mercadoId`, `paisId`, `@@unique([empresaId, paisId])`): cada empresa mapea sus países a sus mercados.
- El lookup "países de un mercado" (form de Cierre Comercial, Solicitud de Inspección) pasa a resolverse vía `MercadoPais` filtrado por la empresa activa.

Es el **único** conflicto global→tenant del schema (los demás son tenant→global, ej. `Puerto→Pais`, `Bodega→Comuna`, `Entidad→Pais`, que son válidos).

---

## 6. Notas transversales

- **Límite de selectores:** los endpoints usados como selectores (ej. `/config/perfiles`, mantenedores) aceptan `limit` hasta **500** (convención común). El de perfiles se subió de 100→500 para que el selector del form de Usuario cargue todos los perfiles.
- **`ConfiguracionCorreo`:** hoy es fila única global. Pasa a por-empresa en Fase 2 (acoplado a que el emisor de correos gane contexto de empresa; la cola BullMQ manda desde `SolicitudInspeccion`, que recién ahí tendrá `empresaId`). Agrosan hereda la config actual; AGDry queda vacía hasta configurarla.
