# Cobranza — Emisión de documentos, cuotas y pagos

**Sección:** Ventas · **Etapa:** 1 · **Estado:** ✅ Listo para implementación (v2 — reemplaza versión anterior)
**Key user:** María José (Cobranza) · **Relacionado:** Giovanni (Ventas), Fabián (Finanzas), Isella (Calidad)
**Prefijo API:** `/api/ventas/cobranza`

## 0. Contexto

Esta es la **v2** del spec de Cobranza. La v1 asumía que la Nota de Venta facturaba directo; en la práctica el eje real es el **Embarque**: una Nota de Venta puede generar varios embarques, y **cada embarque se factura por separado**, con su propia Proforma, su propio DTE, y sus propias NC/ND.

Dado el tamaño del dominio, Cobranza quedó dividida en **3 documentos** + **2 anexos** para otros módulos:

| Documento | Contenido |
|---|---|
| `cobranza.md` (este documento) | Proforma, Factura DTE, Cuotas, NC/ND, Pagos, Saldo a favor |
| `cobranza-score-riesgo.md` | Motor de score crediticio, línea de crédito, bloqueo automático |
| `cobranza-gestion.md` | Ventana de gestión de cartera, plantillas de correo, envío y su historial |
| Anexo → `entidades.md` | Campos de Cliente: línea de crédito, formas de pago habilitadas, contactos de correo por país, plantilla de cobranza por defecto |
| Anexo → spec de Reclamos/Claims | Entidad Provisión (asociada a reclamos) |

**Relación Proforma / DTE (aclarada por el usuario):** la Factura DTE es la que exige la ley chilena (Factura de Exportación, obligatoria, formato normado por el SII); la Proforma es la que exige el cliente (normalmente en inglés, con detalle de características de la fruta que el DTE no necesita — variedad, calibre, etc.). **Ambos documentos comparten: Cliente, Monto, Forma de pago, Fecha de emisión.** El resto del contenido difiere y no se modela como una entidad compartida — son dos modelos independientes con esos 4 campos duplicados por diseño.

**Las NC y ND siempre se emiten en referencia al DTE**, nunca a la Proforma. El saldo pendiente ("cartera") se rastrea exclusivamente sobre el DTE y sus Cuotas.

Dependencias externas (specs pendientes o de otro documento):
- **Nota de Venta** (Ventas, pendiente) — 1 Nota de Venta → N Embarques.
- **Embarque** (Operaciones/Despacho, pendiente) — se listan en §4 solo los campos que Cobranza necesita leer; el modelo completo se define en su propio spec.
- **Cliente** (Entidades, pendiente) — ver anexo de este documento.
- **Reclamos** (Calidad, pendiente) — ver anexo de Provisión.

---

## 1. Objetivo

1. Emitir, por cada Embarque, una **Proforma** en PDF (documento comercial, no tributario).
2. Emitir, por cada Embarque, la **Factura de Exportación (DTE 110)** vía el adaptador DTE genérico.
3. Generar automáticamente las **Cuotas** de la Factura según la Forma de Pago del cliente (1 a 3 cuotas, con fechas de vencimiento calculadas sobre 6 posibles fechas de referencia, recalculables dinámicamente).
4. Emitir **NC (112)** y **ND (111)** de exportación sobre el DTE, prorrateadas entre las cuotas pendientes.
5. Registrar **pagos** en la moneda propia de cada documento, aplicables a una o varias facturas elegidas por el usuario, con cascada automática hacia la cuota más antigua de cada factura.
6. Generar **saldo a favor del cliente** cuando un pago excede lo aplicado, reutilizable en futuros embarques.

---

## 2. Alcance

### Construye
- Catálogo **Forma de Pago** con 1 a 3 cuotas, cada una con % del monto, fecha de referencia (de 6 posibles) y días de plazo.
- Generación de **Proforma** (PDF) por embarque, con tabla de vencimientos estimada (no persistida como Cuota).
- Emisión de **Factura DTE (110)** por embarque vía adaptador, con generación automática de **Cuotas** persistidas.
- Recálculo de vencimientos de cuotas cuando cambian las fechas base del Embarque (arribo confirmado, cambio de BL, etc.).
- Emisión de **NC (112)** / **ND (111)** sobre el DTE, prorrateadas entre cuotas con saldo pendiente.
- Alerta (no bloqueante) al emitir una NC si existe una Provisión vigente para el mismo reclamo/embarque.
- Registro de **Pagos** multi-moneda, aplicación a uno o varios documentos elegidos por el usuario, cascada interna a cuotas.
- **Saldo a favor del cliente** cuando el pago excede lo aplicado, reutilizable en embarques futuros.

