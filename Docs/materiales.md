# Módulo: Materiales — FAS (Frutera Agrosan Sistema)

> **Spec de módulo para desarrollo autónomo con Claude Code.**
> Extiende `CLAUDE.md` (contrato global del repo). No repite reglas globales; solo el slice vertical de este módulo.
>
> | | |
> |---|---|
> | **Etapa** | 1 — Operación core |
> | **Key user** | Bernardo (Materiales) |
> | **Backend** | `fas-api` · Fastify 5 + Prisma + PostgreSQL 17 |
> | **Frontend** | `fas-web` · Next.js 15 (App Router) + shadcn/ui |
> | **Depende de** | Compras (`Proveedor`), Gestión Productores, Ventas (`Cliente`), Auth |
> | **Alimenta a** | Finanzas/Costos, Liquidaciones |
> | **Reutilizable por** | Módulo Fruta (mantenedor de tipos de movimiento es transversal) |
> | **Estado** | Listo para desarrollo (decisiones cerradas con default) |

---

## 0. Contexto para Claude Code

El módulo de Materiales administra el **maestro de artículos** de embalaje (embalajes, envases, materiales de embalaje y servicios), sus **recetas** de producción, el **registro de movimientos** (entradas/salidas/traslados) sobre un **mantenedor dinámico de tipos de movimiento**, y un **analizador de stock por receta**. El consumo valorizado alimenta la matriz de costos y la liquidación al productor.

Código backend en `fas-api/src/modules/materiales/`, frontend en `fas-web/app/(app)/materiales/`. Capas: `schema (zod) → repository → service → routes (Fastify plugin)`.

---

## 1. Objetivo

Permitir a Bernardo: (a) mantener el catálogo de artículos con su costeo y stock crítico, (b) definir recetas por embalaje, (c) registrar movimientos de stock con tipos configurables, y (d) consultar, dada una producción de embalajes, si hay stock de los componentes por bodega, con estados accionables.

---

## 2. Alcance

**Construye (4 sub-módulos):**

1. **Maestro de artículos** — CRUD con tipo, costeo, stock crítico y documentos adjuntos.
2. **Maestro de recetas** — recetas por embalaje con detalle de componentes consumidos.
3. **Movimientos** — mantenedor de tipos de movimiento + formulario de registro de entradas/salidas/traslados.
4. **Consulta de stock por receta** — analizador con estados OK / Stock Crítico / Sin Stock / Trasladar.

**NO construye (fuera de alcance):**
- Emisión real del DTE (se capturan datos y flag; la emisión va por el adaptador genérico de DTE — proyecto/servicio aparte).
- Lectura por IA de guías/facturas (Etapa 2).
- Edición o borrado de movimientos (ver R1).
- Generación automática de OC por reorden.

---

## 3. Decisiones cerradas (defaults — modificar aquí si cambia el criterio)

| # | Decisión | Default adoptado |
|---|---|---|
| D1 | Tipos de artículo | `EMBALAJE`, `ENVASE`, `MATERIAL_EMBALAJE`, `SERVICIO`. |
| D2 | Costeo y stock | `ESTANDAR` ⇒ exige `valorEstandar` y **no controla stock**. `PROMEDIO_PONDERADO` ⇒ controla stock con PMP móvil. |
| D3 | Servicios | `SERVICIO` es siempre `ESTANDAR` (no controla stock). |
| D4 | Componentes de receta | Solo `MATERIAL_EMBALAJE` y `SERVICIO`. (Envase no se incluye por ahora.) |
| D5 | Demanda de componente | `cantidadAConsumir × (cantidadProducir / receta.cantidadAProducir)` (admite decimales). |
| D6 | Multi-bodega | `Bodega` es canónica en Configuración (mantenedores-generales.md); Materiales solo la referencia. Seed inicial bodega `PRINCIPAL`. |
| D7 | Stock crítico (motivo CRITICO) | Se evalúa sobre el **stock total** (suma de todas las bodegas) tras descontar la demanda. |
| D8 | DTE | Tipo de movimiento marca `emiteDTE`; el formulario captura datos de transporte; emisión real vía adaptador (fuera de alcance). |
| D9 | Entidad relacionada | FK a `Entidad` (entidades.md). La función exigida se expresa con `TipoEntidad?` y se valida contra `Entidad.tipos`. |
| D10 | Documentos adjuntos | Se guarda metadata + ruta en storage; backend de storage (local/S3) se define en infra. |
| D11 | Tipo de movimiento | Es transversal: un tipo declara a qué `modulos` aplica (`MATERIALES`, `FRUTA`). |

