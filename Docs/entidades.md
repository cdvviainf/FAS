# Módulo: Entidades — FAS

> **Spec de módulo para desarrollo autónomo con Claude Code.** Extiende `CLAUDE.md` y `00-entorno-general.md`.
>
> | | |
> |---|---|
> | **Etapa** | 1 |
> | **Sección de menú** | Configuración › Entidades (acceso por perfil, E2) |
> | **Backend** | `fas-api` · prefijo `/api/config/entidades` |
> | **Frontend** | `fas-web` · `app/(app)/config/entidades/` |
> | **Depende de** | Mantenedores Generales (`Pais`, `Comuna`) |
> | **Usado por** | Materiales, Compras, Ventas, Liquidaciones (FK a `Entidad`) |
> | **Estado** | Listo para desarrollo |

---

## 0. Contexto para Claude Code

Entidad es un **maestro normal** (misma base que los mantenedores generales: id `Int`, código único entre no eliminados, auditoría, softdelete) **extendido** con datos de empresa y una clasificación **multiselect** de funciones. Cada entidad puede cumplir **más de una función** (ej. ser Proveedor y Productor a la vez). Tiene **3 tablas relacionadas**: la entidad y sus **direcciones** y **contactos**.

---

## 1. Objetivo

Administrar a todos los terceros del negocio (clientes, proveedores, productores, navieras, agentes, etc.) con sus direcciones y contactos, sirviendo de referencia única para los módulos operativos.

---

## 2. Alcance

**Construye:** CRUD de Entidad (maestro) + sub-CRUD de Direcciones y Contactos, con clasificación multiselect de funciones.

**NO construye:** lógica específica de cada función (eso vive en los módulos que la consumen, ej. condiciones comerciales de un Cliente en Ventas).

---

## 3. Decisiones cerradas (defaults)

| # | Decisión | Default |
|---|---|---|
| EN1 | Tipo "Cliente Extranjero Notify" | Interpretado como **dos** tipos: `CLIENTE_EXTRANJERO` y `NOTIFY`. (Ajustar enum si era uno solo.) |
| EN2 | Patrón | Maestro de Configuración: `Int` autoincremental, código único entre no eliminados, auditoría y softdelete (G1–G4). |
| EN3 | `descripcion` (base) | Nombre comercial / de fantasía; `razonSocial` es el nombre legal. |
| EN4 | RUT | Opcional (entidades extranjeras pueden no tener); si viene, validar DV chileno (módulo 11) y único entre no eliminados. |
| EN5 | Tipos | Multiselect, **mínimo uno** (R1). |
| EN6 | Comuna en dirección | Opcional; aplica a direcciones en Chile. País obligatorio. |
| EN7 | Dirección por defecto | Máximo una por entidad; marcar una desmarca la anterior. |
| EN8 | Códigos hijos | `codigo` de dirección/contacto único **por entidad** entre no eliminados. |
| EN9 | Reconciliación | Supersede al enum provisional `EntidadRelacionada` de `materiales.md`. Los módulos referencian `Entidad` por FK (`Int`) y validan funciones contra `Entidad.tipos`. |

---

## 4. Modelo de datos (Prisma)

```prisma
enum TipoEntidad {
  CLIENTE_NACIONAL
  CLIENTE_EXTRANJERO
  NOTIFY
  CONSIGNATARIO
  NAVIERA
  AGENTE_ADUANA
  COMPANIA_EMBARQUE
  PROVEEDOR
  EMPRESA_TRANSPORTE
  PRODUCTOR
  EXPORTADORA
  PLANTA
}

model Entidad {
  // + base (§4.1 de mantenedores-generales.md): id Int, codigo, descripcion,
  //   descripcionExtranjera, creado/actualizado/eliminado (+Por), softdelete
  razonSocial String
  giro        String?
  rut         String?            // opcional; DV chileno si viene (EN4)
  tipos       TipoEntidad[]      // multiselect, ≥1 (R1)

  direcciones EntidadDireccion[]
  contactos   EntidadContacto[]
  // back-relations operativas (ej. Movimiento) viven en sus módulos
}

model EntidadDireccion {
  id           Int        @id @default(autoincrement())
  entidadId    Int
  entidad      Entidad    @relation(fields: [entidadId], references: [id])
  codigo       String
  paisId       Int
  pais         Pais       @relation(fields: [paisId], references: [id])
  comunaId     Int?
  comuna       Comuna?    @relation(fields: [comunaId], references: [id])
  direccion    String                       // texto de la dirección
  esPorDefecto Boolean    @default(false)

  // auditoría + softdelete (mismo patrón base)
  creadoEn     DateTime   @default(now())
  creadoPor    String
  actualizadoEn DateTime? @updatedAt
  actualizadoPor String?
  eliminadoEn  DateTime?
  eliminadoPor String?

  @@index([entidadId])
}

model EntidadContacto {
  id        Int      @id @default(autoincrement())
  entidadId Int
  entidad   Entidad  @relation(fields: [entidadId], references: [id])
  codigo    String
  nombre    String
  email     String?
  telefono  String?
  whatsapp  String?
  esRepresentanteLegal Boolean @default(false)   // si true, rut es obligatorio (R9)
  rut       String?                              // obligatorio cuando esRepresentanteLegal = true

  // auditoría + softdelete
  creadoEn     DateTime   @default(now())
  creadoPor    String
  actualizadoEn DateTime? @updatedAt
  actualizadoPor String?
  eliminadoEn  DateTime?
  eliminadoPor String?

  @@index([entidadId])
}
```

> Agregar a los maestros de Configuración las back-relations: `Pais.direcciones EntidadDireccion[]` y `Comuna.direcciones EntidadDireccion[]`.