- **Ventas Nacionales**: sección de emisión con **confirmador de proformas** (servicios a productores y venta de materiales) y **emisor desde 0**, con DTE 33/34 vía el mismo adaptador que la 110.

### NO construye
- Motor de Score de Riesgo, línea de crédito y bloqueo → `cobranza-score-riesgo.md`.
- Ventana de gestión de cartera y envío de correos → `cobranza-gestion.md`.
- Entidad Provisión → anexo al spec de Reclamos.
- Registro de "Fecha de envío de documentos" en Embarque — campo pendiente de agregar en el módulo de Despacho; aquí solo se referencia como una de las 6 fechas posibles.
- Selección del proveedor DTE concreto (se consume vía interfaz de adaptador).
- Conversión de moneda / consolidación de cartera en una moneda única — cada documento y cada pago se mantiene en su propia moneda (USD, EUR, RMB, etc.), sin tipo de cambio.

---

## 3. Decisiones cerradas (default)

| # | Decisión |
|---|---|
| D1 | Proforma y Factura DTE son documentos independientes por embarque; comparten Cliente, Monto, Forma de Pago y Fecha de Emisión, pero su contenido difiere y no se modelan como entidad compartida. |
| D2 | 1 Embarque → 1 Proforma, 1 Factura DTE, N NC/ND. |
| D3 | 1 Nota de Venta → N Embarques. |
| D4 | Las **Cuotas se generan y se trackean sobre la Factura DTE**, no sobre la Proforma. La Proforma solo muestra una tabla de vencimientos estimada, calculada al vuelo con la misma lógica, sin persistir registros de Cuota. |
| D5 | No hay dependencia de secuencia estricta entre Proforma y Factura DTE (pueden emitirse en cualquier orden), pero el sistema **alerta** (no bloquea) si se emite el DTE sin Proforma emitida previamente para el mismo embarque. |
| D6 | `fechaVencimiento` de cada cuota = fecha de referencia elegida (Factura / Embarque·zarpe / Envío de documentos / Arribo / BL / Proforma) + días de plazo de la Forma de Pago. |
| D7 | Los vencimientos se **recalculan dinámicamente** si cambia la fecha base referenciada (ej. arribo confirmado, cambio de fecha BL), excepto en cuotas ya `PAGADA` (se conserva su fecha histórica para el cálculo de score). |
| D8 | NC/ND siempre en referencia a la Factura DTE. Se **prorratean proporcionalmente** entre todas las cuotas con saldo pendiente (no "más antigua primero" como los pagos). |
| D9 | Los pagos se registran y aplican en la **moneda propia de cada documento** (USD, EUR, RMB, etc.) — sin conversión. |
| D10 | Al aplicar un pago a una factura, el monto cae en **cascada a la cuota más antigua primero**; el excedente pasa automáticamente a la siguiente cuota de esa misma factura. |
| D11 | Si el monto del pago excede lo aplicado a los documentos elegidos por el usuario, el remanente genera un **Saldo a Favor del Cliente**, aplicable a futuros embarques (en la misma moneda). |
| D12 | La Proforma es un documento interno (PDF); no requiere folio SII ni CAF. |
| D13 | La habilitación de Forma(s) de Pago por cliente, la línea de crédito, el estado activo/inactivo y los contactos de correo por país **viven en el maestro de Clientes (Entidades)** — ver anexo. Este spec solo define el catálogo de Formas de Pago y su lógica de cuotas. |

---

## 4. Modelo de datos (Prisma)

