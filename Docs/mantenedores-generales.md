# Módulo: Configuración / Mantenedores Generales — FAS

> **Spec de módulo para desarrollo autónomo con Claude Code.** Extiende `CLAUDE.md`.
>
> | | |
> |---|---|
> | **Etapa** | 1 — Operación core (base transversal) |
> | **Acceso** | Por perfil: ítem de menú **Configuración › {Nombre del mantenedor}**, nivel `LECTURA`/`TOTAL` |
> | **Backend** | `fas-api` · prefijo `/api/config` |
> | **Frontend** | `fas-web` · `app/(app)/config/` |
> | **Usado por** | Materiales, Fruta, Ventas, Compras, Liquidaciones (FKs a estos maestros) |
> | **Estado** | Listo para desarrollo |

---

## 0. Contexto para Claude Code

Conjunto de **24 mantenedores** (CRUD) que comparten una **base común** (código, descripción, descripción extranjera, auditoría y softdelete) y se diferencian solo por campos y relaciones extra. Cada mantenedor es una entrada de menú bajo **Configuración**, accesible por perfiles con acceso a ese ítem de menú. Estos maestros son referenciados (FK) por los módulos operativos.

**Importante:** los maestros usan **id autonumérico** (`Int @id @default(autoincrement())`); el `codigo` lo ingresa el usuario y es único **solo entre registros no eliminados**. Las FKs desde otros módulos hacia estos maestros son, por lo tanto, `Int`.

---

## 1. Objetivo

Administrar los catálogos transversales del sistema con auditoría completa y borrado lógico, sirviendo de base referencial para toda la operación.

---

## 2. Alcance

**Construye:** los 24 mantenedores del §4 con CRUD genérico + reglas especiales (§5), bajo un patrón reutilizable (base común + servicio genérico parametrizable).

**NO construye:** mantenedor de **Entidades** (Proveedor/Productor/Cliente/Empresa de transporte) — se define en un `.md` aparte por su mayor complejidad.

---

## 3. Decisiones cerradas (defaults)

| # | Decisión | Default |
|---|---|---|
| G1 | PK | `Int` autoincremental en todos los maestros. |
| G2 | Código | Ingresado por el usuario, **único entre no eliminados** (índice parcial `WHERE eliminado_en IS NULL`). |
| G3 | Estado | Solo softdelete (`eliminadoEn`); **no** hay flag `activo`. Todo listado/validación filtra `eliminadoEn IS NULL`. |
| G4 | Auditoría | 3 pares: `creadoEn/creadoPor`, `actualizadoEn/actualizadoPor`, `eliminadoEn/eliminadoPor`. `*Por` = userId. |
| G5 | Descripción extranjera | Un solo idioma. |
| G6 | Geolocalización | `latitud`/`longitud` como `Decimal(10,7)` (óptimo para graficar en mapa). Opcional. |
| G7 | Geografía Chile | Cadena `Región → Provincia → Comuna`. `Zona` y `País` son independientes (standalone). |
| G8 | Código País | ISO 3166-1 **alfa-3** (`CHL`, `USA`, `CHN`). |
| G9 | Código Moneda | ISO 4217 (`CLP`, `USD`). |
| G10 | Tipo de bodega | Enum fijo en código: `MATERIALES`, `EMBARQUE`, `DESPACHO` (multiselect). |
| G11 | Eliminación con dependientes | Bloquear softdelete de un padre con hijos no eliminados → 409 (ver R8). |

---

## 4. Modelo de datos (Prisma)

### 4.1 Base común (se incluye en TODOS los maestros)

```prisma
// Campos base — replicar en cada modelo del catálogo (§4.3)
id                    Int       @id @default(autoincrement())
codigo                String                              // obligatorio
descripcion           String                              // obligatorio
descripcionExtranjera String?
creadoEn              DateTime  @default(now())
creadoPor             String
actualizadoEn         DateTime? @updatedAt
actualizadoPor        String?
eliminadoEn           DateTime?                           // softdelete (G3)
eliminadoPor          String?
// Índice parcial único de `codigo` WHERE eliminado_en IS NULL → vía migración SQL (G2)
```

