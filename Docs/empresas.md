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
> | **Estado** | Fase 3, lote 7/7 (Compras, último) implementado — pendiente de QA. Fase 3 completa tras este lote. |

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
| 7 | Empresa activa | Selector espejo del de Temporada, **siempre visible** (igual que TemporadaSelector, sin ocultarse con 1 sola empresa — corrección 2026-08-03). Con 1 empresa queda autoseleccionada pero el selector se muestra igual. Header `X-Empresa-Id`, validado en `requireAuth` contra las membresías |
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
| **2b** | Refactor País↔Mercado: elimina `Pais.mercadoId`, crea `MercadoPais` | **Implementada** |
| **3** | Migración de datos self-safe por lotes del resto de tablas raíz (~38 modelos, ver §7) | **Lote 1/7 implementado** (Config/Mantenedores) |
| **4** | UI: mantenedor de Empresas (RUT, direcciones, contactos, SMTP) · form de Usuario ampliado (empresas + predeterminada, con validación de invariante §2) | Pendiente |

---

## 5. Refactor País ↔ Mercado — Fase 2b (implementada)

`Pais` es geografía global, pero **a qué mercado pertenece un país es una decisión comercial de cada empresa**. Como `Mercado`/`GrupoMercado` pasan a ser por empresa (decisión #4), la FK global→tenant `Pais.mercadoId` dejó de ser válida. Resolución:

- Se **eliminó `Pais.mercadoId`**.
- Nace **`MercadoPais`** (`empresaId`, `mercadoId`, `paisId`, `@@unique([empresaId, paisId])`): cada empresa mapea sus países a sus mercados. Un país pertenece a lo sumo un mercado **por empresa** (no es N:M real — decisión de negocio 2026-08-01: la misma fila de `Pais` puede mapear a mercados distintos en empresas distintas, pero dentro de una empresa el mapeo es 1:1). Sin soft-delete: cambiar el mercado de un país es un `UPDATE` de la misma fila. Se agregó a `MODELOS_TENANT` en `prisma-tenancy.ts` — hereda automáticamente todo el enforcement de Fase 2a (incluida la protección de escrituras anidadas vía DMMF).
- Migración con backfill de datos reales (no solo columna nueva): cada `Pais` existente ya tenía un `mercadoId` — antes de borrar esa columna, se crea una fila `MercadoPais` por cada país, asociada a AGROSAN (mismo patrón self-safe que Fase 2a: la migración asegura que AGROSAN exista antes del backfill).
- **Contrato de API sin cambios** (decisión de diseño clave — evita tocar el frontend): `config.repository.ts`/`config.service.ts` tratan `pais` como caso especial (mismo patrón que `bodega`+`contactos`): el body de create/update sigue recibiendo `mercadoId`, pero internamente se separa de los campos propios de `Pais` y se resuelve con `upsertMercadoPais` (upsert de la fila `MercadoPais`) en vez de una columna directa. Al listar/leer, se arma `mercado: {...}` en la respuesta incluyendo `mercadoPaises` filtrado por la empresa activa y aplanando el resultado — mismo shape de siempre. El filtro `?mercadoId=X` se resuelve vía `where: { mercadoPaises: { some: { empresaId, mercadoId } } }`. **Importante:** los `include`/`select` anidados no pasan por la extensión de tenancy (riesgo residual de Fase 2a) — el filtro por empresa activa en `mercadoPaises` se agrega a mano (`getEmpresaIdActual() ?? -1` como centinela sin empresa resuelta), no se puede confiar en que la extensión lo haga.
- El bloqueo de borrado "no se puede eliminar un Mercado con países asociados" pasa de contar `Pais.mercadoId` a contar `MercadoPais` (`countPaisesPorMercado`) — ya no encaja en el `childrenMap`/`countChildren` genérico.
- Las validaciones cruzadas país↔mercado de Notas de Venta (`notas-venta.service.ts`) y Solicitudes de Inspección (`solicitudes.service.ts`) pasan de comparar `pais.mercadoId !== mercadoId` a verificar existencia en `MercadoPais` (tenant-scoped automáticamente).
- `OrdenCompra.destinoMercadoId` queda **fuera de este refactor**: no tiene campo de país (es una referencia de mercado suelta, sin país destino en el modelo) — no hay nada contra qué cruzar.

Era el **único** conflicto global→tenant del schema (los demás son tenant→global, ej. `Puerto→Pais`, `Bodega→Comuna`, `Entidad→Pais`, que son válidos).

---

## 6. Notas transversales

- **Límite de selectores:** los endpoints usados como selectores (ej. `/config/perfiles`, mantenedores) aceptan `limit` hasta **500** (convención común). El de perfiles se subió de 100→500 para que el selector del form de Usuario cargue todos los perfiles.
- **`ConfiguracionCorreo`:** hoy es fila única global. Pasa a por-empresa en Fase 2 (acoplado a que el emisor de correos gane contexto de empresa; la cola BullMQ manda desde `SolicitudInspeccion`, que recién ahí tendrá `empresaId`). Agrosan hereda la config actual; AGDry queda vacía hasta configurarla.

---

## 7. Fase 3 — plan de sub-lotes y detalle del Lote 1

Fase 3 (backfill de `empresaId` al resto de ~38 modelos raíz candidatos) se hace **en sub-lotes por módulo**, cada uno su propio ciclo QA completo — mismo criterio que la partición 2a/2b, necesaria por el volumen y la cantidad de relaciones tenant→tenant que van apareciendo.

**Decisión de negocio (Christian, 2026-08-02):** el usuario nunca elige a qué empresa pertenece un mantenedor — igual que la Temporada seleccionada queda implícita en cada transacción, el `empresaId` que se estampa en cada registro es siempre la empresa activa del selector del header (contexto ALS), nunca un campo visible en ningún formulario.

### Sub-lotes planeados

| Lote | Módulo | Modelos | Estado |
|---|---|---|---|
| 1 | Config/Mantenedores | 19 (ver abajo) | **Implementado** |
| 2 | Entidades | `Entidad` | **Implementado** |
| 3 | Calidad | `SolicitudInspeccion` | **Implementado** |
| 4 | Materiales | `Articulo`, `Receta`, `TipoMovimiento`, `Movimiento`, `SaldoArticulo` | **Implementado** |
| 5 | Productores | `Predio`, `ProductorContrato`, `MovimientoCuentaCorriente`, `ConceptoLiquidacion` | **Implementado** |
| 6 | Ventas | `NotaVenta`, `Embarque`, `InstructivoEmbalaje` | **Implementado** |
| 7 | Compras | `OrdenCompra`, `CondicionPago`, `Recepcion`, `Pallet`, `TemplateCarga` | **Implementado** |

Tablas hijas/detalle (líneas, adjuntos, joins) heredan del padre vía FK — no llevan `empresaId` propio (decisión #5).

### Lote 1 — Config/Mantenedores (implementado)

19 modelos agregan `empresaId` (self-safe: nullable → backfill AGROSAN → `NOT NULL`) + único parcial `(empresaId, codigo)` (ninguno tenía `@@unique(codigo)` antes) y se agregan a `MODELOS_TENANT`: `TipoEmbarque`, `FormaPago`, `UnidadMedida`, `TipoPallet`, `Altura`, `TipoProduccion`, `TipoDefecto`, `TipoParametro`, `Puerto`, `Temporada`, `Bodega`, `ConceptoCtaCte`, `Especie`, `GrupoVariedad`, `Variedad`, `Categoria`, `Calibre`, `Parametro`, `Calificacion`.

**8 relaciones tenant→tenant** (el doble que Fase 2a) cerradas con FK compuesta, mismo patrón que `Mercado↔GrupoMercado`:

1. `Puerto ↔ TipoEmbarque` (Puerto→Pais se mantiene FK simple: Pais sigue global)
2. `Especie ↔ UnidadMedida` (`unidadMedidaCalidadId`, nullable — Postgres exime la FK compuesta si cualquier columna del par es NULL)
3. `GrupoVariedad ↔ Especie`
4. `Variedad ↔ Especie`
5. `Variedad ↔ GrupoVariedad`
6. `Categoria ↔ Especie`
7. `Calibre ↔ Especie`
8. `Parametro ↔ TipoParametro`

Esto exigió agregar `@@unique([empresaId, id])` en los 5 modelos "padre" de estas relaciones (`TipoEmbarque`, `UnidadMedida`, `Especie`, `GrupoVariedad`, `TipoParametro`) — mismo motivo que `GrupoMercado` en Fase 2a (Postgres exige el índice único explícito sobre esa tupla exacta).

**Validaciones de servicio:** de las 8 relaciones, 3 ya tenían un chequeo de existencia preexistente en `config.service.ts` (`Puerto.tipoEmbarqueId`, `Especie.unidadMedidaCalidadId`, `Variedad.grupoVariedadId`) que se volvió tenant-scoped **automáticamente** al agregar el modelo destino a `MODELOS_TENANT` — cero cambio de código. Las otras 4 (`GrupoVariedad.especieId`, `Categoria.especieId`, `Calibre.especieId`, `Parametro.tipoParametroId`) nunca tuvieron validación de existencia — se agregaron ahora, mismo patrón que `Mercado→GrupoMercado` en Fase 2a.

**Contrato de API sin cambios** — verificado con `tsc --noEmit` en `fas-web`, cero archivos tocados: la generic CRUD de mantenedores (`config.repository.ts`) ya filtra/incluye de forma data-driven, así que una vez que un modelo tiene `empresaId`, el filtro es transparente para el frontend.

**Lección de QA ronda 1 (FAS-EMP-F3-R1-001/002):** a diferencia de `Mercado`/`GrupoMercado` en Fase 2a (que nunca tuvieron ningún unique), varios de estos 19 modelos **ya tenían** un índice único parcial GLOBAL sobre `codigo` de migraciones previas a multi-empresa (ej. `20260713_add_unique_partial_indexes*`) — invisibles en `schema.prisma` porque son índices parciales, no representables en el DSL de Prisma (mismo motivo que `PrefijoCodigo`). Revisar solo el `@@unique` del schema **no alcanza** para saber si un modelo ya tiene unicidad — hay que revisar también las migraciones SQL crudas. La migración de este lote los elimina explícitamente antes de crear los nuevos `(empresaId, codigo)`. Mismo problema con la temporada predeterminada: el índice `ux_temporadas_una_predeterminada` era global (a lo sumo una en todo el sistema) y se reemplazó por uno acotado a `empresaId` (a lo sumo una por empresa) — **al tocar cualquier modelo en los próximos lotes de Fase 3, revisar primero si ya tiene índices únicos parciales crudos que necesiten el mismo tratamiento.**

### Lote 2 — Entidades (implementado)

El más simple de los sub-lotes: un único modelo (`Entidad`), sin relaciones tenant→tenant propias (`Entidad.paisId → Pais` se mantiene FK simple porque `Pais` sigue global). Mismo patrón self-safe: `empresaId` nullable → backfill AGROSAN → `NOT NULL` → FK + índice regular, agregado a `MODELOS_TENANT`, y `empresaId` explícito en `entidades.repository.ts#createEntidad` (la extensión de tenancy lo sobrescribe en runtime; se declara solo para satisfacer el tipo requerido por Prisma — mismo patrón que `correo.repository.ts`/`prefijos-codigo.repository.ts`).

**Decisión de negocio (Christian, 2026-08-03):** la unicidad de `codigo` e `identificador` (RUT) de `Entidad` pasa a ser **por empresa**, no global — dos empresas pueden tener productores/clientes con el mismo RUT sin conflicto.

**Índices únicos parciales globales preexistentes → `(empresaId, ...)`:** aplicando la lección del lote 1 proactivamente (revisado ANTES de implementar, no descubierto por QA), `entidades` ya tenía 2 índices únicos parciales GLOBALES de una migración previa a multi-empresa (`20260722000001_ent_enum_fields_indexes`): `ux_entidades_codigo` y `ux_entidades_identificador` (esta última condicionada además a `identificador IS NOT NULL`). Ambos se eliminan explícitamente y se reemplazan por `entidades_empresa_codigo_activo_key` y `entidades_empresa_identificador_activo_key` sobre `(empresaId, codigo)` / `(empresaId, identificador)`.

**Fixtures de test rotas (esperado, mismo patrón que lotes anteriores):** 4 archivos de integración creaban `Entidad` vía `prisma.entidad.create()` crudo sin `empresaId` — se corrigieron agregando el campo explícito (`config.integration.test.ts`, `productores.integration.test.ts`, `solicitudes.integration.test.ts`, `ventas-compras.integration.test.ts` ya lo tenía cubierto por su `beforeEach(entrarContextoEmpresa)`). Un caso adicional en `http.integration.test.ts` ("no filtra contratos a un perfil con Ficha pero sin permiso de Contratos") fallaba con 409 en vez de 200: la sesión de prueba no tenía ninguna membresía de empresa (`UsuarioEmpresa`), así que `requireAuth` la dejaba en modo "soft" (`empresaId: null`) — al tocar ahora `Entidad` (tenant), la ruta `/api/productores/:id` lanzaba `EmpresaRequeridaError`. Se corrigió creando la membresía (`UsuarioEmpresa` + `empresaPredeterminadaId`) para ese usuario de prueba antes del request.

**Contrato de API sin cambios** — verificado con `tsc --noEmit` en `fas-web`, cero archivos tocados.

### Lote 3 — Calidad (implementado)

`SolicitudInspeccion` es el modelo con más relaciones tenant→tenant de cualquier lote hasta ahora: 6 FK compuestas hacia 5 modelos ya-tenant (`entidadProductorId` y `clienteId` apuntan ambos a `Entidad`, con nombres de relación distintos):

1. `SolicitudInspeccion ↔ Temporada` (`temporadaId`, obligatorio)
2. `SolicitudInspeccion ↔ Entidad` ("Productor", `entidadProductorId`, obligatorio)
3. `SolicitudInspeccion ↔ Entidad` ("Cliente", `clienteId`, opcional)
4. `SolicitudInspeccion ↔ Especie` (`especieId`, opcional)
5. `SolicitudInspeccion ↔ Mercado` (`mercadoId`, opcional)
6. `SolicitudInspeccion ↔ Calificacion` (`calificacionId`, opcional)

De los 5 modelos destino, solo `Especie` ya tenía `@@unique([empresaId, id])` (lote 1). Este lote agrega ese índice a `Temporada`, `Entidad`, `Mercado` y `Calificacion`. `direccionId`/`contactoId` (→ `EntidadDireccion`/`EntidadContacto`) se mantienen como FK simples: son tablas hijas de `Entidad`, sin `empresaId` propio.

**Backfill derivado del padre, no de AGROSAN a ciegas:** a diferencia de lotes anteriores, el backfill de `empresaId` en la migración no asume un valor fijo — lo deriva con un `UPDATE ... FROM temporadas` usando el `empresaId` real de la `Temporada` de cada solicitud (que ya es tenant desde el lote 1). Más preciso, mismo principio self-safe.

**Tablas de detalle sin `empresaId` propio, aislamiento vía servicio (decisión #5 aplicada, no un vacío):** `SolicitudInspeccionVariedad/Calibre/Categoria` referencian `Variedad`/`Calibre`/`Categoria` (ya tenant) pero, al ser tablas de detalle sin `empresaId` propio, no pueden tener FK compuesta — no hay columna con la que componerla. El aislamiento ahí depende exclusivamente de la validación de servicio ya existente en `solicitudes.service.ts` (`validarReferencias`), que se volvió tenant-scoped automáticamente porque los modelos destino ya son tenant desde el lote 1 — mismo patrón "gratis" que `Puerto.tipoEmbarqueId`/`Especie.unidadMedidaCalidadId` en el lote 1, sin cambio de código. `createSolicitud`/`updateSolicitud` pasan estas relaciones como FK escalar plano (`variedadId: X`), nunca como sintaxis de relación anidada (`variedad: { connect: {...} }`), así que tampoco activan el guard de escrituras anidadas de la extensión.

**Lección de lote 2 aplicada — se evitó el patrón `enterWith` en `beforeEach`:** `solicitudes.integration.test.ts` llama a los servicios (`crearSolicitud`, `actualizarSolicitud`, `obtenerSolicitud`, `eliminarMantenedor`, `eliminarEntidad`) directamente, sin contexto ALS — funcionaba porque hasta este lote ningún modelo tocado en el nivel superior era tenant. En vez de repetir `empresaContext.enterWith(...)` en un `beforeEach` compartido (que Codex demostró en el lote Entidades que no se propaga de forma confiable entre el hook y el cuerpo del test), se envolvió cada llamada de servicio individualmente en `empresaContext.run(...)` vía wrappers locales del archivo de test — más verboso pero determinístico, sin depender de cómo el test runner programe la transición entre hook y test.

**Contrato de API sin cambios** — verificado con `tsc --noEmit` en `fas-web`, cero archivos tocados.

### Lote 4 — Materiales (implementado)

El lote con más FK compuestas hasta ahora (8), repartidas en 5 modelos con estructura propia (no genérica vía `config.repository.ts` como los lotes 1 y 3):

1. `Articulo ↔ UnidadMedida` (`unidadId`)
2. `Receta ↔ Articulo` (`embalajeId`)
3. `SaldoArticulo ↔ Articulo` (`articuloId`)
4. `SaldoArticulo ↔ Bodega` (`bodegaId`)
5. `Movimiento ↔ TipoMovimiento` (`tipoMovimientoId`)
6. `Movimiento ↔ Entidad` ("MovEntidad", `entidadId`, opcional)
7. `Movimiento ↔ Bodega` ("MovOrigen"/"MovDestino", `bodegaOrigenId`/`bodegaDestinoId`, opcionales — 2 FK compuestas separadas hacia el mismo modelo)
8. `Movimiento ↔ Entidad` ("MovTransporte", `transporteEntidadId`, opcional)

`Bodega` no tenía `@@unique([empresaId, id])` (nunca había sido "padre" de una FK compuesta) — se agrega ahora junto con `Articulo` y `TipoMovimiento` (nuevos destinos). `Entidad` ya lo tenía desde el lote 3.

**Diferencia con lotes anteriores — único de `codigo` sin condición parcial:** `Articulo`, `Receta` y `TipoMovimiento` tienen `codigo` con `@unique` **directo en el DSL** (no un índice parcial crudo oculto) y **no usan `eliminadoEn`** (usan `activo` boolean) — el reemplazo es `@@unique([empresaId, codigo])` normal, sin `WHERE`, más simple que el patrón de los lotes 1 y 2.

**Tablas de detalle sin `empresaId` propio** (`RecetaDetalle`, `MovimientoDetalle`, `DocumentoArticulo`) referencian `Articulo` mediante FK escalar plano — mismo patrón que el lote 3 (`SolicitudInspeccionVariedad` etc.): sin FK compuesta posible (no hay `empresaId` con qué componerla), el aislamiento depende de la validación de servicio ya existente (`getArticulosPorIds`, `getArticulosTipos`, `getArticuloTipo`), que se vuelve tenant-scoped automáticamente porque `Articulo` ya es tenant — sin cambio de código.

**Repos ajustados:** `articulos`/`recetas`/`tipos-movimiento.repository.ts` — `empresaId` explícito en `create` (satisface la validación de campo requerido de Prisma, que la extensión sobrescribe en runtime) y `findXByCodigo` cambia de `findUnique({where:{codigo}})` a `findFirst({where:{codigo}})`, porque `codigo` deja de ser único por sí solo. `movimientos.repository.ts` — `empresaId` explícito tanto en `tx.movimiento.create` como en `getOrCreateSaldo`'s `tx.saldoArticulo.create` (motor transaccional de stock, dentro de `prisma.$transaction`).

**Otros módulos sin cambios:** Compras, Ventas, Productores y Calidad ya referenciaban `Articulo` por FK escalar simple vía `findUnique({where:{id}})` (no por `codigo`) — se vuelven tenant-scoped gratis, mismo patrón que siempre, sin tocar esos módulos (ninguno de ellos es tenant todavía).

**Cobertura de tests:** solo `Articulo` tenía suite de integración dedicada (`articulos.integration.test.ts`) — se adaptó con el patrón `.run()` del lote 3. `Receta`, `TipoMovimiento`, `Movimiento` y `SaldoArticulo` no tienen tests de integración propios hoy (deuda preexistente, no introducida por este lote). Además, 4 `prisma.articulo.create()` crudos en `productores`/`ventas-compras`(x2)/`solicitudes.integration.test.ts` recibieron `empresaId` explícito.

**Contrato de API sin cambios** — verificado con `tsc --noEmit` en `fas-web`, cero archivos tocados.

### Lote 5 — Productores (implementado)

4 modelos: `Predio`, `ProductorContrato`, `MovimientoCuentaCorriente`, `ConceptoLiquidacion`. 7 FK compuestas hacia modelos ya-tenant:

1. `Predio ↔ Entidad` (`entidadId`)
2. `Predio ↔ TipoProduccion` (`tipoProduccionId`, opcional)
3. `ProductorContrato ↔ Entidad` (`entidadId`)
4. `ProductorContrato ↔ Temporada` (`temporadaId`)
5. `ProductorContrato ↔ Especie` (`especieId`)
6. `MovimientoCuentaCorriente ↔ Entidad` (`entidadId`)
7. `MovimientoCuentaCorriente ↔ ConceptoCtaCte` (`tipoId`)

`TipoProduccion` y `ConceptoCtaCte` no tenían `@@unique([empresaId, id])` (nunca habían sido "padre" de una FK compuesta) — se agrega ahora. `Entidad`, `Temporada` y `Especie` ya lo tenían.

**FK que quedan simples a propósito:** `Predio.comunaId`/`zonaId` (Comuna/Zona son mantenedores globales, nunca convertidos a tenant) y `ProductorContrato.condicionPagoId` (`CondicionPago` **aún no es tenant** — asignado al lote 7/Compras; cuando llegue ese lote, hay que retrofitear esta FK a compuesta) y `.responsableId` (Usuario, global). `MovimientoCuentaCorriente.temporadaId` no tiene FK en absoluto en el schema (columna suelta preexistente, sin relación declarada) — se deja igual, no es un cambio de este lote.

**Sin índices únicos globales que migrar:** `Predio.codigo` ya tenía un índice parcial `(entidadId, codigo)` (no global) — como `entidadId` queda transitivamente scoped a una empresa vía la FK compuesta, sigue siendo correcto sin cambios (mismo caso que `SolicitudInspeccion.temporadaId+numero` en el lote 3). `ProductorContrato` no tiene unicidad a nivel de BD (la regla "un contrato por especie+temporada y productor" es solo de servicio, sin índice). `ConceptoLiquidacion.codigo` no tenía NINGÚN unique — ni global ni parcial — antes de este lote; es una brecha preexistente no relacionada con multi-empresa que no se introduce ahora (se deja con el mismo nivel de enforcement que tenía, solo que ahora el chequeo de servicio queda tenant-scoped).

**Tablas de detalle sin `empresaId` propio** (`ProductorContratoLinea`, que referencia `Articulo`/`Variedad`/`Calibre`(×2)/`Categoria`/`UnidadMedida`, y `ConceptoLiquidacionEspecie`→`Especie`) — mismo patrón que los lotes 3 y 4: sin FK compuesta posible, el aislamiento depende de validación de servicio. Para `ProductorContratoLinea` esa validación ya existía (`getArticuloTipo`, `getVariedad`, `getCategoria`, `getCalibre`, `getUnidadMedida`), tenant-scoped automáticamente porque esos modelos ya son tenant. Para `ConceptoLiquidacionEspecie` **no existía ninguna** — QA ronda 1 lo encontró (FAS-EMP-F3-PROD-R1-001, ALTA: un concepto podía referenciar una especie de otra empresa por ID) y se corrigió agregando `validarEspecies()` en `conceptos-liquidacion.service.ts`, mismo patrón que las validaciones de línea de `ProductorContratoLinea`.

**`productores.repository.ts#getFicha`** (usado por `GET /api/productores/:id`) incluye `predios`/`contratos` como *lecturas anidadas* de un `entidad.findFirst` ya tenant-scoped — sin riesgo adicional, porque el FK del hijo (`entidadId`) necesariamente apunta a la misma entidad ya filtrada por empresa (mismo razonamiento que los includes anidados de `SolicitudInspeccion` en el lote 3).

**Repos ajustados:** `predios`/`contratos`/`cuenta-corriente.repository.ts` (módulo Productores) y `conceptos-liquidacion.repository.ts` (módulo Config) — `empresaId` explícito en sus `create`. Ningún `findUnique({where:{codigo}})` que romper esta vez (todo ya usaba `findFirst`).

**Fixtures de test:** `productores.integration.test.ts` ya usaba el patrón `.run()` (no `enterWith`) para varias llamadas, pero 3 casos (`CA1`, `CA2`×2) llamaban `crearPredio`/`eliminarPredio` sin ningún contexto ALS — se envolvieron ahora. `agregarAdjunto` y `obtenerInforme` se llamaban *fuera* de los bloques `.run()` existentes (no fallaban porque en modo "sin store" la lectura pasa sin filtrar, pero no ejercían aislamiento real) — se movieron adentro. Un `prisma.productorContrato.create()` crudo en `http.integration.test.ts` (el mismo test de la ficha de productor ya tocado en el lote 2) recibió `empresaId` explícito.

**Contrato de API sin cambios** — verificado con `tsc --noEmit` en `fas-web`, cero archivos tocados.

### Lote 6 — Ventas (implementado)

`NotaVenta` es el modelo con más FK compuestas de cualquier lote hasta ahora — **9 en su propio encabezado**, más 2 adicionales desde `Embarque`/`InstructivoEmbalaje` (11 en total, supera las 8 de los lotes 1 y 4):

1-3. `NotaVenta ↔ Entidad` ("Cliente" obligatorio, "Notify" y "ClienteFinal" opcionales — 3 FK separadas al mismo modelo)
4. `NotaVenta ↔ TipoEmbarque`
5. `NotaVenta ↔ Mercado`
6. `NotaVenta ↔ Puerto` (`puertoDestinoId`, opcional)
7-9. `NotaVenta ↔ Parametro` ("ModalidadVenta", "ClausulaVenta", "TipoFlete" — 3 FK separadas al mismo modelo, opcionales)
10. `Embarque ↔ NotaVenta` (`notaVentaId`)
11. `InstructivoEmbalaje ↔ NotaVenta` (`notaVentaId`)

`Puerto` y `Parametro` no tenían `@@unique([empresaId, id])` (nunca habían sido "padre" de una FK compuesta) — se agrega ahora, junto con `NotaVenta` misma (nueva destino de `Embarque`/`InstructivoEmbalaje`). `Entidad`, `TipoEmbarque` y `Mercado` ya lo tenían.

**FK que quedan simples a propósito:** `compradorContactoId`/`direccionId` (hijos de `Entidad`, sin `empresaId`), `paisDestinoId`/`monedaId` (mantenedores globales) y `condicionPagoId` (`CondicionPago` aún no es tenant — mismo caso que `ProductorContrato` en el lote 5, pendiente de retrofitear cuando llegue el lote Compras).

**3 índices únicos globales convertidos a `(empresaId, ...)`:** `NotaVenta.folio` y `Embarque.numeroInstructivo` (ambos con `eliminadoEn`, únicos parciales) e `InstructivoEmbalaje.numero` (sin `eliminadoEn`, único normal — mismo caso que `Articulo`/`Receta`/`TipoMovimiento` en el lote Materiales).

**Tablas de detalle sin `empresaId` propio** (`NotaVentaDetalle`→`Especie`/`Variedad`/`Articulo`/`Categoria`/`TipoPallet`, `NotaVentaDetalleCalibre`→`Calibre`, `NotaVentaCuotaPago`→`UnidadMedida`, `InstructivoEmbalajeDetalle`→`Articulo`/`Especie`/`Variedad`/`Categoria`/`Calibre`×2) — mismo patrón que los lotes 3-5: sin FK compuesta posible, aislamiento vía validación de servicio.

**El módulo ya estaba bien construido — cero hallazgos de QA en este lote:** a diferencia de los lotes 4 y 5 (donde se encontraron funciones de servicio que saltaban la validación tenant-scoped del padre), se revisó individualmente cada función de `notas-venta.service.ts`, `embarques.service.ts` e `instructivo-embalaje.service.ts` ANTES de implementar. `validarReferenciasHeader` en `notas-venta.service.ts` ya validaba **las 9 referencias del encabezado** (incluyendo los 3 `Parametro` contra su `tipoParametroCodigo` esperado); `generarEmbarque` y `crearInstructivo` ya validaban el `NotaVenta` padre primero. Todas se volvieron tenant-scoped automáticamente al agregar los modelos destino a `MODELOS_TENANT`, sin cambio de código en los servicios.

**Repos ajustados:** `notas-venta`/`embarques.repository.ts` (módulo Ventas) e `instructivo-embalaje.repository.ts` (módulo Compras) — `empresaId` explícito en sus `create`. Los `aggregate({_max:{folio}})`/`aggregate({_max:{numero}})` para los correlativos se auto-escopan gratis (`aggregate` ya estaba clasificado en la extensión desde Fase 2a).

**Fixtures de test — `enterWith` falla también dentro de `$transaction()` (hallazgo de QA, tests ronda 2):** ningún archivo de test crea `NotaVenta`/`Embarque`/`InstructivoEmbalaje` vía `prisma.<modelo>.create()` crudo — todo el acceso pasa por el service layer. Se asumió inicialmente que `ventas-compras.integration.test.ts` podía seguir usando el patrón `enterWith`-en-`beforeEach` para estas llamadas (ya validado para llamadas de servicio en los lotes 1 y 4), pero Codex encontró que **`getEmpresaIdActual()` devuelve `null` cuando se invoca dentro de un `prisma.$transaction(async (tx) => {...})`** si el contexto ALS se estableció vía `enterWith` — `createNotaVenta`, `updateNotaVenta`, `addDetalle`/`updateDetalle`/`removeDetalle` y `createInstructivo` usan `$transaction` internamente, y ninguna llamada anterior (lotes 1/4/5) había ejercitado esta combinación exacta (contexto vía `enterWith` + `getEmpresaIdActual()` leído dentro de una transacción). Se corrigió envolviendo específicamente `crearNotaVenta`/`actualizarNotaVenta`/`eliminarNotaVenta`/`agregarDetalle`/`crearInstructivo` en `empresaContext.run()` vía wrappers locales (mismo patrón que el lote Calidad), dejando el resto del archivo (que no atraviesa un límite de `$transaction` para leer `getEmpresaIdActual()`) sin cambios. **Lección para lotes futuros: `enterWith` no es confiable para NINGÚN código que lea el contexto ALS después de cruzar un `prisma.$transaction()`** — cualquier `create()`/`update()` dentro de una transacción que necesite `getEmpresaIdActual()` debe probarse con `.run()`, no asumir que `enterWith` alcanza solo porque otras llamadas del mismo archivo ya funcionaron.

**Contrato de API sin cambios** — verificado con `tsc --noEmit` en `fas-web`, cero archivos tocados.

### Lote 7 — Compras (implementado, último de Fase 3)

5 modelos: `OrdenCompra`, `CondicionPago`, `Recepcion`, `Pallet`, `TemplateCarga`. **12 FK compuestas — nuevo récord** (supera las 11 del lote Ventas), incluyendo 2 retrofits de FKs simples que quedaron pendientes en lotes anteriores porque `CondicionPago` no era tenant todavía:

1. `OrdenCompra ↔ Entidad` (`entidadProductorId`)
2. `OrdenCompra ↔ NotaVenta` (`notaVentaId`, opcional)
3. `OrdenCompra ↔ FormaPago` (`formaPagoId`, opcional)
4. `OrdenCompra ↔ CondicionPago` (`condicionPagoId`, opcional)
5. `OrdenCompra ↔ Mercado` (`destinoMercadoId`, opcional)
6. `Recepcion ↔ OrdenCompra` (`ordenCompraId`, opcional — modo CONSIGNACION)
7. `Recepcion ↔ Entidad` (`plantaId`)
8. `Recepcion ↔ TemplateCarga` (`templateCargaId`, opcional)
9. `Pallet ↔ Recepcion` (`recepcionId`)
10. `Pallet ↔ Entidad` (`productorId`)
11. **Retrofit** `ProductorContrato.condicionPagoId → CondicionPago` (pendiente desde el lote Productores)
12. **Retrofit** `NotaVenta.condicionPagoId → CondicionPago` (pendiente desde el lote Ventas)

`FormaPago`, `CondicionPago`, `OrdenCompra`, `TemplateCarga` y `Recepcion` necesitaban `@@unique([empresaId, id])` nuevo. `Entidad`, `NotaVenta` y `Mercado` ya lo tenían.

**4 índices únicos convertidos a `(empresaId, ...)`:** `OrdenCompra.numero` y `Recepcion.numero` (parciales, con `eliminadoEn`); `CondicionPago.codigo` y `TemplateCarga.codigo` — estos dos **eran índices únicos parciales crudos GLOBALES preexistentes, invisibles en el DSL de Prisma** (mismo patrón que lotes 1/2/4) — se detectaron proactivamente ANTES de implementar, no por hallazgo de QA. El índice de negocio `Recepcion.ordenCompraId` ("una Recepción activa por OC") queda igual, sin `empresaId` — transitivamente scoped vía `ordenCompraId`.

**`Pallet` no tiene código de creación todavía** — el motor de validación que generaría pallets desde una Recepción está diferido (comentario propio del schema). Solo requirió el cambio de schema/migración/`MODELOS_TENANT`, sin tocar repos ni servicios (no existe ninguna llamada `prisma.pallet.create` en el código).

**Dos hallazgos aplicando lecciones de lotes anteriores, corregidos ANTES de que Codex tuviera que encontrarlos:**
1. **Bug real, mismo tipo que el lote Materiales:** `descargarAdjunto` en `recepciones.service.ts` no validaba la `Recepcion` padre (`obtenerRecepcion`) antes de servir el adjunto, a diferencia de `subirAdjunto`/`eliminarAdjunto` que sí lo hacían — corregido con la misma validación tenant-scoped.
2. **Mismo patrón de test que el lote Ventas:** `createOrdenCompra` usa `prisma.$transaction()` internamente (igual que `createNotaVenta`), así que la sección "Orden de Compra" de `ventas-compras.integration.test.ts` se envolvió proactivamente en `.run()` (no se esperó a que Codex repitiera el hallazgo de `enterWith`+`$transaction` del lote Ventas). También se corrigió el helper local `crearCondicionPago` (`prisma.condicionPago.create()` crudo) para recibir `empresaId` explícito.

**Repos ajustados:** `ordenes-compra`/`recepciones.repository.ts` (módulo Compras) y `condiciones-pago`/`templates-carga.repository.ts` (módulo Config) — `empresaId` explícito en sus `create`. Todas las validaciones de encabezado y línea ya existentes (`ordenes-compra.service.ts#validarReferenciasHeader`/`validarLinea`, `recepciones.service.ts#validarOrdenCompra`/`validarPlantaYDireccion`/`validarTemplateCarga`) ya estaban completas y se volvieron tenant-scoped automáticamente, sin cambio de código.

**Contrato de API sin cambios** — verificado con `tsc --noEmit` en `fas-web`, cero archivos tocados.

---

## Fase 3 — completa

Los 7 sub-lotes de Fase 3 (Config/Mantenedores, Entidades, Calidad, Materiales, Productores, Ventas, Compras) quedan implementados. Todo modelo raíz del sistema con datos de negocio real es ahora tenant-scoped por `empresaId`, enforced server-side por la Prisma Client Extension de Fase 2a. Quedan como trabajo futuro (fuera del alcance original de Fase 3): Fase 4 (UI de administración de Empresas) y la cobertura de tests de aislamiento cruzado entre dos empresas explícitamente señalada como deuda en cada lote.
