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
3. **Movimientos** — mantenedor de tipos de movimiento + pantalla completa de Movimiento (cabecera `BORRADOR` con líneas editables/agregables/eliminables + acción explícita "Confirmar", ver R1 reescrita 2026-08-29).
4. **Consulta de stock por receta** — analizador con estados OK / Stock Crítico / Sin Stock / Trasladar.

**NO construye (fuera de alcance):**
- Emisión real de la Guía de Despacho como DTE ante el SII (timbre PDF417, folio CAF) — se genera un PDF interno equivalente vía el Motor de Documentos (`documentos.md`/Etapa 4), marcado explícitamente como no válido tributariamente; la emisión real va por un proveedor DTE — proyecto/servicio aparte, no iniciado (`Docs/agrosan_etapa4_motor_documentos.md` §7).
- Lectura por IA de guías/facturas (Etapa 2).
- Edición o borrado de un movimiento ya `CONFIRMADO` (ver R1) — mientras está `BORRADOR` sí se edita/borra libremente.
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

  // BORRADOR: cabecera + líneas editables, sin efecto en SaldoArticulo.
  // CONFIRMADO: el motor de PMP/saldo ya se aplicó — inmutable (R1, reescrita 2026-08-29).
  estado              EstadoMovimiento    @default(BORRADOR)

  detalle             MovimientoDetalle[]
  usuarioId           String
  creadoEn            DateTime            @default(now())

  eliminadoEn         DateTime?           // soft delete — solo aplica a un BORRADOR
  eliminadoPor        String?

  @@index([tipoMovimientoId])
  @@index([fechaMovimiento])
  @@index([estado])
}