```prisma
enum EstadoProforma {
  BORRADOR
  EMITIDA
  ANULADA
}

enum EstadoFactura {
  EMITIDA
  PAGADA_PARCIAL
  PAGADA_TOTAL
  VENCIDA
  ANULADA
}

enum EstadoNotaAjuste {
  EMITIDA
  ANULADA
}

enum EstadoCuota {
  PENDIENTE
  PARCIAL
  PAGADA
  VENCIDA
}

enum FechaReferenciaPago {
  FACTURA               // fecha de emisión del DTE
  EMBARQUE              // fecha de zarpe
  ENVIO_DOCUMENTOS      // pendiente en Embarque, ver seccion 2
  ARRIBO                // estimada o confirmada
  BL                     // fecha del Bill of Lading
  PROFORMA              // fecha de emisión de la proforma
}

enum MotivoNotaCredito {
  RECLAMO
  ANULA_DOCUMENTO
  CORRIGE_MONTO
  DEVOLUCION
  DESCUENTO
  OTRO
}

enum MotivoNotaDebito {
  INTERES_MORA
  CORRIGE_MONTO
  GASTOS_ADICIONALES
  OTRO
}

enum MedioPago {
  TRANSFERENCIA
  CHEQUE
  EFECTIVO
  OTRO
}

model FormaPago {
  id           Int              @id @default(autoincrement())
  nombre       String
  numeroCuotas Int                                // 1, 2 o 3
  activo       Boolean          @default(true)
  cuotas       FormaPagoCuota[]
  creadoEn     DateTime         @default(now())
}

model FormaPagoCuota {
  id              Int                 @id @default(autoincrement())
  formaPagoId     Int
  formaPago       FormaPago           @relation(fields: [formaPagoId], references: [id])
  numeroCuota     Int                                     // 1, 2, 3
  pctMonto        Decimal             @db.Decimal(5, 2)   // ej. 50.00
  fechaReferencia FechaReferenciaPago
  diasPlazo       Int

  @@unique([formaPagoId, numeroCuota])
}

// Entidad externa (Operaciones/Despacho, spec pendiente).
// Se documentan aqui SOLO los campos que Cobranza necesita leer.
model Embarque {
  id                    Int       @id @default(autoincrement())
  notaVentaId           Int
  clienteId             Int
  tipoEmbarqueId        Int                          // mantenedor externo: Maritimo/Terrestre/Aereo
  paisDestino           String
  fechaEmbarque         DateTime?                    // zarpe
  fechaArribo           DateTime?                    // estimada, se confirma despues
  fechaArriboConfirmada Boolean   @default(false)
  fechaBL               DateTime?
  fechaEnvioDocumentos  DateTime?                    // PENDIENTE: agregar en spec de Embarque/Despacho
  proforma              Proforma?
  factura               Factura?
}

model Proforma {
  id            Int            @id @default(autoincrement())
  numero        Int            @unique               // correlativo interno Agrosan
  embarqueId    Int            @unique
  clienteId     Int
  formaPagoId   Int
  fechaEmision  DateTime?
  moneda        String
  montoTotal    Decimal        @db.Decimal(12, 2)
  idioma        String         @default("EN")
  detalleFruta  Json?                                 // especie, variedad, calibre, etc. - libre, no tributario
  estado        EstadoProforma @default(BORRADOR)
  pdfUrl        String?
  creadoPorId   String
  creadoEn      DateTime       @default(now())
  actualizadoEn DateTime       @updatedAt
}

model Factura {
  id                      Int                       @id @default(autoincrement())
  tipoDte                 Int                       @default(110)  // Factura de Exportacion
  folio                   Int?
  trackIdSii              String?
  embarqueId              Int                       @unique
  proformaId              Int?                                      // referencia informativa (D5)
  clienteId               Int
  formaPagoId             Int
  fechaEmision            DateTime?
  moneda                  String
  montoTotal              Decimal                   @db.Decimal(12, 2)
  estado                  EstadoFactura             @default(EMITIDA)
  xmlUrl                  String?
  pdfUrl                  String?
  cuotas                  Cuota[]
  notasCredito            NotaCredito[]
  notasDebito             NotaDebito[]
  aplicacionesPago        PagoAplicacionDocumento[]
  aplicacionesSaldoAFavor SaldoAFavorAplicacion[]
  creadoPorId             String
  creadoEn                DateTime                  @default(now())
  actualizadoEn           DateTime                  @updatedAt

  @@index([clienteId])
  @@index([estado])
}

model Cuota {
  id                Int                    @id @default(autoincrement())
  facturaId         Int
  factura           Factura                @relation(fields: [facturaId], references: [id])
  numeroCuota       Int
  pctMonto          Decimal                @db.Decimal(5, 2)
  montoCuota        Decimal                @db.Decimal(12, 2)
  fechaReferencia   FechaReferenciaPago
  diasPlazo         Int
  fechaVencimiento  DateTime
  montoPagado       Decimal                @db.Decimal(12, 2) @default(0)
  saldoPendiente    Decimal                @db.Decimal(12, 2)
  estado            EstadoCuota            @default(PENDIENTE)
  ultimoRecalculoEn DateTime               @default(now())
  aplicacionesPago  PagoAplicacionCuota[]

  @@unique([facturaId, numeroCuota])
  @@index([fechaVencimiento])
}

model NotaCredito {
  id           Int               @id @default(autoincrement())
  tipoDte      Int               @default(112)
  folio        Int?
  trackIdSii   String?
  facturaId    Int
  factura      Factura           @relation(fields: [facturaId], references: [id])
  reclamoId    Int?                                    // si motivo = RECLAMO (spec Reclamos)
  provisionId  Int?                                    // si nace de una Provision (spec Reclamos)
  fechaEmision DateTime?
  motivo       MotivoNotaCredito
  montoTotal   Decimal           @db.Decimal(12, 2)
  moneda       String
  estado       EstadoNotaAjuste  @default(EMITIDA)
  xmlUrl       String?
  pdfUrl       String?
  creadoPorId  String
  creadoEn     DateTime          @default(now())

  @@index([facturaId])
}

model NotaDebito {
  id           Int              @id @default(autoincrement())
  tipoDte      Int              @default(111)
  folio        Int?
  trackIdSii   String?
  facturaId    Int
  factura      Factura          @relation(fields: [facturaId], references: [id])
  fechaEmision DateTime?
  motivo       MotivoNotaDebito
  montoTotal   Decimal          @db.Decimal(12, 2)
  moneda       String
  estado       EstadoNotaAjuste @default(EMITIDA)
  xmlUrl       String?
  pdfUrl       String?
  creadoPorId  String
  creadoEn     DateTime         @default(now())

  @@index([facturaId])
}

model Pago {
  id                  Int                        @id @default(autoincrement())
  clienteId           Int
  fecha               DateTime
  monto               Decimal                    @db.Decimal(12, 2)
  moneda              String
  medioPago           MedioPago
  referencia          String?
  observacion         String?
  aplicaciones        PagoAplicacionDocumento[]
  saldoAFavorGenerado SaldoAFavorCliente?
  creadoPorId         String
  creadoEn            DateTime                   @default(now())

  @@index([clienteId])
}

model PagoAplicacionDocumento {
  id             Int                    @id @default(autoincrement())
  pagoId         Int
  pago           Pago                   @relation(fields: [pagoId], references: [id])
  facturaId      Int
  factura        Factura                @relation(fields: [facturaId], references: [id])
  montoAplicado  Decimal                @db.Decimal(12, 2)  // elegido por el usuario; se cascada a cuotas
  fecha          DateTime               @default(now())
  detalleCuotas  PagoAplicacionCuota[]

  @@index([pagoId])
  @@index([facturaId])
}

model PagoAplicacionCuota {
  id                          Int                     @id @default(autoincrement())
  pagoAplicacionDocumentoId   Int
  pagoAplicacionDocumento     PagoAplicacionDocumento @relation(fields: [pagoAplicacionDocumentoId], references: [id])
  cuotaId                     Int
  cuota                       Cuota                   @relation(fields: [cuotaId], references: [id])
  monto                       Decimal                 @db.Decimal(12, 2)

  @@index([cuotaId])
}

model SaldoAFavorCliente {
  id              Int                      @id @default(autoincrement())
  clienteId       Int
  moneda          String
  montoOriginal   Decimal                  @db.Decimal(12, 2)
  montoDisponible Decimal                  @db.Decimal(12, 2)
  pagoOrigenId    Int?                     @unique
  pagoOrigen      Pago?                    @relation(fields: [pagoOrigenId], references: [id])
  fecha           DateTime                 @default(now())
  aplicaciones    SaldoAFavorAplicacion[]

  @@index([clienteId])
}

model SaldoAFavorAplicacion {
  id            Int                @id @default(autoincrement())
  saldoAFavorId Int
  saldoAFavor   SaldoAFavorCliente @relation(fields: [saldoAFavorId], references: [id])
  facturaId     Int
  factura       Factura            @relation(fields: [facturaId], references: [id])
  monto         Decimal            @db.Decimal(12, 2)
  fecha         DateTime           @default(now())

  @@index([facturaId])
}
```