---

## 4. Modelo de datos (Prisma)

```prisma
enum TipoArticulo {
  EMBALAJE
  ENVASE
  MATERIAL_EMBALAJE
  SERVICIO
}

// UnidadMedida y Bodega se definen en Configuración (mantenedores-generales.md).
// Aquí solo se referencian por FK (Int).

enum TipoCosteo {
  PROMEDIO_PONDERADO
  ESTANDAR
}

enum ModuloSistema {
  MATERIALES
  FRUTA
}

enum ClaseMovimiento {
  ENTRADA
  SALIDA
  TRASLADO
}

// EntidadRelacionada queda obsoleto: se usa TipoEntidad (entidades.md).
// La función esperada por un tipo de movimiento se expresa como TipoEntidad? (null = no exige entidad).

model Articulo {
  id                    Int        @id @default(autoincrement())
  tipo                  TipoArticulo
  codigo                String        @unique
  descripcion           String
  descripcionExtranjera String?
  unidadId              Int                                // FK a UnidadMedida (Configuración)
  unidad                UnidadMedida  @relation(fields: [unidadId], references: [id])
  tipoCosteo            TipoCosteo
  valorEstandar         Decimal?      @db.Decimal(14, 4) // requerido si ESTANDAR (R3)
  controlaStock         Boolean       @default(true)     // false si ESTANDAR (R3)
  stockCritico          Decimal?      @db.Decimal(14, 3)
  activo                Boolean       @default(true)

  documentos            DocumentoArticulo[]
  recetas               Receta[]            @relation("EmbalajeRecetas")
  comoComponente        RecetaDetalle[]     @relation("ComponenteRecetas")
  saldos                SaldoArticulo[]
  movimientosDetalle    MovimientoDetalle[]

  creadoEn              DateTime      @default(now())
  actualizadoEn         DateTime      @updatedAt

  @@index([tipo])
  @@index([activo])
}

model DocumentoArticulo {
  id          Int   @id @default(autoincrement())
  articuloId  Int
  articulo    Articulo @relation(fields: [articuloId], references: [id])
  nombre      String
  ruta        String                       // ruta/URL en storage
  mimeType    String?
  tamanoBytes Int?
  subidoPor   String
  creadoEn    DateTime @default(now())

  @@index([articuloId])
}

model Receta {
  id                Int          @id @default(autoincrement())
  embalajeId        Int                                   // FK a Articulo tipo EMBALAJE (R13)
  embalaje          Articulo        @relation("EmbalajeRecetas", fields: [embalajeId], references: [id])
  codigo            String          @unique
  descripcion       String
  cantidadAProducir Decimal         @db.Decimal(14, 3)
  activo            Boolean         @default(true)

  detalle           RecetaDetalle[]

  creadoEn          DateTime        @default(now())
  actualizadoEn     DateTime        @updatedAt

  @@index([embalajeId])
}

model RecetaDetalle {
  id                Int   @id @default(autoincrement())
  recetaId          Int
  receta            Receta   @relation(fields: [recetaId], references: [id], onDelete: Cascade)
  componenteId      Int                                   // FK a Articulo MATERIAL_EMBALAJE o SERVICIO (R13)
  componente        Articulo @relation("ComponenteRecetas", fields: [componenteId], references: [id])
  cantidadAConsumir Decimal  @db.Decimal(14, 4)              // admite decimales

  @@index([recetaId])
}

model TipoMovimiento {
  id                 Int              @id @default(autoincrement())
  codigo             String              @unique
  descripcion        String
  modulos            ModuloSistema[]                          // a qué módulos aplica (R14)
  clase              ClaseMovimiento
  requierePrecio     Boolean             @default(false)
  entidadRelacionada TipoEntidad?                            // función exigida; null = no exige entidad (entidades.md)
  emiteDTE           Boolean             @default(false)
  activo             Boolean             @default(true)

  movimientos        Movimiento[]

  creadoEn           DateTime            @default(now())

  @@index([clase])
}

// Bodega es CANÓNICA en Configuración (mantenedores-generales.md). No se redefine aquí.
// Estas back-relations de Materiales se agregan al modelo Bodega de Configuración:
//   saldos     SaldoArticulo[]
//   movOrigen  Movimiento[]   @relation("MovOrigen")
//   movDestino Movimiento[]   @relation("MovDestino")
// Bodega.id es Int → las FKs de abajo son Int.

model SaldoArticulo {
  id            Int   @id @default(autoincrement())
  articuloId    Int
  articulo      Articulo @relation(fields: [articuloId], references: [id])
  bodegaId      Int
  bodega        Bodega   @relation(fields: [bodegaId], references: [id])
  cantidad      Decimal  @db.Decimal(14, 3) @default(0)
  costoPromedio Decimal  @db.Decimal(14, 4) @default(0)      // PMP vigente
  actualizadoEn DateTime @updatedAt

  @@unique([articuloId, bodegaId])
  @@index([articuloId])
}

model Movimiento {
  id                  Int              @id @default(autoincrement())
  tipoMovimientoId    Int
  tipoMovimiento      TipoMovimiento      @relation(fields: [tipoMovimientoId], references: [id])
  entidadId           Int?                                     // FK a Entidad (entidades.md); su función se valida contra tipos
  entidad             Entidad?            @relation("MovEntidad", fields: [entidadId], references: [id])
  fechaRegistro       DateTime            @default(now())
  fechaMovimiento     DateTime
  bodegaOrigenId      Int?
  bodegaOrigen        Bodega?             @relation("MovOrigen", fields: [bodegaOrigenId], references: [id])
  bodegaDestinoId     Int?
  bodegaDestino       Bodega?             @relation("MovDestino", fields: [bodegaDestinoId], references: [id])
  guiaReferencia      String?

  // Datos de transporte — requeridos si tipoMovimiento.emiteDTE = true (R10)
  transporteEntidadId Int?                                     // FK a Entidad con tipo EMPRESA_TRANSPORTE
  transporteEntidad   Entidad?            @relation("MovTransporte", fields: [transporteEntidadId], references: [id])
  choferRut           String?
  choferNombre        String?
  placaCamion         String?
  placaRemolque       String?
  horaSalida          DateTime?
  horaEstimadaLlegada DateTime?

  detalle             MovimientoDetalle[]
  usuarioId           String
  creadoEn            DateTime            @default(now())

  @@index([tipoMovimientoId])
  @@index([fechaMovimiento])
}

model MovimientoDetalle {
  id             Int     @id @default(autoincrement())
  movimientoId   Int
  movimiento     Movimiento @relation(fields: [movimientoId], references: [id], onDelete: Cascade)
  articuloId     Int
  articulo       Articulo   @relation(fields: [articuloId], references: [id])
  cantidad       Decimal    @db.Decimal(14, 3)
  precioUnitario Decimal?   @db.Decimal(14, 4)               // requerido si tipoMovimiento.requierePrecio (R9)

  @@index([movimientoId])
  @@index([articuloId])
}
```