enum EstadoMovimiento {
  BORRADOR
  CONFIRMADO
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

### 4.9 OrdenCompraMaterial (Orden de Compra de Materiales) **(nuevo, 2026-09-03)**

Compromiso comercial de compra de materiales/insumos a un **proveedor**, previo al ingreso físico a stock. Mismo patrón que `OrdenCompra` de fruta (`compras.md` §4.2) — cabecera con condición de pago (cuotas snapshot) + líneas con cantidades y valores — pero simplificado: sin especie/variedad/categoría/calibre/pallet (eso es exclusivo de fruta), sin Solicitud de Inspección, sin Cierre Comercial.

> **Reconciliación con Materiales.** Hoy Materiales solo permite ingresar stock vía `Movimiento` directo (ENTRADA con `entidadRelacionada = PROVEEDOR` y `precioUnitario`, R9/R12) — sin ningún compromiso previo que autorizar. `OrdenCompraMaterial` agrega esa capa: primero se negocia/emite la OC (proveedor, artículos, cantidades, precios, condición de pago), y **después** el ingreso físico se registra con un `Movimiento` de clase `ENTRADA` que **referencia** la OC — mismo rol que cumple `Recepcion` para la OC de fruta, sin necesidad de un modelo `Recepcion`/`Pallet` propio (Materiales no tiene la noción de pallet indivisible).

```prisma
enum EstadoOrdenCompraMaterial {
  BORRADOR
  EMITIDA
  RECEPCIONADA
}

model OrdenCompraMaterial {
  id        Int    @id @default(autoincrement())
  numero    String // OCM-{AAAA}-{NNNN}, correlativo por año (mismo mecanismo que OrdenCompra — lock advisory propio, ver R23)

  entidadProveedorId Int      // FK -> Entidad tipo PROVEEDOR (R19)
  entidad            Entidad  @relation("OrdenCompraMaterialProveedor", fields: [entidadProveedorId], references: [id])

  fecha DateTime @default(now())

  formaPagoId     Int?
  formaPago       FormaPago?     @relation(fields: [formaPagoId], references: [id])
  condicionPagoId Int?           // CondicionPago tipo=COMPRA (mismo mantenedor que OrdenCompra de fruta — R21)
  condicionPago   CondicionPago? @relation(fields: [condicionPagoId], references: [id])
  monedaId        Int
  moneda          Moneda         @relation(fields: [monedaId], references: [id])

  observaciones String?
  estado        EstadoOrdenCompraMaterial @default(BORRADOR)

  lineas     OrdenCompraMaterialLinea[]
  cuotasPago OrdenCompraMaterialCuotaPago[]
  // Igual que OrdenCompra↔Recepcion (compras.md §4.7): array porque Prisma
  // exige @unique en la FK para 1:1, pero la unicidad real ("a lo más un
  // Movimiento CONFIRMADO por OC") es un índice parcial WHERE eliminadoEn IS
  // NULL sobre Movimiento.ordenCompraMaterialId (no representable en el DSL
  // de Prisma — mismo patrón ya usado en el schema, ver migración).
  movimientos Movimiento[]

  creadoEn       DateTime  @default(now())
  creadoPor      String
  actualizadoEn  DateTime? @updatedAt
  actualizadoPor String?
  eliminadoEn    DateTime?
  eliminadoPor   String?

  @@index([entidadProveedorId])
  @@index([condicionPagoId])
  @@map("ordenes_compra_material")
}

model OrdenCompraMaterialLinea {
  id                     Int                  @id @default(autoincrement())
  ordenCompraMaterialId  Int
  ordenCompraMaterial    OrdenCompraMaterial  @relation(fields: [ordenCompraMaterialId], references: [id], onDelete: Cascade)

  articuloId     Int
  articulo       Articulo @relation(fields: [articuloId], references: [id])
  cantidad       Decimal  @db.Decimal(14, 3)   // mismo tipo/precisión que MovimientoDetalle.cantidad
  precioUnitario Decimal  @db.Decimal(14, 4)   // mismo tipo/precisión que MovimientoDetalle.precioUnitario
  monto          Decimal  @db.Decimal(14, 2)   // cantidad × precioUnitario, calculado server-side al guardar

  @@index([ordenCompraMaterialId])
  @@index([articuloId])
  @@map("orden_compra_material_linea")
}

// Snapshot inmutable de las cuotas al fijar condicionPagoId — mismo patrón
// que OrdenCompraCuotaPago (compras.md §4.2.2), sin la variante MONTO_UNITARIO
// (R21: no aplica a Materiales).
model OrdenCompraMaterialCuotaPago {
  id                    Int                 @id @default(autoincrement())
  ordenCompraMaterialId Int
  ordenCompraMaterial   OrdenCompraMaterial @relation(fields: [ordenCompraMaterialId], references: [id], onDelete: Cascade)

  fechaReferencia FechaReferenciaPago @default(FACTURA) // enum ya definido en compras.md §4.2.1
  plazoDias       Int
  porcentaje      Decimal             @db.Decimal(5, 2)
  descripcion     String?

  @@index([ordenCompraMaterialId])
  @@map("orden_compra_material_cuota_pago")
}
```

> Back-relations a agregar: `Entidad` → `ordenesCompraMaterialProveedor`; `FormaPago` → `ordenesCompraMaterial`; `CondicionPago` → `ordenesCompraMaterial`; `Moneda` → `ordenesCompraMaterial`; `Articulo` → `lineasOrdenCompraMaterial`.

**`Movimiento` gana un campo nuevo** (materiales.md §4, `model Movimiento`):
```prisma
  ordenCompraMaterialId Int?
  ordenCompraMaterial   OrdenCompraMaterial? @relation(fields: [ordenCompraMaterialId], references: [id])
```
Solo aplicable a movimientos `clase = ENTRADA`. Ver R22.

---

## 5. Reglas de negocio / invariantes

- **R1 — Estado del movimiento (reescrita 2026-08-29, supersede la versión anterior).** Un `Movimiento` nace `BORRADOR`: cabecera y líneas (`MovimientoDetalle`) se editan, agregan y eliminan libremente, **sin efecto en `SaldoArticulo` todavía**. `tipoMovimientoId` queda fijo desde la creación (define bodegas/entidad/DTE de todo el movimiento) — si se eligió mal, se borra el borrador y se crea uno nuevo. La acción explícita `POST /movimientos/:id/confirmar` revalida todas las reglas (R2/R9/R10/R11/R12/R14) contra el estado persistido y recién ahí aplica el motor de PMP/saldo (antes disparado al crear) dentro de una transacción, dejando el movimiento `CONFIRMADO`. Un `CONFIRMADO` es inmutable — no se edita ni se borra, se corrige con un movimiento inverso.
- **R2 — Saldo no negativo.** `SALIDA`/`TRASLADO` no pueden dejar el saldo de la bodega de origen bajo cero → 422.
- **R3 — Costeo y stock.** `ESTANDAR` ⇒ `valorEstandar` requerido y `controlaStock = false`. `PROMEDIO_PONDERADO` ⇒ `controlaStock = true`.
- **R4 — Servicio sin stock.** `SERVICIO` debe ser `ESTANDAR`; no controla stock.
- **R5 — PMP en entrada.** En `ENTRADA` de artículo que controla stock con `requierePrecio`, `precioUnitario` es obligatorio y recalcula `costoPromedio` de (artículo, bodegaDestino): `nuevoPMP = (qSaldo*pmp + qEntrada*precio) / (qSaldo + qEntrada)`.
- **R6 — Valorización de salida.** `SALIDA` se valoriza al `costoPromedio` vigente; no lo modifica. En `TRASLADO`, el PMP viaja con la cantidad al destino.
- **R7 — Saldo derivado y transaccional.** `SaldoArticulo` se actualiza solo como efecto de movimientos, dentro de una transacción Prisma. Nunca edición directa.
- **R8 — Sin control de stock.** Artículos con `controlaStock = false` no generan saldos ni se validan por stock.
- **R9 — Requiere precio.** Si `tipoMovimiento.requierePrecio`, cada línea exige `precioUnitario`.
- **R10 — Emite DTE.** Si `tipoMovimiento.emiteDTE`, el movimiento exige empresa de transporte, RUT y nombre del chofer, **placa del camión** y **hora de salida**. Placa del remolque y hora estimada de llegada quedan opcionales (no todo transporte tiene remolque o ETA conocida) — decisión de implementación M5, `Docs/Hallazgos/materiales.md`. *(Redacción aclarada 2026-08-29, QA ronda 1 MOV-004: la versión anterior, "placas, horas" en plural, sugería ambigüamente que ambas placas/horas eran obligatorias.)*
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

### R19 — Entidad Proveedor (OrdenCompraMaterial)

`entidadProveedorId` debe ser una `Entidad` con `PROVEEDOR` en `tipos` (`entidades.md` R8) → 422 si no corresponde o está inactiva.

### R20 — Estado y edición (OrdenCompraMaterial)

Nace `BORRADOR`: cabecera y líneas editables/eliminables libremente. La acción explícita pasa la OC a `EMITIDA` — **bloquea edición de cabecera y líneas** (a diferencia de la OC de fruta, que sigue editable hasta la Recepción — aquí se decidió bloquear antes, en `EMITIDA`, por ser el punto en que el compromiso se formaliza con el proveedor; decisión de negocio, 2026-09-03). Para corregir una OC `EMITIDA` sin Movimiento asociado: se anula (soft delete, `eliminadoEn`) y se crea una nueva — no hay estado `ANULADA` propio en v1. **Eliminar** (`DELETE /ordenes-compra/:id`) es más permisivo que editar: acepta `BORRADOR` **o** `EMITIDA` siempre que no tenga un Movimiento activo (`BORRADOR` o `CONFIRMADO`, no eliminado) vinculado → 422 si tiene uno. `RECEPCIONADA` nunca se puede eliminar.

### R21 — Condición de pago sin cuota por unidad

`OrdenCompraMaterial` reutiliza el mismo mantenedor `CondicionPago` (tipo `COMPRA`) que la OC de fruta, pero **solo acepta condiciones cuyas cuotas sean 100% `PORCENTAJE`** — la variante `MONTO_UNITARIO` (cargo por caja/kilo, `compras.md` §4.2.1) es específica del flujo de fruta y no generaliza a artículos con unidades de medida arbitrarias. Si `condicionPagoId` apunta a una `CondicionPago` con alguna cuota `MONTO_UNITARIO` → 422 al asignarla. Las cuotas se copian (snapshot) a `OrdenCompraMaterialCuotaPago` en el instante en que se fija `condicionPagoId`, igual que en la OC de fruta — cambios posteriores al maestro no afectan OCs ya creadas.

### R22 — Vínculo con Movimiento (ingreso a stock)

Un `Movimiento` clase `ENTRADA` puede referenciar una `OrdenCompraMaterial` vía `ordenCompraMaterialId` — solo si la OC está `EMITIDA` (no `BORRADOR` ni `RECEPCIONADA`) → 422 si no. Al **confirmar** ese Movimiento (`POST /movimientos/:id/confirmar`, R1):
- Cada línea del Movimiento (`articuloId`, `cantidad`) debe corresponder a una línea de la OC con el **mismo `articuloId`**, y `cantidad` no puede superar la `cantidad` de esa línea de OC → 422 si no calza (mismo espíritu que el motor de validación de Recepción en `compras.md` §7, sin el paso de advertencias — acá es bloqueo duro).
- `entidadId` del Movimiento, si viene informado, debe coincidir con `entidadProveedorId` de la OC → 422 si no. Si no viene informado, se **copia server-side** desde la OC al confirmar.
- Solo puede existir **un** Movimiento (`CONFIRMADO` o `BORRADOR` activo) por OC a la vez — índice parcial `WHERE eliminado_en IS NULL` sobre `Movimiento.ordenCompraMaterialId` (mismo patrón que `Recepcion.ordenCompraId`, `compras.md` §4.7) → 422 con mensaje explícito si ya existe uno, incluida la carrera concurrente (`P2002` traducido).
- **Sin recepción parcial (aclarado, ronda QA 1 — OCM-QA-003):** el Movimiento debe cubrir **todos** los artículos de la OC — se agrupan ambos conjuntos por `articuloId` (sumando cantidades si un artículo se repite en varias líneas) y se exige que cada `articuloId` de la OC esté presente en el Movimiento → 422 si falta alguno. La cantidad por artículo puede ser **menor o igual** a la de la OC (no tiene que ser exacta), pero ningún artículo puede omitirse por completo.
- Al confirmarse el Movimiento, la `OrdenCompraMaterial` pasa a `RECEPCIONADA` **en la misma transacción** — recepción parcial real (dejar la OC en un estado intermedio con saldo pendiente) queda para una iteración futura si el negocio lo requiere.
- Eliminar (soft delete) un Movimiento `BORRADOR` vinculado libera la OC para un nuevo intento (mismo patrón que `OrdenCompraSolicitudInspeccion`, `compras.md` §4.2).

### R23 — Numeración

`numero` se genera automáticamente al crear: `OCM-{AAAA}-{NNNN}`, correlativo por año (mismo mecanismo de `pg_advisory_xact_lock` que `OrdenCompra` de fruta — `compras.md` §4.2 — con un namespace de lock propio para no serializarse contra la numeración de OC de fruta).

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

**Movimientos** (R1 reescrita 2026-08-29 — cabecera primero, líneas después, confirmar al final; mismo patrón que `compras.md` Orden de Compra)
| Método | Ruta | Notas |
|---|---|---|
| GET | `/movimientos` | filtros tipo, **estado**, fecha, bodega, paginado |
| GET | `/movimientos/:id` | cabecera + detalle |
| POST | `/movimientos` | solo cabecera (`tipoMovimientoId`, `fechaMovimiento`) — nace `BORRADOR`, sin líneas. Valida R14 |
| PATCH | `/movimientos/:id` | edita cabecera (entidad, bodegas, guía, datos de transporte) — solo mientras `BORRADOR` |
| DELETE | `/movimientos/:id` | soft delete — solo mientras `BORRADOR` |
| POST | `/movimientos/:id/detalle` | agrega línea — solo mientras `BORRADOR`, sin efecto en saldo todavía |
| PATCH | `/movimientos/:id/detalle/:detalleId` | edita línea — solo mientras `BORRADOR` |
| DELETE | `/movimientos/:id/detalle/:detalleId` | elimina línea — solo mientras `BORRADOR` |
| POST | `/movimientos/:id/confirmar` | revalida R2/R9/R10/R11/R12/R14/R5/R6 contra lo persistido, aplica el motor de PMP/saldo en una transacción y pasa a `CONFIRMADO` (inmutable) |

> PDF y Guía de Despacho de un Movimiento van por el Motor de Documentos genérico (Etapa 4), no por `/api/materiales`: `GET /api/documentos/movimiento/:id.pdf` (comprobante, siempre disponible) y `POST /api/documentos/movimiento-guia-despacho/:id/emitir` (interna, no válida como DTE — solo si `tipoMovimiento.emiteDTE` y el movimiento está `CONFIRMADO`).

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

**Órdenes de Compra de Materiales** (ítem de menú propio `MATERIALES_OC`, mismo patrón que `COMPRAS_OC`)
| Método | Ruta | Notas |
|---|---|---|
| GET | `/ordenes-compra` | filtros `entidadProveedorId?`, `estado?`, paginado |
| GET | `/ordenes-compra/:id` | cabecera + líneas + cuotas |
| POST | `/ordenes-compra` | solo cabecera — nace `BORRADOR`, sin líneas (R19) |
| PATCH | `/ordenes-compra/:id` | edita cabecera — solo mientras `BORRADOR` (R20). Al fijar/cambiar `condicionPagoId` recalcula el snapshot de cuotas (R21) |
| DELETE | `/ordenes-compra/:id` | soft delete — solo mientras `BORRADOR` o `EMITIDA` sin Movimiento activo |
| POST | `/ordenes-compra/:id/lineas` | agrega línea (`articuloId`, `cantidad`, `precioUnitario`) — solo `BORRADOR` |
| PATCH | `/ordenes-compra/:id/lineas/:lineaId` | edita línea — solo `BORRADOR` |
| DELETE | `/ordenes-compra/:id/lineas/:lineaId` | elimina línea — solo `BORRADOR` |
| POST | `/ordenes-compra/:id/emitir` | `BORRADOR → EMITIDA` (R20); exige ≥1 línea |

> El ingreso a stock **no** es un endpoint de este submódulo: se hace con `POST /movimientos` + `/detalle` + `/confirmar` (arriba) pasando `ordenCompraMaterialId` en la cabecera del Movimiento (R22).

---

## 7. Frontend (Next.js 15, `fas-web/app/(app)/materiales/`)

| Ruta | Pantalla | Contenido |
|---|---|---|
| `/articulos` | Maestro de artículos | Tabla con filtro por tipo/estado, búsqueda. Alta/edición: tipo, código, descripción, descripción extranjera, unidad, **tipo de costeo** (al elegir `ESTANDAR` muestra campo valor y oculta control de stock), **stock crítico**, adjuntar documentos. |
| `/articulos/[id]` | Detalle | Datos, saldos por bodega, recetas (si es embalaje), documentos. |
| `/articulos/[id]/recetas` | Recetas del embalaje | Cabecera (código, descripción, cantidad a producir) + grilla de detalle (componente, cantidad a consumir decimal). |
| `/tipos-movimiento` | Mantenedor de tipos | Código, descripción, módulos (multiselect), clase, requiere precio, entidad relacionada, emite DTE. |
| `/movimientos/nuevo`, `/movimientos/:id` | **Materiales y envases** | Pantalla completa (reescrita 2026-08-29, mismo patrón que la Orden de Compra): `/nuevo` solo pide tipo de movimiento + fecha y crea la cabecera `BORRADOR`; `/:id` habilita cabecera editable (entidad, bodega origen/destino, guía/referencia, **bloque DTE** condicional si `emiteDTE`: transportista, RUT y nombre chofer, placas, hora salida/llegada) + tabla de líneas con agregar/editar/eliminar (mutaciones inmediatas contra el backend, sin efecto en saldo). Acciones: "Guardar cabecera", "Eliminar borrador", "Confirmar movimiento" (aplica el motor de PMP y bloquea edición), y en el menú de la fila del listado: "Descargar PDF" y "Emitir Guía de Despacho" (esta última solo si `emiteDTE` y `CONFIRMADO`). |
| `/consulta-stock-receta` | Analizador de stock | Multiselect de embalajes + cantidad c/u, multiselect de bodegas. Resultado: por componente, stock en **cada** bodega + badge de estado: `OK` (verde), `Stock Crítico` (amarillo), `Sin Stock` (rojo), `Trasladar` (amarillo). |
| `/ordenes-compra/nuevo`, `/ordenes-compra/:id` | Orden de Compra de Materiales | Mismo patrón que la OC de fruta y que `/movimientos/:id`: `/nuevo` crea la cabecera `BORRADOR` (proveedor, forma/condición de pago, moneda); `/:id` habilita cabecera + tabla de líneas (artículo, cantidad, precio unitario, monto calculado) con agregar/editar/eliminar mientras `BORRADOR`. Acciones: "Guardar cabecera", "Eliminar borrador", "Emitir OC" (bloquea edición, R20). Desde una OC `EMITIDA`, botón "Registrar ingreso" que abre `/movimientos/nuevo?ordenCompraMaterialId=:id` precargando entidad y líneas sugeridas desde la OC. |

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
- **CA20 (R19):** `entidadProveedorId` sin `PROVEEDOR` en `tipos` → 422 al crear/editar la OC.
- **CA21 (R20):** OC `EMITIDA`; `PATCH` de cabecera o línea → 422 ("ya fue emitida y no puede editarse").
- **CA22 (R21):** `CondicionPago` con una cuota `MONTO_UNITARIO`; se intenta asignar a una OC de Materiales → 422.
- **CA23 (R21):** `CondicionPago` con cuotas 100% `PORCENTAJE` (30/70); se asigna a la OC → se crean 2 `OrdenCompraMaterialCuotaPago` snapshot.
- **CA24 (R22-articulo):** Movimiento con `ordenCompraMaterialId` y una línea de artículo que no está en la OC → 422 al confirmar.
- **CA25 (R22-cantidad):** Línea de OC con `cantidad=10`; Movimiento confirma línea del mismo artículo con `cantidad=15` → 422.
- **CA26 (R22-cierre):** Movimiento válido confirmado contra una OC `EMITIDA` → Movimiento `CONFIRMADO` + OC pasa a `RECEPCIONADA`, ambos en la misma transacción.
- **CA27 (R22-único):** Ya existe un Movimiento `CONFIRMADO` vinculado a la OC; se intenta vincular un segundo Movimiento a la misma OC → 422.
- **CA28 (R22-borrador):** OC `EMITIDA` sin Movimiento; se crea un Movimiento `BORRADOR` con `ordenCompraMaterialId`; se elimina (soft delete) ese Movimiento antes de confirmar → la OC vuelve a estar disponible para un nuevo Movimiento.
- **CA29 (R22-completo, OCM-QA-003):** OC con líneas de artículos A y B; Movimiento confirma solo el artículo A → 422 ("no hay recepción parcial"), la OC permanece `EMITIDA`.
- **CA30 (R20-eliminación, OCM-QA-002):** OC `EMITIDA` sin Movimiento → `DELETE` la elimina (soft delete). OC `EMITIDA` con un Movimiento `BORRADOR` o `CONFIRMADO` activo vinculado → `DELETE` → 422.

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
10. Orden de Compra de Materiales: schema Prisma (`OrdenCompraMaterial`+`Linea`+`CuotaPago`, campo `ordenCompraMaterialId` en `Movimiento`) + migración; repo/service/routes con R19–R23; enganchar la validación/cierre (R22) dentro de `confirmarMovimientoTransaccional` existente; ítem de menú `MATERIALES_OC` en el seed; tests CA20–CA30; frontend `/ordenes-compra`.

---

## 10. Definition of Done

- [ ] Migración aplicada + seed.
- [ ] Endpoints de §6 implementados y validados con zod.
- [ ] Invariantes R1–R15 garantizadas por el service.
- [ ] Tests CA1–CA19 en verde.
- [ ] Pantallas de §7 navegables, con campos condicionales (valor estándar, bloque DTE) y badges de estado en la consulta.
- [ ] Schema incorporado al `CLAUDE.md` global.
- [ ] Orden de Compra de Materiales: invariantes R19–R23 garantizadas por el service, tests CA20–CA30 en verde, pantalla `/ordenes-compra` navegable.