---

### 4.11 Ventas Nacionales (emisión y validación)

Sección de emisión **paralela** a la de exportación. Cubre dos caminos que desembocan en la misma `FacturaNacional`:

1. **Confirmador de proformas** — recibe las proformas generadas en otros módulos: `ProformaServicioProductor` (`productores.md`) y `ProformaMaterial` (`materiales.md`).
2. **Emisor desde 0** — permite emitir una factura nacional directamente, sin proforma previa.

> **Por qué tablas separadas:** `Factura` (exportación) exige `embarqueId @unique` y está cableada a `Cuota`, `NotaCredito`/`NotaDebito` y `Pago` del ciclo de exportación. Las ventas nacionales no tienen embarque; modelarlas en la misma tabla rompería esos invariantes.

```prisma
enum OrigenProformaNacional {
  SERVICIO_PRODUCTOR      // productores.md
  MATERIAL                // materiales.md
  DIRECTO                 // emisor desde 0, sin proforma
}

enum EstadoFacturaNacional {
  BORRADOR
  EMITIDA
  ANULADA
}

model FacturaNacional {
  id             Int                     @id @default(autoincrement())
  tipoDte        Int                                                  // 33 (afecta) | 34 (exenta) — VN2
  folio          Int?
  trackIdSii     String?
  clienteId      Int                                                  // Entidad con CLIENTE_NACIONAL (VN3)
  origen         OrigenProformaNacional
  proformaServicioId Int?    @unique                                  // ProformaServicioProductor (productores.md)
  proformaMaterialId Int?    @unique                                  // ProformaMaterial (materiales.md)
  fechaEmision   DateTime?
  moneda         String
  montoNeto      Decimal                 @db.Decimal(14, 2)
  montoIva       Decimal                 @db.Decimal(14, 2)   @default(0)
  montoTotal     Decimal                 @db.Decimal(14, 2)
  estado         EstadoFacturaNacional   @default(BORRADOR)
  xmlUrl         String?
  pdfUrl         String?

  detalle        FacturaNacionalDetalle[]

  creadoPorId    String
  creadoEn       DateTime                @default(now())
  emitidoPorId   String?
  emitidoEn      DateTime?
  actualizadoEn  DateTime                @updatedAt

  @@index([clienteId])
  @@index([estado])
}

model FacturaNacionalDetalle {
  id                Int             @id @default(autoincrement())
  facturaNacionalId Int
  facturaNacional   FacturaNacional @relation(fields: [facturaNacionalId], references: [id], onDelete: Cascade)
  descripcion       String
  cantidad          Decimal         @db.Decimal(14, 3)
  precioUnitario    Decimal         @db.Decimal(14, 4)
  monto             Decimal         @db.Decimal(14, 2)
  // Trazabilidad al origen (nullable en emisión directa)
  conceptoId        Int?                                        // ConceptoLiquidacion (servicios)
  articuloId        Int?                                        // Articulo (materiales)

  @@index([facturaNacionalId])
}
```

