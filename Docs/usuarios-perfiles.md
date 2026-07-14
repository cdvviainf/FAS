# Módulo: Usuarios y Perfiles (Seguridad) — FAS

> **Spec de módulo para desarrollo autónomo con Claude Code.** Extiende `CLAUDE.md` y `00-entorno-general.md` (regla E2).
>
> | | |
> |---|---|
> | **Etapa** | 1 |
> | **Sección de menú** | Configuración › Perfiles · Configuración › Usuarios |
> | **Backend** | `fas-api` · prefijo `/api/config` |
> | **Frontend** | `fas-web` · `app/(app)/config/{perfiles,usuarios}/` |
> | **Depende de** | Better Auth (autenticación), catálogo `ItemMenu` |
> | **Usado por** | Todos los módulos (autorización por ítem de menú) |
> | **Estado** | Listo para desarrollo |

---

## 0. Contexto para Claude Code

Implementa la **autorización** de la aplicación (E2). Better Auth gestiona la **autenticación** (email/contraseña, hash, sesiones). Aquí se definen **Perfiles** (con nivel de acceso por ítem de menú) y **Usuarios** (perfil de aplicación asociado a un perfil). El menú lateral y la matriz de permisos se construyen sobre un catálogo `ItemMenu` que **crece con cada módulo** que se agrega (vía seed/migración).

---

## 1. Objetivo

Permitir a un perfil administrador (acceso `TOTAL` a Configuración) crear perfiles que definen qué puede ver/hacer cada usuario en cada ítem de menú (`Total` / `Lectura` / `Sin acceso`), y administrar usuarios asociados a un perfil.

---

## 2. Alcance

**Construye:** catálogo `ItemMenu`, CRUD de `Perfil` con su matriz de accesos, CRUD de `Usuario` (sobre Better Auth) y el **guard de autorización** (backend) + armado dinámico del menú (frontend).

**NO construye:** la autenticación en sí (login, recuperación, sesiones, hash) — es responsabilidad de Better Auth. Tampoco edición libre del catálogo `ItemMenu` (es del sistema).

---

## 3. Decisiones cerradas (defaults)

| # | Decisión | Default |
|---|---|---|
| UP1 | Perfil por usuario | **Uno** (FK `perfilId`). |
| UP2 | Acceso no especificado | Si un perfil no tiene fila para un ítem → `SIN_ACCESO`. |
| UP3 | Catálogo de menú | `ItemMenu` poblado por seed/migración; **no** editable por usuario; se lista dinámicamente en el editor de perfiles (RP4). |
| UP9 | Permisos de acción | Un `ItemMenu` puede representar una **pantalla** o una **acción** (`esAccion=true`), p. ej. "Reclamos · Valorización", "Reclamos · Cierre/Reapertura", "OC · Aprobación". Las acciones se evalúan con nivel `TOTAL` = permitido; `SIN_ACCESO` = denegado. |
| UP4 | Usuario | Es el modelo `user` de Better Auth + campos adicionales (`nombre`, `whatsapp`, `imagenUrl`, `perfilId`). Login = email. |
| UP5 | Contraseña | Gestionada por Better Auth (hash). Validación de **complejidad** + **confirmación** al crear/cambiar. Nunca en texto plano ni almacenada en este módulo. |
| UP6 | Política de complejidad | ≥8 caracteres, al menos una mayúscula, una minúscula, un número y un símbolo. (Ajustable.) |
| UP7 | Avatar | `imagenUrl` opcional; archivo a storage (igual patrón que documentos). |
| UP8 | Reconciliación de "roles" | Donde los specs dicen "rol `ADMIN`/`MATERIALES`", se mapea a nivel de acceso del perfil sobre los ítems del módulo. `ADMIN` = perfil con `TOTAL` en Configuración. |

---

## 4. Modelo de datos (Prisma)