---

### 4.8 Proforma de Venta de Materiales

Venta de materiales a terceros. Se genera aquí y se **valida/emite** en el módulo de Ventas Nacionales de `cobranza.md`. Al confirmarse, se emite la factura y se **descuenta stock automáticamente** (R16).

```prisma
enum EstadoProformaMaterial {
  BORRADOR
  ENVIADA_VALIDACION
  FACTURADA
  ANULADA
}

model ProformaMaterial {
  id                Int                      @id @default(autoincrement())
  numero            Int                      @unique
  entidadId         Int                                              // Entidad tipo CLIENTE_NACIONAL (R17)
  entidad           Entidad                  @relation("ProformasMaterial", fields: [entidadId], references: [id])
  bodegaId          Int                                              // bodega de salida del stock (R16)
  bodega            Bodega                   @relation(fields: [bodegaId], references: [id])
  fecha             DateTime                 @default(now())
  moneda            String
  montoTotal        Decimal                  @db.Decimal(14, 2)
  estado            EstadoProformaMaterial   @default(BORRADOR)
  facturaNacionalId Int?                                             // FacturaNacional (cobranza.md)
  movimientoId      Int?                                             // Movimiento SALIDA generado al facturar (R16)

  detalle           ProformaMaterialDetalle[]

  creadoPorId       String
  creadoEn          DateTime                 @default(now())
  actualizadoEn     DateTime?                @updatedAt

  @@index([entidadId])
  @@index([estado])
}

model ProformaMaterialDetalle {
  id             Int              @id @default(autoincrement())
  proformaId     Int
  proforma       ProformaMaterial @relation(fields: [proformaId], references: [id], onDelete: Cascade)
  articuloId     Int
  articulo       Articulo         @relation(fields: [articuloId], references: [id])
  cantidad       Decimal          @db.Decimal(14, 3)
  precioUnitario Decimal          @db.Decimal(14, 4)
  monto          Decimal          @db.Decimal(14, 2)

  @@index([proformaId])
  @@index([articuloId])
}
```