---

## 5. Reglas / invariantes

- **CB1** — Suma de `pctMonto` de las `FormaPagoCuota` de una `FormaPago` debe ser exactamente 100.00.
- **CB2** — Constraint `@unique` en `Proforma.embarqueId` y `Factura.embarqueId`: 1 embarque → como máximo 1 Proforma y 1 Factura DTE.
- **CB3** — Al emitir el segundo de los dos documentos (Proforma/DTE) para un embarque, se valida que `montoTotal` coincida con el ya emitido; si difiere, se exige justificación y ambos quedan visibles con la discrepancia señalada.
- **CB4** — Si se emite la Factura DTE sin que exista una Proforma emitida previa para el mismo embarque, el sistema muestra una alerta no bloqueante (D5).
- **CB5** — Al emitir la Factura DTE, se generan automáticamente las `Cuota` copiando `FormaPagoCuota` vigente para el `formaPagoId` del cliente; la suma de `montoCuota` debe ser igual a `Factura.montoTotal` (el ajuste de redondeo, si existe, se aplica en la última cuota).
- **CB6** — `Cuota.fechaVencimiento` = valor actual del campo de `Embarque`/`Factura`/`Proforma` referenciado por `fechaReferencia`, más `diasPlazo`. Se recalcula automáticamente cuando cambia el campo fuente, **salvo** en cuotas con `estado = PAGADA` (D7).
- **CB7** — `Cuota.saldoPendiente = montoCuota − Σ(montoPagado vía Pago) − Σ(NC prorrateada) + Σ(ND prorrateada)`. Nunca queda negativo: el excedente pasa a la cuota siguiente de la misma factura o, si no hay más cuotas, a Saldo a Favor.
- **CB8** — NC/ND se **prorratean** entre todas las cuotas con `saldoPendiente > 0` de la factura, en proporción a su saldo pendiente relativo. Si la factura ya está totalmente pagada, la NC/ND queda registrada y su monto genera directamente un `SaldoAFavorCliente`.
- **CB9** — No se pueden emitir NC/ND sobre una Factura en estado `ANULADA`.
- **CB10** — Al ingresar una NC, si existe una Provisión `VIGENTE` (spec Reclamos) asociada al mismo reclamo/embarque, el sistema **alerta** (no bloquea) mostrando el monto de la provisión vigente, y sugiere ese monto como valor inicial de la NC (editable).
- **CB11** — Al registrar un `Pago`, el usuario elige uno o varios `facturaId` destino con un monto por cada uno (`PagoAplicacionDocumento`). El backend distribuye ese monto por `numeroCuota` ascendente (la más antigua primero) generando los `PagoAplicacionCuota` correspondientes, en cascada hacia la siguiente cuota si sobra saldo.
- **CB12** — Si `Σ(montoAplicado de PagoAplicacionDocumento) < Pago.monto`, la diferencia genera un `SaldoAFavorCliente` en la misma moneda del pago.
- **CB13** — `SaldoAFavorCliente.montoDisponible` solo puede aplicarse a facturas del mismo `clienteId` y en la misma `moneda`.
- **CB14** — Estado de `Cuota` recalculado tras cada mutación: `saldoPendiente = 0` → `PAGADA`; `0 < saldoPendiente < montoCuota` → `PARCIAL`; `saldoPendiente = montoCuota` y vencida → `VENCIDA`; si no vencida → `PENDIENTE`.
- **CB15** — Estado de `Factura` derivado del agregado de sus cuotas: todas `PAGADA` → `PAGADA_TOTAL`; alguna con pago parcial → `PAGADA_PARCIAL`; ninguna pagada y alguna `VENCIDA` → `VENCIDA`; ninguna pagada y ninguna vencida → `EMITIDA`; NC de anulación total aplicada → `ANULADA`.
- **CB16** — No se permite eliminar (hard delete) ningún documento tributario, Cuota o Pago ya registrado. Toda corrección se hace con un documento de ajuste nuevo.
- **CB17** — La moneda de un `Pago` debe coincidir con la moneda de cada `Factura` a la que se aplica; no hay conversión (D9).

