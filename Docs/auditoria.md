# Auditoría (trazabilidad de acciones de usuario)

> Spec autoritativo del módulo transversal de auditoría. Módulo **portable**:
> diseñado para reutilizarse en otros proyectos con mínimo acoplamiento.
> Última actualización: 2026-10-15.

## 1. Objetivo

Registrar **quién, cuándo y qué** hizo cada usuario:

- **Acceso al sistema**: `LOGIN`, `LOGOUT`, `LOGIN_FALLIDO`.
- **Acceso a cada menú**: `ACCESO_MENU` (evento explícito emitido por el frontend al navegar).
- **Mutaciones de datos**: `CREAR`, `EDITAR`, `ELIMINAR` (captura automática vía extensión Prisma).

## 2. Modelo de datos — `AuditLog`

Tabla `audit_logs`. **Sin FKs** a Usuario/Empresa (se guardan ids + snapshot de email) para ser portable.

| Campo | Notas |
|---|---|
| `empresaId Int?` | Empresa del evento (ver §4). |
| `usuarioId String?` + `usuarioEmail String?` | id (boundary Better Auth) + snapshot. |
| `accion AccionAuditoria` | enum (§1). |
| `entidad String?` / `entidadId String?` | modelo Prisma afectado + id (mutaciones). |
| `ruta String?` / `itemMenuCodigo String?` | `ACCESO_MENU`. |
| `datosAntes Json?` / `datosDespues Json?` | snapshots enmascarados (EDITAR/ELIMINAR/CREAR). |
| `resumen Json?` | operaciones masivas: `{ operacion, criterio, cantidad }`. |
| `ip` / `userAgent` / `creadoEn` | metadatos. |

## 3. Captura

1. **Contexto por request** (`AsyncLocalStorage` anidado en el de empresa): `usuarioId`, `usuarioEmail`, `ip`, `userAgent`, `ruta`, y un **buffer de eventos** de mutación. Lo completa `requireAuth`.
2. **Mutaciones**: extensión Prisma `withAuditoria` (`$allOperations`), INNER respecto de `withTenancy`.
   - Audita **todas las tablas** menos `MODELOS_EXCLUIDOS_AUDITORIA` (`AuditLog`, `Session`, `Account`, `Verification`).
   - **Diff**: pre-lectura del estado previo en `update`/`delete`/`upsert` (vía cliente base, sin extensiones).
   - **Soft-delete**: un `update` que setea `eliminadoEn` (null→fecha) se registra como `ELIMINAR`.
   - **Masking**: campos sensibles por nombre (`password`, `token`, `secret`, `hash`, `apikey`) **y por modelo** (`CAMPOS_SENSIBLES_POR_MODELO`, ej. `IntegracionParametro.valorExterno`); blobs → `[binario]`.
   - **Masivas** (`updateMany`/`deleteMany`/`createMany`): una entrada resumen (criterio + cantidad).
   - **Sin contexto de request** (seed, scripts, jobs): **no se audita** (la auditoría registra acciones de usuario, no del sistema).
   - **Captura de nivel superior (parent-céntrica)** — A-QA-006: la extensión intercepta la operación raíz. Una **escritura anidada** de Prisma (ej. crear un adjunto hijo dentro del `create` del padre) **no** genera un `AuditLog` por cada entidad hija; sus datos quedan dentro del `datosDespues` del evento del padre cuando el repositorio los incluye. La captura por-entidad-hija vía DMMF es alcance de una **iteración futura**.
   - **Snapshots según el resultado de la operación** — A-QA-007: `datosAntes`/`datosDespues` reflejan la fila previa (pre-lectura completa) y el **resultado** de la operación. El resultado puede ser **parcial** según el `select`/`include` del repositorio; se usa tal cual porque es la vista **consistente con la transacción** en curso (una re-lectura por el cliente base no vería cambios aún sin commitear). Reconstrucción total garantizada = fuera de alcance de Fase A.
3. **Consistencia transaccional**: los eventos de mutación se **acumulan en el buffer** del request y se **publican en `onResponse` solo si `statusCode < 400`**. Si una transacción revierte y el handler responde error, los eventos se **descartan** (no quedan fantasmas).
4. **Acceso al sistema**: `LOGIN` vía `databaseHooks.session.create.after` de Better Auth; `LOGOUT` y `LOGIN_FALLIDO` vía `onResponse` sobre `/api/auth/*`.
5. **Acceso a menú**: `POST /api/auditoria/navegacion { ruta, itemMenuCodigo }` (cualquier usuario autenticado).
6. **Escritura asíncrona** vía cola BullMQ `auditoria` (fire-and-forget). Ante Redis caído el evento **se pierde silenciosamente** (best-effort): la auditoría nunca bloquea ni rompe la operación de negocio.

## 4. Multiempresa (aislamiento)

- La consulta (`GET /api/auditoria`) está **estrictamente acotada a la empresa activa**; nunca mezcla eventos de otras empresas ni globales.
- Los eventos de acceso resuelven su `empresaId` desde la **empresa predeterminada** del usuario (por id o email), de modo que quedan dentro de su empresa.
- Los eventos **globales** (`empresaId null`, p. ej. login fallido de email desconocido) se **persisten** pero no se muestran en la vista por-empresa. Una **vista global** (permiso administrativo aparte) queda para una fase posterior.

## 5. Autorización

- Ítem de menú `CONFIG_AUDITORIA` (tipo `REPORTE`, Configuración → Sistema). Consulta: nivel `LECTURA`.
- El ítem y el acceso `TOTAL` de ADMIN se crean en la **migración** (producción no corre seed).

## 6. Alcance por fase

- **Fase A (este entregable)**: backend completo (modelo, extensión, cola+worker, hooks de acceso, endpoint de navegación, consulta con filtros).
- **Fase B**: frontend — pantalla `/dashboard/configuracion/auditoria` con filtros (usuario, rango de fechas, acción, entidad, texto) + export; provider que emite `ACCESO_MENU` al navegar.
- **Futuro**: vista global de eventos anónimos, job de retención/purga configurable (propuesto 12 meses).

## 7. Reutilización

Todo lo portable vive en `src/lib/auditoria/` (contexto, extensión, config de exclusiones/masking) + `src/modules/auditoria/`. Para portar a otro proyecto, ajustar **solo** `config.ts` (`MODELOS_EXCLUIDOS_AUDITORIA`, patrones sensibles, `CAMPOS_SENSIBLES_POR_MODELO`) y el cableado de hooks de auth.
