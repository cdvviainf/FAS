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
> | **Estado** | Fase 0 en desarrollo (fundación de datos) |

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

## 3. Seed y migración

- **Seed:** crea `AGROSAN` ("Frutera Agrosan SpA") y `AGDRY` ("AGDry", solo el nombre; el resto se completa en la UI). Idempotente vía `findFirst`+`create`, ahora protegido por `codigo @unique`.
- **Backfill (fase de tenancy):** todos los datos existentes se asocian a Agrosan (empresa base). Los usuarios existentes quedan solo en Agrosan como predeterminada; AGDry se asigna manualmente.
- **Migraciones self-safe:** al agregar `empresaId` a tablas pobladas → nullable → backfill=Agrosan → `NOT NULL`. Nunca `NOT NULL` directo (ver incidente 2026-07-29).

---

## 4. Fases

| Fase | Contenido | Estado |
|---|---|---|
| **0** | `Empresa` + `EmpresaDireccion` + `EmpresaContacto` + `UsuarioEmpresa` + `Usuario.empresaPredeterminadaId` + seed | **En desarrollo** |
| **1** | Contexto de empresa: `requireAuth` valida `X-Empresa-Id` (AsyncLocalStorage) · `EmpresaProvider` en front · cambio de empresa resetea Temporada | Pendiente |
| **2** | Prisma Client Extension · `empresaId` en modelos raíz · uniques `@@unique([empresaId, codigo])` · folios por empresa · `ConfiguracionCorreo` por empresa | Pendiente |
| **3** | Migración de datos self-safe por lotes del resto de tablas | Pendiente |
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