---

### Ventas Nacionales

- **VN1 — Dos caminos, una factura.** La `FacturaNacional` nace de la confirmación de una proforma (`SERVICIO_PRODUCTOR` / `MATERIAL`) o de la emisión directa (`DIRECTO`). El `origen` es obligatorio y determina qué FK de proforma se puebla (exactamente una, o ninguna si es `DIRECTO`).
- **VN2 — Tipo de DTE.** `33` (afecta) o `34` (exenta), emitidos por la **misma integración/adaptador** que la Factura de Exportación 110. Ningún otro tipo es válido → 422.
- **VN3 — Cliente nacional.** `clienteId` debe ser una `Entidad` con `CLIENTE_NACIONAL` en `tipos` (`entidades.md` R8) → 422. Un productor o un proveedor pueden serlo simultáneamente (multiselect); para facturarles **debe** estar marcado.
- **VN4 — Borrador sin efectos.** Mientras la factura está en `BORRADOR`, **no** hay efectos reales: no se emite DTE, no se mueve la cuenta corriente y no se descuenta stock. Todos los efectos ocurren al **confirmar/emitir**.
- **VN5 — Efectos al emitir.** Al pasar a `EMITIDA`, de forma transaccional:
  - se emite el DTE 33/34 vía adaptador;
  - la proforma de origen pasa a `FACTURADA` y se enlaza (`facturaNacionalId`);
  - **origen `SERVICIO_PRODUCTOR`** → se registra el movimiento en la cuenta corriente del productor (`productores.md` R11/R16);
  - **origen `MATERIAL`** → se genera el `Movimiento` de clase `SALIDA` que descuenta stock (`materiales.md` R16). Si el saldo resultara negativo (R2 de Materiales), la emisión **falla completa** y nada se persiste.