### 4.2 Enums

```prisma
enum TipoBodega {
  MATERIALES
  EMBARQUE
  DESPACHO
}

enum NaturalezaCuentaCorriente {
  DEBE
  HABER
  AMBOS
}
```

### 4.3 Catálogo de mantenedores (deltas sobre la base)

> Cada modelo = **campos base (§4.1)** + lo indicado. Se muestran también las back-relations necesarias.

```prisma
model Temporada {
  // + base
  fechaInicio  DateTime @db.Date
  fechaTermino DateTime @db.Date
  // Validación: rangos no se solapan (R4)
}

model Pais {
  // + base — codigo = ISO 3166-1 alfa-3 (G8)
  esPaisOrigen Boolean   @default(false)
  puertos      Puerto[]
  mercados     Mercado[]
}

model TipoEmbarque {
  // + base
  puertos Puerto[]
}

model Zona {
  // + base (standalone, G7)
}

model Region {
  // + base (Chile)
  provincias Provincia[]
}

model Provincia {
  // + base
  regionId Int
  region   Region   @relation(fields: [regionId], references: [id])
  comunas  Comuna[]
}

model Comuna {
  // + base
  provinciaId Int
  provincia   Provincia @relation(fields: [provinciaId], references: [id])
  bodegas     Bodega[]
}

model Puerto {
  // + base
  paisId         Int
  pais           Pais         @relation(fields: [paisId], references: [id])
  tipoEmbarqueId Int
  tipoEmbarque   TipoEmbarque @relation(fields: [tipoEmbarqueId], references: [id])
  latitud        Decimal?     @db.Decimal(10, 7)
  longitud       Decimal?     @db.Decimal(10, 7)
}

model GrupoMercado {
  // + base
  mercados Mercado[]
}

model Mercado {
  // + base
  grupoMercadoId Int
  grupoMercado   GrupoMercado @relation(fields: [grupoMercadoId], references: [id])
  paisId         Int
  pais           Pais         @relation(fields: [paisId], references: [id])
}

model Moneda {
  // + base — codigo = ISO 4217 (G9)
  esMonedaBase Boolean @default(false)   // exactamente una true (R5)
  decimales    Int     @default(2)
}

model Bodega {
  // + base — DEFINICIÓN CANÓNICA (usada por Materiales)
  direccion String
  comunaId  Int
  comuna    Comuna       @relation(fields: [comunaId], references: [id])
  tipos     TipoBodega[]                 // multiselect (G10)
  latitud   Decimal?     @db.Decimal(10, 7)
  longitud  Decimal?     @db.Decimal(10, 7)
  // back-relations de Materiales (saldos, movimientos) viven en materiales.md
}

model TipoParametro {
  // + base
  parametros Parametro[]
}

model Parametro {
  // + base — ej: TipoParam "Condición de venta" → Parámetros FOB, CIF, CFR
  tipoParametroId Int
  tipoParametro   TipoParametro @relation(fields: [tipoParametroId], references: [id])
}

model Especie {
  // + base
  gruposVariedad GrupoVariedad[]
  variedades     Variedad[]
  categorias     Categoria[]
  calibres       Calibre[]
}

model GrupoVariedad {
  // + base
  especieId  Int
  especie    Especie    @relation(fields: [especieId], references: [id])
  variedades Variedad[]
}

model Variedad {
  // + base
  especieId       Int
  especie         Especie       @relation(fields: [especieId], references: [id])
  grupoVariedadId Int?           // opcional: variedades nuevas pueden no tener grupo asignado
  grupoVariedad   GrupoVariedad? @relation(fields: [grupoVariedadId], references: [id])
}

model Categoria {
  // + base
  especieId Int
  especie   Especie @relation(fields: [especieId], references: [id])
  orden     Int     // único por especie entre no eliminados (R6)
}

model Calibre {
  // + base — padre = Especie (no Categoría)
  especieId Int
  especie   Especie @relation(fields: [especieId], references: [id])
  orden     Int     // único por especie entre no eliminados (R7)
}

model Altura {
  // + base
}

model TipoPallet {
  // + base
}

model TipoProduccion {
  // + base
}

model UnidadMedida {
  // + base — usada por Materiales (Articulo.unidadId)
  // back-relation articulos Articulo[] vive en materiales.md
}

model TipoCuentaCorriente {
  // + base — tipos de debe/haber para la cuenta corriente del productor
  naturaleza NaturalezaCuentaCorriente   // DEBE, HABER o AMBOS
  // back-relation movimientos MovimientoCuentaCorriente[] vive en productores.md
}
```