> Back-relations a agregar: `Entidad` → `proformasMaterial`; `Bodega` → `proformasMaterial`; `Articulo` → `lineasProforma`.

---

## 5. Reglas de negocio / invariantes

- **R1 — Movimientos inmutables.** No se editan ni borran; se corrige con un movimiento inverso.
- **R2 — Saldo no negativo.** `SALIDA`/`TRASLADO` no pueden dejar el saldo de la bodega de origen bajo cero → 422.
- **R3 — Costeo y stock.** `ESTANDAR` ⇒ `valorEstandar` requerido y `controlaStock = false`. `PROMEDIO_PONDERADO` ⇒ `controlaStock = true`.
- **R4 — Servicio sin stock.** `SERVICIO` debe ser `ESTANDAR`; no controla stock.
- **R5 — PMP en entrada.** En `ENTRADA` de artículo que controla stock con `requierePrecio`, `precioUnitario` es obligatorio y recalcula `costoPromedio` de (artículo, bodegaDestino): `nuevoPMP = (qSaldo*pmp + qEntrada*precio) / (qSaldo + qEntrada)`.
- **R6 — Valorización de salida.** `SALIDA` se valoriza al `costoPromedio` vigente; no lo modifica. En `TRASLADO`, el PMP viaja con la cantidad al destino.
- **R7 — Saldo derivado y transaccional.** `SaldoArticulo` se actualiza solo como efecto de movimientos, dentro de una transacción Prisma. Nunca edición directa.
- **R8 — Sin control de stock.** Artículos con `controlaStock = false` no generan saldos ni se validan por stock.
- **R9 — Requiere precio.** Si `tipoMovimiento.requierePrecio`, cada línea exige `precioUnitario`.
- **R10 — Emite DTE.** Si `tipoMovimiento.emiteDTE`, el movimiento exige los datos de transporte (empresa, chofer RUT/nombre, placas, horas).
- **R11 — Clase y bodegas.** `ENTRADA` exige `bodegaDestino`; `SALIDA` exige `bodegaOrigen`; `TRASLADO` exige ambas y genera el doble efecto (−origen, +destino) en una transacción.
- **R12 — Entidad relacionada.** Si `tipoMovimiento.entidadRelacionada` no es null, el movimiento exige una `Entidad` cuyos `tipos` incluyan esa función → 422 si falta o no corresponde.
- **R13 — Recetas.** Cabecera solo para artículos `EMBALAJE`; detalle solo de `MATERIAL_EMBALAJE` o `SERVICIO`.
- **R14 — Módulos del tipo.** Un `TipoMovimiento` solo puede usarse en módulos que declara en `modulos` (aquí `MATERIALES`).