- **VN6 — Sin embarque, sin cuotas de exportación.** La `FacturaNacional` no referencia `Embarque` ni genera `Cuota`; la cartera de exportación (`cobranza-gestion.md`) no la incluye.

---

## 6. Contratos API

Prefijo: `/api/ventas/cobranza`

| Método | Ruta | Descripción |
|---|---|---|
| POST/GET/PATCH | `/formas-pago` | Mantenedor de Forma de Pago, con sus cuotas anidadas. Valida CB1. |
| POST | `/embarques/:id/proforma` | Genera y emite la Proforma en PDF para el embarque. |
| GET | `/proformas` / `/proformas/:id` | Listado / detalle, con tabla de vencimientos estimada calculada al vuelo. |
| POST | `/embarques/:id/factura` | Emite la Factura DTE (110) vía adaptador y genera las Cuotas (CB5). |
| GET | `/facturas` | Cartera. Filtros: `clienteId`, `estado`, `vencidas=true`, `desde`, `hasta`. |
| GET | `/facturas/:id` | Detalle con cuotas, NC/ND, pagos y saldo a favor aplicados. |
| POST | `/facturas/:id/notas-credito` | Emite NC (112). Valida CB9, dispara alerta CB10. |
| POST | `/facturas/:id/notas-debito` | Emite ND (111). Valida CB9. |
| POST | `/facturas/:id/recalcular-vencimientos` | Fuerza el recálculo de CB6 (llamable internamente cuando el módulo de Embarque notifique cambios de fecha). |
| GET | `/clientes/:id/documentos-pendientes` | Lista facturas con cuotas y saldo, para armar la pantalla de aplicación de pago. |
| POST | `/pagos` | Registra un pago con sus aplicaciones a documentos (CB11) y genera saldo a favor si corresponde (CB12). |
| GET | `/pagos` | Lista pagos. Filtros: `clienteId`, `desde`, `hasta`. |
| GET | `/clientes/:id/saldo-a-favor` | Saldos a favor vigentes del cliente, por moneda. |
| POST | `/saldo-a-favor/:id/aplicar` | Aplica un saldo a favor existente a una factura (CB13). |

---

### Ventas Nacionales