### 4.4 Agrupación de menú (Configuración)

- **Geografía:** Zona · Región · Provincia · Comuna · País · Puerto
- **Comercial:** Grupo mercado · Mercado · Moneda · Temporada · Tipo de embarque · Tipo cuenta corriente
- **Operación:** Bodega · Unidad de medida · Tipo de pallet · Altura · Tipo Producción
- **Fruta:** Especie · Grupo Variedad · Variedad · Categoría · Calibre
- **Parámetros:** Tipo Parámetro · Parámetro

---

## 5. Reglas de negocio / invariantes

- **R1 — Softdelete.** Nunca borrado físico. Eliminar setea `eliminadoEn`+`eliminadoPor`. Todo listado y toda validación de unicidad filtran `eliminadoEn IS NULL`.
- **R2 — Código único entre no eliminados.** Índice parcial `WHERE eliminado_en IS NULL` (migración SQL) + validación en el service.
- **R3 — Auditoría.** Crear setea `creadoEn/creadoPor`; actualizar setea `actualizadoEn/actualizadoPor`; eliminar setea `eliminadoEn/eliminadoPor`.
- **R4 — Temporada sin solape.** No se permiten dos temporadas (no eliminadas) cuyos rangos `[fechaInicio, fechaTermino]` se intersecten → 422.
- **R5 — Moneda base única.** Debe existir exactamente una `Moneda` con `esMonedaBase = true`. Marcar una nueva desmarca la anterior (o se valida) → nunca cero ni dos.
- **R6 — Categoría.orden.** Único por `especieId` entre no eliminados → 422 si se repite.
- **R7 — Calibre.orden.** Único por `especieId` entre no eliminados → 422 si se repite.
- **R8 — Eliminación con dependientes.** No se puede softdelete de un maestro padre que tenga hijos no eliminados (ej. Especie con variedades, Región con provincias, País con puertos/mercados, Tipo Parámetro con parámetros) → 409.
- **R9 — Puertos por contexto.** El listado en contexto **origen** retorna solo puertos cuyo `pais.esPaisOrigen = true`; en contexto **destino** retorna todos.
- **R10 — Geolocalización.** `latitud`/`longitud` opcionales, `Decimal(10,7)`, para graficar.

---

## 6. Contratos API (Fastify, prefijo `/api/config`)

> Auth + acceso por perfil al ítem del mantenedor (`LECTURA` lectura / `TOTAL` escritura). Patrón **CRUD genérico** por mantenedor en `/{recurso}` (recurso en kebab/plural):
> `temporadas`, `paises`, `tipos-embarque`, `zonas`, `regiones`, `provincias`, `comunas`, `puertos`, `grupos-mercado`, `mercados`, `monedas`, `bodegas`, `tipos-parametro`, `parametros`, `especies`, `grupos-variedad`, `variedades`, `categorias`, `calibres`, `alturas`, `tipos-pallet`, `tipos-produccion`, `unidades-medida`, `tipos-cuenta-corriente`.

| Método | Ruta | Notas |
|---|---|---|
| GET | `/{recurso}` | Lista (filtra `eliminadoEn IS NULL`), `q?`, paginado. Acepta filtros de FK (ver abajo). |
| GET | `/{recurso}/:id` | Detalle. |
| POST | `/{recurso}` | Crea (valida R2 + reglas especiales). |
| PATCH | `/{recurso}/:id` | Actualiza. |
| DELETE | `/{recurso}/:id` | Softdelete (valida R8). |