### R15 — Estado de línea en la consulta de stock por receta

Para cada **componente** (expandido desde las recetas de los embalajes seleccionados y sus cantidades):

```
demanda     = Σ ( detalle.cantidadAConsumir × cantidadProducir / receta.cantidadAProducir )   // por componente
stockTotal  = Σ saldo.cantidad sobre TODAS las bodegas
stockSel    = (filtro de bodegas no vacío) ? Σ saldo.cantidad sobre bodegas seleccionadas : stockTotal
critico     = articulo.stockCritico ?? 0

if !articulo.controlaStock:            estado = NA            // servicios / estándar: no se evalúa
else if stockTotal < demanda:          estado = DANGER  motivos = ["Sin Stock"]
else:
    motivos = []
    if (stockTotal - demanda) < critico:                 motivos.push("Stock Crítico")   // D7, sobre total
    if filtroBodegas no vacío && stockSel < demanda:     motivos.push("Trasladar")        // total cubre, selección no
    estado = motivos.length ? WARNING : OK
```

- La respuesta **siempre** muestra el stock desglosado por **cada** bodega (todas), aunque haya filtro.
- El filtro de bodegas solo afecta el motivo "Trasladar", no qué bodegas se muestran.
- Una línea puede tener `WARNING` con ambos motivos (`["Stock Crítico", "Trasladar"]`).

---

### R16 — Emisión de factura descuenta stock

Al **confirmarse** la proforma en el módulo de validación (`cobranza.md`), el sistema emite la `FacturaNacional` y genera automáticamente un `Movimiento` de clase `SALIDA` desde `ProformaMaterial.bodegaId`, con una línea de `MovimientoDetalle` por cada línea de la proforma. Se aplican las reglas existentes: **R1** (el movimiento es inmutable) y **R2** (el saldo de la bodega no puede quedar negativo → la confirmación **falla con 422** si no hay stock suficiente).

En estado `BORRADOR` / `ENVIADA_VALIDACION` la proforma **no** afecta el stock.

### R17 — Cliente nacional

`ProformaMaterial.entidadId` debe ser una entidad con `CLIENTE_NACIONAL` en `tipos` (`entidades.md` R8) → 422. Un productor al que se le venden materiales debe estar marcado además como `CLIENTE_NACIONAL`.

### R18 — Edición

La proforma solo se edita en `BORRADOR`. Una vez `FACTURADA`, se corrige anulando la factura y su movimiento con un movimiento inverso (R1).

---

## 6. Contratos API (Fastify, prefijo `/api/materiales`)

> Auth (Better Auth) + acceso por perfil al ítem de menú de Materiales (`LECTURA` lectura / `TOTAL` escritura). Validación con zod.

**Artículos**
| Método | Ruta | Notas |
|---|---|---|
| GET | `/articulos` | filtros `tipo?`, `q?`, `activo?`, paginado |
| GET | `/articulos/:id` | incluye saldos por bodega |
| POST | `/articulos` | valida R3/R4 |
| PATCH | `/articulos/:id` | no toca stock |
| GET | `/articulos/:id/documentos` | listar adjuntos |
| POST | `/articulos/:id/documentos` | subir adjunto (metadata + ruta) |
| DELETE | `/articulos/:id/documentos/:docId` | eliminar adjunto |