---

## 5. Reglas de negocio / invariantes

- **R1 — Al menos un tipo.** Toda `Entidad` debe tener ≥1 valor en `tipos` → 422.
- **R2 — Código único.** `codigo` de Entidad único entre no eliminados (regla maestro). Igual para `codigo` de dirección/contacto, pero **único por entidad** (EN8).
- **R3 — RUT.** Opcional; si viene, formato + DV chileno válidos y único entre no eliminados → 422 si inválido/duplicado.
- **R4 — Dirección por defecto.** Máximo una `esPorDefecto = true` por entidad; al marcar una, se desmarca la anterior.
- **R5 — Comuna/País.** `paisId` obligatorio en dirección; `comunaId` opcional y, si viene, debe pertenecer a Chile (consistencia geográfica).
- **R6 — Softdelete + auditoría.** En las 3 tablas; listados filtran `eliminadoEn IS NULL`.
- **R7 — Eliminación con uso.** No se permite softdelete de una Entidad referenciada por registros operativos no eliminados → 409.
- **R8 — Función requerida (reconciliación).** Cuando un módulo exige una entidad de cierta función (ej. movimiento con `entidadRelacionada = PROVEEDOR`), la entidad seleccionada debe incluir ese valor en `tipos` → 422 si no.
- **R9 — Representante legal.** Un contacto con `esRepresentanteLegal = true` exige `rut` (válido, DV) → 422 si falta. Máximo un representante legal por entidad. (Los Productores exigen tener uno — ver `productores.md`.)

---

## 6. Contratos API (Fastify, prefijo `/api/config`)

| Método | Ruta | Notas |
|---|---|---|
| GET | `/entidades` | Lista; filtros `tipo?` (función), `q?`, paginado. `tipo` permite poblar selects (ej. proveedores). |
| GET | `/entidades/:id` | Entidad + direcciones + contactos. |
| POST | `/entidades` | Valida R1/R3. |
| PATCH | `/entidades/:id` | |
| DELETE | `/entidades/:id` | Softdelete (valida R7). |
| GET | `/entidades/:id/direcciones` | |
| POST | `/entidades/:id/direcciones` | Valida R4/R5. |
| PATCH | `/entidades/:id/direcciones/:dirId` | Valida R4. |
| DELETE | `/entidades/:id/direcciones/:dirId` | Softdelete. |
| GET | `/entidades/:id/contactos` | |
| POST | `/entidades/:id/contactos` | |
| PATCH | `/entidades/:id/contactos/:conId` | |
| DELETE | `/entidades/:id/contactos/:conId` | Softdelete. |

---

## 7. Frontend (`fas-web/app/(app)/config/entidades/`)

- **Listado:** tabla con búsqueda, filtro por función (tipo), estado.
- **Detalle/edición:** formulario con datos de empresa (código, descripción/nombre, descripción extranjera, razón social, giro, RUT) + **multiselect de tipos**, y dos sub-secciones (tabs o paneles):
  - **Direcciones:** grilla con código, país (select), comuna (select opcional), dirección (texto) y switch "por defecto".
  - **Contactos:** grilla con código, nombre, email, teléfono, WhatsApp.
- Validación de RUT en cliente (formato) y servidor (DV). Responsivo (E5).

---

## 8. Criterios de aceptación (Given / When / Then)

- **CA1 (R1):** Crear entidad sin tipos → 422.
- **CA2 (R1 multi):** Una entidad puede guardarse con `tipos = [PROVEEDOR, PRODUCTOR]` y aparece en filtros de ambas funciones.
- **CA3 (R3):** RUT con DV inválido → 422; RUT duplicado entre no eliminados → 422; entidad extranjera sin RUT → OK.
- **CA4 (R4):** Marcar una segunda dirección como por defecto desmarca la primera; nunca hay dos.
- **CA5 (R5):** Dirección con comuna que no es de Chile → 422; dirección extranjera sin comuna → OK.
- **CA6 (R2):** Dos contactos de la misma entidad con el mismo código → 422; mismo código en otra entidad → OK.
- **CA7 (R7):** Eliminar una entidad usada por un movimiento no eliminado → 409.
- **CA8 (R8):** Movimiento que exige `PROVEEDOR` con entidad cuyos tipos no incluyen `PROVEEDOR` → 422.
- **CA9 (GET filtro):** `GET /entidades?tipo=PROVEEDOR` retorna solo entidades con esa función (no eliminadas).

---

## 9. Plan de implementación (orden para Claude Code)

1. Enum `TipoEntidad` + modelos `Entidad`/`EntidadDireccion`/`EntidadContacto` + migración + back-relations en Pais/Comuna.
2. Validador de RUT (formato + DV módulo 11) reutilizable.
3. Service maestro (CRUD + softdelete + auditoría + unicidades R2/R3) + reglas R1/R4/R5/R7.
4. Rutas de entidad y sub-recursos (direcciones, contactos) + filtro `tipo`.
5. Tests CA1–CA9.
6. Frontend: listado + detalle con multiselect y sub-grillas de direcciones/contactos.

---

## 10. Definition of Done

- [ ] 3 tablas migradas con auditoría y softdelete.
- [ ] Validación de RUT (DV) operativa.
- [ ] Endpoints de §6 con reglas R1–R8.
- [ ] Tests CA1–CA9 en verde.
- [ ] Pantalla de Entidades con multiselect de funciones y sub-grillas, responsiva.
- [ ] Reconciliación aplicada en `materiales.md` (FK a Entidad).
- [ ] Schema incorporado al `CLAUDE.md` global.