```prisma
enum NivelAcceso {
  SIN_ACCESO
  LECTURA
  TOTAL
}

// Catálogo del sistema (seed). Fuente del menú lateral y de la matriz de permisos.
model ItemMenu {
  id      Int            @id @default(autoincrement())
  codigo  String         @unique
  nombre  String
  seccion String                          // Configuración, Compras, Ventas, ... (E4)
  ruta    String?
  esAccion Boolean       @default(false)   // true = permiso de acción (no pantalla), p.ej. valorizar/cerrar
  orden   Int            @default(0)
  activo  Boolean        @default(true)

  accesos PerfilAcceso[]
}

// Maestro: SOLO código + descripción (+ auditoría/softdelete) + matriz de accesos.
model Perfil {
  id            Int            @id @default(autoincrement())
  codigo        String
  descripcion   String

  accesos       PerfilAcceso[]
  usuarios      Usuario[]

  creadoEn      DateTime       @default(now())
  creadoPor     String
  actualizadoEn DateTime?      @updatedAt
  actualizadoPor String?
  eliminadoEn   DateTime?
  eliminadoPor  String?
}

model PerfilAcceso {
  id         Int         @id @default(autoincrement())
  perfilId   Int
  perfil     Perfil      @relation(fields: [perfilId], references: [id])
  itemMenuId Int
  itemMenu   ItemMenu    @relation(fields: [itemMenuId], references: [id])
  nivel      NivelAcceso @default(SIN_ACCESO)

  @@unique([perfilId, itemMenuId])
}

// Usuario = modelo `user` de Better Auth + campos adicionales.
// id, email, emailVerified, password(hash) y sesiones los maneja Better Auth.
model Usuario {
  id            String    @id                 // id de Better Auth
  nombre        String
  email         String    @unique             // login (Better Auth)
  whatsapp      String?
  imagenUrl     String?                        // avatar (UP7)
  perfilId      Int
  perfil        Perfil    @relation(fields: [perfilId], references: [id])

  creadoEn      DateTime  @default(now())
  creadoPor     String?
  actualizadoEn DateTime? @updatedAt
  actualizadoPor String?
  eliminadoEn   DateTime?
  eliminadoPor  String?
}
```

> El `seed` inicial de `ItemMenu` carga el mapa de menú del `00-entorno-general.md` (§8). Cada módulo nuevo agrega sus ítems por migración/seed.

---

## 5. Reglas de negocio / invariantes

- **RP1 — Código de perfil** único entre no eliminados.
- **RP2 — Acceso por defecto.** Ítem sin fila en el perfil → `SIN_ACCESO` (UP2).
- **RP3 — Autorización.** Por ítem de menú: `TOTAL` = lectura y escritura; `LECTURA` = solo lectura (GET); `SIN_ACCESO` = denegado (403). Se aplica en **backend** (guard por ruta→ítem) y en **frontend** (oculta/deshabilita).
- **RP4 — Catálogo de menú.** `ItemMenu` no es editable por usuario; el editor de perfiles lista **todos** los ítems activos dinámicamente (pantallas y acciones).
- **RP6 — Permisos de acción.** Acciones específicas (valorizar/cerrar/reabrir reclamo, aprobar OC, etc.) son `ItemMenu` con `esAccion=true`; el guard las exige con nivel `TOTAL`. Se incluyen en el seed de `ItemMenu`.
- **RP5 — Eliminar perfil con usuarios.** Bloquear softdelete de un perfil con usuarios no eliminados → 409.
- **RU1 — Email único** (login) entre no eliminados.
- **RU2 — Contraseña.** Complejidad (UP6) + confirmación al crear/cambiar; delegada a Better Auth (hash); nunca en texto plano.
- **RU3 — Perfil obligatorio.** Todo usuario tiene un `perfilId`.
- **RU4 — Usuario eliminado.** Con `eliminadoEn` no puede autenticarse (se invalida/deniega sesión vía Better Auth).
- **RU5 — Auditoría + softdelete** en Perfil y Usuario.

---

## 6. Contratos API (Fastify, prefijo `/api/config`)

**Catálogo de menú**
| Método | Ruta | Notas |
|---|---|---|
| GET | `/items-menu` | Lista ítems activos (para el editor de perfiles). |

**Perfiles**
| Método | Ruta | Notas |
|---|---|---|
| GET | `/perfiles` | Lista (no eliminados). |
| GET | `/perfiles/:id` | Perfil + matriz de accesos (todos los ítems, con su nivel; faltantes = SIN_ACCESO). |
| POST | `/perfiles` | `{ codigo, descripcion, accesos:[{itemMenuId, nivel}] }`. |
| PATCH | `/perfiles/:id` | Actualiza datos y/o matriz de accesos. |
| DELETE | `/perfiles/:id` | Softdelete (valida RP5). |