**Recetas**
| Método | Ruta | Notas |
|---|---|---|
| GET | `/articulos/:id/recetas` | recetas del embalaje |
| POST | `/recetas` | `{ embalajeId, codigo, descripcion, cantidadAProducir, detalle:[{componenteId, cantidadAConsumir}] }` (R13) |
| GET | `/recetas/:id` | cabecera + detalle |
| PATCH | `/recetas/:id` | edita cabecera/detalle |

**Tipos de movimiento (mantenedor)**
| Método | Ruta | Notas |
|---|---|---|
| GET | `/tipos-movimiento` | filtro `modulo?`, `clase?` |
| POST | `/tipos-movimiento` | `{ codigo, descripcion, modulos[], clase, requierePrecio, entidadRelacionada, emiteDTE }` |
| PATCH | `/tipos-movimiento/:id` | |

**Movimientos**
| Método | Ruta | Notas |
|---|---|---|
| GET | `/movimientos` | filtros tipo, fecha, bodega, paginado |
| GET | `/movimientos/:id` | cabecera + detalle |
| POST | `/movimientos` | header + detalle, transacción, actualiza saldos. Valida R2/R5/R9/R10/R11/R12/R14 |

**Saldos / Consulta**
| Método | Ruta | Notas |
|---|---|---|
| GET | `/saldos` | filtros `bodegaId?`, `tipo?`, `bajoCritico?` (Bodegas se listan en `/api/config/bodegas`) |
| POST | `/consulta-stock-receta` | body: `{ embalajes:[{articuloId, cantidad}], bodegaIds:[] }` → componentes con stock por bodega y `estado`/`motivos` (R15) |

---

**Proformas de venta de materiales**
| Método | Ruta | Notas |
|---|---|---|
| GET/POST/PATCH | `/proformas[/:id]` | Detalle por artículo. Editable solo en `BORRADOR` (R18). Valida `CLIENTE_NACIONAL` (R17). |
| POST | `/proformas/:id/enviar-validacion` | Pasa a `ENVIADA_VALIDACION`; queda visible en el confirmador de `cobranza.md`. |

> La **emisión** de la factura (DTE 33/34) y la confirmación ocurren en `cobranza.md` (Ventas Nacionales); el descuento de stock se dispara desde allí (R16).

---

## 7. Frontend (Next.js 15, `fas-web/app/(app)/materiales/`)

| Ruta | Pantalla | Contenido |
|---|---|---|
| `/articulos` | Maestro de artículos | Tabla con filtro por tipo/estado, búsqueda. Alta/edición: tipo, código, descripción, descripción extranjera, unidad, **tipo de costeo** (al elegir `ESTANDAR` muestra campo valor y oculta control de stock), **stock crítico**, adjuntar documentos. |
| `/articulos/[id]` | Detalle | Datos, saldos por bodega, recetas (si es embalaje), documentos. |
| `/articulos/[id]/recetas` | Recetas del embalaje | Cabecera (código, descripción, cantidad a producir) + grilla de detalle (componente, cantidad a consumir decimal). |
| `/tipos-movimiento` | Mantenedor de tipos | Código, descripción, módulos (multiselect), clase, requiere precio, entidad relacionada, emite DTE. |
| `/movimientos` | **Materiales y envases** | Form: tipo de movimiento, entidad, fecha registro, fecha movimiento, bodega origen, bodega destino, guía/referencia + grilla de artículos (cantidad y precio si aplica). **Bloque DTE** condicional (visible si el tipo `emiteDTE`): empresa de transporte, RUT y nombre chofer, placa camión y remolque, hora salida y hora estimada de llegada. |
| `/consulta-stock-receta` | Analizador de stock | Multiselect de embalajes + cantidad c/u, multiselect de bodegas. Resultado: por componente, stock en **cada** bodega + badge de estado: `OK` (verde), `Stock Crítico` (amarillo), `Sin Stock` (rojo), `Trasladar` (amarillo). |