**Filtros de FK para selects en cascada** (query params):
- `/provincias?regionId=` · `/comunas?provinciaId=`
- `/mercados?grupoMercadoId=&paisId=`
- `/grupos-variedad?especieId=` · `/variedades?especieId=&grupoVariedadId=` · `/categorias?especieId=` · `/calibres?especieId=`
- `/parametros?tipoParametroId=`

**Endpoints especiales:**
- `GET /puertos?contexto=origen|destino` → aplica R9.
- `POST /monedas` y `PATCH /monedas/:id` → aplican R5.

---

## 7. Frontend (`fas-web/app/(app)/config/`)

- Sección de menú **Configuración** (visible según perfil), con las sub-entradas agrupadas según §4.4.
- **Pantalla genérica de mantenedor** reutilizable: tabla con búsqueda + alta/edición en dialog + acción eliminar (softdelete con confirmación). Recibe la definición de columnas/campos por configuración.
- Campos especiales por mantenedor:
  - Temporada: dos date pickers (inicio/término).
  - País: switch "Es país de origen".
  - Provincia/Comuna/Mercado/Variedad/Categoría/Calibre/Parámetro: selects dependientes (cascada).
  - Moneda: switch "Es moneda base" + input decimales.
  - Bodega: dirección, select Comuna, multiselect tipos, lat/long.
  - Puerto: select País, select Tipo de embarque, lat/long.

---

## 8. Criterios de aceptación (Given / When / Then)

- **CA1 (R1):** Al eliminar un registro, queda con `eliminadoEn` seteado y desaparece de los listados; sigue en BD.
- **CA2 (R2):** Crear un código que ya existe entre no eliminados → 422. Tras eliminar ese registro, el mismo código puede reutilizarse.
- **CA3 (R3):** Crear/editar/eliminar registran el par de auditoría correspondiente con el userId actual.
- **CA4 (R4):** Crear una temporada cuyo rango solapa una existente → 422.
- **CA5 (R5):** Al marcar una moneda como base, cualquier otra base previa queda desmarcada; nunca quedan dos ni cero.
- **CA6 (R6):** Dos categorías de la misma especie con el mismo `orden` → 422; mismo `orden` en otra especie → OK.
- **CA7 (R7):** Dos calibres de la misma especie con el mismo `orden` → 422.
- **CA8 (R8):** Eliminar una Especie con variedades no eliminadas → 409.
- **CA9 (R9):** `GET /puertos?contexto=origen` retorna solo puertos de países con `esPaisOrigen=true`; `contexto=destino` retorna todos.
- **CA10 (cascada):** `GET /comunas?provinciaId=X` retorna solo comunas de esa provincia (no eliminadas).
- **CA11 (geo):** Bodega/Puerto persisten lat/long con precisión decimal y se exponen para graficar.

---

## 9. Plan de implementación (orden para Claude Code)

1. Schema Prisma de los 24 maestros (base + deltas + enum `TipoBodega`) + migración.
2. Migración SQL adicional: índices parciales únicos de `codigo` (y de `orden` por especie en Categoría/Calibre) `WHERE eliminado_en IS NULL`.
3. Service genérico base (CRUD + softdelete + auditoría + unicidad) parametrizable por modelo.
4. Reglas especiales: R4 (Temporada), R5 (Moneda), R6/R7 (orden), R8 (dependientes), R9 (Puertos).
5. Rutas `/api/config/{recurso}` + filtros de cascada + endpoint `puertos?contexto`.
6. Seed mínimo (al menos una Moneda base, regiones/comunas de Chile si se dispone del dataset).
7. Tests CA1–CA11.
8. Frontend: pantalla genérica de mantenedor + menú Configuración + campos especiales.

---

## 10. Definition of Done

- [ ] 24 maestros migrados con base común, softdelete y auditoría.
- [ ] Índices parciales únicos creados.
- [ ] CRUD genérico + reglas especiales R4–R9 implementadas.
- [ ] Filtros de cascada y `puertos?contexto` funcionando.
- [ ] Tests CA1–CA11 en verde.
- [ ] Menú Configuración (según perfil) con la pantalla genérica operativa.
- [ ] Schema incorporado al `CLAUDE.md` global.