**Usuarios**
| Método | Ruta | Notas |
|---|---|---|
| GET | `/usuarios` | Lista (no eliminados). |
| GET | `/usuarios/:id` | Detalle. |
| POST | `/usuarios` | `{ nombre, email, whatsapp?, imagen?, perfilId, password, passwordConfirm }` → crea vía Better Auth (admin) + valida RU2. |
| PATCH | `/usuarios/:id` | Datos de perfil de app (no password). |
| POST | `/usuarios/:id/password` | Cambio de contraseña (`password` + `passwordConfirm`, complejidad). |
| DELETE | `/usuarios/:id` | Softdelete (RU4). |

**Sesión actual**
| Método | Ruta | Notas |
|---|---|---|
| GET | `/me/menu` | Menú del usuario actual: ítems con nivel ≥ `LECTURA`, agrupados por sección, para el sidebar. |

> El **guard de autorización** resuelve, por cada ruta protegida, el `ItemMenu` asociado y el nivel del perfil del usuario; aplica RP3. La subida de avatar guarda metadata + ruta en storage.

---

## 7. Frontend (`fas-web/app/(app)/config/`)

- **Perfiles:** formulario con código + descripción y una **matriz dinámica**: todos los `ItemMenu` agrupados por sección, cada fila con selector `Total` / `Lectura` / `Sin acceso`. Al agregar módulos nuevos, aparecen solos.
- **Usuarios:** formulario con nombre, **usuario (email)**, WhatsApp, **avatar** (upload), **perfil** (select) y, al crear, **contraseña + repetir contraseña** con indicador de complejidad (UP6). Cambio de contraseña en pantalla aparte.
- **Sidebar:** se arma desde `GET /me/menu`; los ítems en `LECTURA` muestran datos pero deshabilitan acciones de escritura; los `SIN_ACCESO` no aparecen. Responsivo (E5).

---

## 8. Criterios de aceptación (Given / When / Then)

- **CA1 (RP2):** Un perfil sin fila para el ítem X → el usuario recibe 403 al acceder a X y no lo ve en el menú.
- **CA2 (RP4):** Al agregar un nuevo `ItemMenu` (seed), aparece automáticamente en el editor de perfiles.
- **CA3 (RP3-lectura):** Perfil con `LECTURA` en Materiales → `GET` ok; `POST/PATCH/DELETE` → 403; en UI las acciones de escritura están deshabilitadas.
- **CA4 (RP3-total):** Perfil con `TOTAL` → lectura y escritura permitidas.
- **CA5 (RP5):** Eliminar un perfil con usuarios no eliminados → 409.
- **CA6 (RU1):** Crear usuario con email existente (no eliminado) → 422.
- **CA7 (RU2):** Contraseña que no cumple complejidad → 422; `password ≠ passwordConfirm` → 422.
- **CA8 (RU3):** Crear usuario sin perfil → 422.
- **CA9 (RU4):** Usuario con softdelete no puede autenticarse.
- **CA10 (/me/menu):** Retorna solo ítems con nivel ≥ `LECTURA`, agrupados por sección.

---

## 9. Plan de implementación (orden para Claude Code)

1. Configurar Better Auth (email/contraseña, sesiones) + campos adicionales del usuario.
2. Schema: `ItemMenu`, `Perfil`, `PerfilAcceso`, `Usuario` + migración + seed de `ItemMenu` (menú actual).
3. Validador de política de contraseña (UP6) + confirmación.
4. Services: perfiles (CRUD + matriz, RP1/RP5), usuarios (CRUD sobre Better Auth, RU1/RU2/RU3).
5. **Guard de autorización** (ruta→ítem→nivel, RP3) reutilizable por todos los módulos.
6. Endpoint `/me/menu`.
7. Tests CA1–CA10.
8. Frontend: editor de perfiles (matriz dinámica) + usuarios (avatar, password+confirm) + sidebar desde `/me/menu`.

---

## 10. Definition of Done

- [ ] Better Auth operativo (login/sesión) con campos de usuario extendidos.
- [ ] `ItemMenu`/`Perfil`/`PerfilAcceso`/`Usuario` migrados + seed del menú.
- [ ] Guard de autorización aplicado en rutas (RP3) y reutilizable.
- [ ] Política de contraseña + confirmación funcionando.
- [ ] Tests CA1–CA10 en verde.
- [ ] Editor de perfiles con matriz dinámica + usuarios con avatar + sidebar dinámico, responsivos.
- [ ] Schema incorporado al `CLAUDE.md` global.