UI con shadcn/ui. Los campos condicionales (valor estándar, bloque DTE) se muestran/ocultan según selección.

---

## 8. Criterios de aceptación (Given / When / Then)

- **CA1 (R3):** Al crear artículo `ESTANDAR` sin `valorEstandar` → 422; al guardarlo, `controlaStock = false`.
- **CA2 (R4):** Al crear `SERVICIO` con costeo `PROMEDIO_PONDERADO` → 422.
- **CA3 (R5):** Saldo 10 a PMP 100; `ENTRADA` de 10 a precio 200 → saldo 20, PMP 150.
- **CA4 (R6):** Saldo 20 a PMP 150; `SALIDA` de 5 → saldo 15, PMP 150, consumo valorizado 750.
- **CA5 (R2):** Saldo 100; `SALIDA` de 120 → 422, saldo intacto.
- **CA6 (R9):** Tipo con `requierePrecio=true`; línea sin `precioUnitario` → 422.
- **CA7 (R10):** Tipo con `emiteDTE=true` sin datos de transporte → 422.
- **CA8 (R11):** `TRASLADO` mueve 10 de B1 a B2 → B1 −10, B2 +10, en una transacción.
- **CA9 (R13):** Receta con componente tipo `ENVASE` → 422; cabecera sobre artículo no `EMBALAJE` → 422.
- **CA10 (R14):** Movimiento de Materiales con tipo cuyo `modulos` no incluye `MATERIALES` → 422.
- **CA11 (R15-demanda):** Embalaje E con receta (producir 100; componente C consume 50). Consulta con cantidad 200 → demanda de C = 100.
- **CA12 (R15-OK):** Demanda 100, stockTotal 500, crítico 50, sin filtro → `OK`.
- **CA13 (R15-Crítico):** Demanda 100, stockTotal 120, crítico 40, sin filtro → `WARNING ["Stock Crítico"]` (120−100=20<40).
- **CA14 (R15-Sin Stock):** Demanda 100, stockTotal 80 → `DANGER ["Sin Stock"]`.
- **CA15 (R15-Trasladar):** Demanda 100, crítico 10, filtro [B1] con stock B1=60, total B1+B2=150 → `WARNING ["Trasladar"]`.
- **CA16 (R15-ambos):** Demanda 100, crítico 40, filtro [B1] con B1=60, total=120 → `WARNING ["Stock Crítico","Trasladar"]`.
- **CA17 (R15-desglose):** La respuesta lista el stock de C en TODAS las bodegas, aunque el filtro sea [B1].
- **CA18 (R15-NA):** Componente `SERVICIO` → estado `NA` (no se evalúa stock).
- **CA19 (R7):** Si falla la actualización de saldo, el movimiento hace rollback completo.

---

## 9. Plan de implementación (orden para Claude Code)

1. Schema Prisma + migración + seed (bodega `PRINCIPAL`, tipos de movimiento base de ejemplo).
2. Capa `schema (zod)`.
3. Maestro de artículos (repo + service R3/R4 + routes + documentos).
4. Recetas (repo + service R13 + routes).
5. Mantenedor de tipos de movimiento (repo + routes).
6. Movimientos: `POST /movimientos` transaccional con PMP y validaciones R2/R5/R6/R9/R10/R11/R12/R14.
7. `/saldos` y `POST /consulta-stock-receta` (lógica R15).
8. Tests CA1–CA19.
9. Frontend: artículos → recetas → tipos de movimiento → movimientos (form + bloque DTE) → consulta de stock.

---

## 10. Definition of Done

- [ ] Migración aplicada + seed.
- [ ] Endpoints de §6 implementados y validados con zod.
- [ ] Invariantes R1–R15 garantizadas por el service.
- [ ] Tests CA1–CA19 en verde.
- [ ] Pantallas de §7 navegables, con campos condicionales (valor estándar, bloque DTE) y badges de estado en la consulta.
- [ ] Schema incorporado al `CLAUDE.md` global.