Prefijo: `/api/ventas/cobranza/nacionales`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/proformas-pendientes` | Proformas en `ENVIADA_VALIDACION` desde Productores y Materiales, unificadas para el confirmador. Filtros: `origen`, `clienteId`, `desde`, `hasta`. |
| POST | `/facturas/desde-proforma` | Confirma una proforma: `{ origen, proformaId, tipoDte }` → crea la `FacturaNacional` en `BORRADOR` con el detalle heredado (VN1). |
| GET/POST/PATCH | `/facturas[/:id]` | **Emisor desde 0**: crea/edita una factura `DIRECTO` con líneas libres. Editable solo en `BORRADOR`. |
| POST | `/facturas/:id/emitir` | Emite el DTE 33/34 y dispara los efectos reales de forma transaccional (VN5). |
| POST | `/facturas/:id/anular` | Anula la factura (y revierte el movimiento de stock si aplica). |

---

## 7. Frontend

- **Detalle de Embarque**: pestañas Proforma / Factura DTE, cada una con su estado y acciones (`Emitir Proforma`, `Emitir Factura`). Tabla de Cuotas visible bajo la Factura, con columnas: N° cuota, %, monto, fecha de referencia, vencimiento, saldo pendiente, estado.
- **Cartera (Facturas)**: listado server-side con filtros de §6, columna de días de atraso, badges de NC/ND/Provisión vigente.
- **Modal "Registrar pago"**: selección de cliente → moneda del pago → lista de sus facturas pendientes (en esa moneda) con checkbox y campo de monto por factura → validación en vivo de que la suma no exceda `Pago.monto` (el remanente se muestra como "quedará a favor del cliente").
- **Emisión de NC**: si existe Provisión vigente para el embarque, se muestra un banner de alerta con el monto sugerido antes de confirmar.
- **Panel de Saldo a Favor**: en la ficha de cliente, listado de saldos disponibles por moneda con botón "Aplicar a factura".

---

## 8. Criterios de aceptación (Given/When/Then)

- **CB-T1**: Dada una `FormaPago` con cuotas 60%/40%, cuando se intenta guardar con 60%/30%, entonces la API rechaza (viola CB1).
- **CB-T2**: Dado un embarque sin Proforma emitida, cuando se emite su Factura DTE, entonces se genera igual pero con una alerta visible (CB4).
- **CB-T3**: Dada una Factura DTE de USD 1.000 con Forma de Pago 50%/50% a 30/60 días desde Embarque, cuando se emite, entonces se generan 2 Cuotas de USD 500 con vencimientos calculados sobre `Embarque.fechaEmbarque` (CB5, CB6).
- **CB-T4**: Dado que `Embarque.fechaArribo` cambia de confirmada, cuando una Cuota referenciaba `ARRIBO` y no estaba `PAGADA`, entonces su `fechaVencimiento` se recalcula (CB6/D7).
- **CB-T5**: Dada una Factura con 2 cuotas pendientes de USD 300 y USD 700, cuando se emite una NC de USD 200, entonces se prorratea 60/140 respectivamente entre ambas cuotas (CB8).
- **CB-T6**: Dado un pago de USD 900 aplicado a una Factura con cuotas de USD 500 (más antigua) y USD 500, entonces la primera cuota queda `PAGADA` y la segunda con saldo USD 100 (CB11/D10).
- **CB-T7**: Dado un pago de USD 1.200 donde el usuario solo aplica USD 900 a documentos, entonces se genera un `SaldoAFavorCliente` de USD 300 (CB12).
- **CB-T8**: Dado un Saldo a Favor de USD 300 en USD, cuando se intenta aplicar a una factura en EUR, entonces la API rechaza (CB13).
- **CB-T9**: Dada una Factura con todas sus cuotas `PAGADA`, cuando se consulta el listado de cartera, entonces su estado es `PAGADA_TOTAL` (CB15).

---

## 9. Plan de implementación

1. Migraciones Prisma de §4.
2. Confirmar/definir la interfaz del adaptador DTE (emisión 110/111/112) — puede ser un paquete compartido con Finanzas si "Facturación" termina siendo el mismo adaptador.
3. Servicio `ProformaService` (PDF, tabla de vencimientos calculada al vuelo).
4. Servicio `FacturacionService`: emisión DTE + generación de Cuotas (CB5/CB6) + recálculo de vencimientos.
5. Servicio `AjusteService`: NC/ND + prorrateo (CB8) + alerta de Provisión vigente (CB10, requiere endpoint de lectura del spec de Reclamos).
6. Servicio `PagoService`: aplicación en cascada (CB11), generación de saldo a favor (CB12), aplicación de saldo a favor (CB13).
7. Endpoints Fastify de §6 con guards de permisos.
8. Frontend de §7.
9. Tests de CB-T1 a CB-T9.
10. Coordinar con el spec de Embarque/Despacho el mecanismo de notificación de cambio de fechas (para CB6) — dependencia externa a resolver antes de cerrar implementación.

---

## 10. Definition of Done

- [ ] Migraciones aplicadas, modelo revisado contra convención de IDs.
- [ ] Endpoints de §6 implementados y documentados.
- [ ] Reglas CB1–CB17 cubiertas por al menos un test.
- [ ] Criterios CB-T1–CB-T9 pasando.
- [ ] Mecanismo de recálculo de vencimientos (CB6) validado con al menos un caso real de cambio de fecha de arribo.
- [ ] Prorrateo de NC/ND (CB8) validado con datos de prueba de Alejandro Véliz.
- [ ] Anexos a `entidades.md` y al spec de Reclamos entregados y confirmados por el equipo.
- [ ] Revisión de Codex sin hallazgos críticos abiertos.
