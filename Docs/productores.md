# Módulo: Administración de Productores — FAS

> **Spec de módulo para desarrollo autónomo con Claude Code.** Extiende `CLAUDE.md` y `00-entorno-general.md`.
>
> | | |
> |---|---|
> | **Etapa** | 1 (ficha, predios, contrato, cuenta corriente, conceptos) · proceso de liquidación en Etapa 3 |
> | **Key user** | Patricia (Gestión Productores) |
> | **Sección de menú** | Productores |
> | **Backend** | `fas-api` · prefijo `/api/productores` y `/api/config/conceptos-liquidacion` |
> | **Frontend** | `fas-web` · `app/(app)/productores/` |
> | **Depende de** | Entidades (`Entidad` tipo PRODUCTOR), Mantenedores (`Comuna`, `TipoProduccion`, `Zona`, `Especie`, `Moneda`, `TipoCuentaCorriente`, `Temporada`) |
> | **Estado** | Listo para Etapa 1 (ficha, predios, contrato, cuenta corriente) · decisiones de Etapa 3 marcadas |

---

## 0. Contexto para Claude Code

El módulo administra a los **productores** (que son `Entidad` con `tipos` incluyendo `PRODUCTOR`) y todo lo asociado: sus **predios**, su **contrato** (PDF + condiciones controladas), su **cuenta corriente** (debes/haberes) y la configuración de **conceptos de liquidación** (cobros/abonos por especie). La compra al productor nace por **Orden de Compra** (módulo Compras, *pendiente*) o por **Contrato**.

---

## 1. Objetivo

Permitir a Patricia administrar la ficha de cada productor, sus predios, su contrato y condiciones, llevar su cuenta corriente, y configurar los conceptos que se aplican en la liquidación al productor.

---

## 2. Alcance

**Construye:**
1. **Ficha de productor** sobre `Entidad` (tipo PRODUCTOR), exigiendo representante legal con RUT.
2. **Predios** — mantenedor por productor.
3. **Contrato** — PDF asociado + sección de condiciones controladas.
4. **Cuenta corriente** — imputación de debes/haberes + informe con saldo.
5. **Conceptos de liquidación** — mantenedor tipo lista de precios (cobros/abonos por especie).
6. **Solicitud de Pago** — búsqueda/filtro de cuotas pendientes de los documentos de compra capturados (`compras.md`), selección y confirmación; alimenta la cuenta corriente.
7. **Proforma de servicios** — cobro de servicios al productor (líneas = conceptos de liquidación), validada y facturada en `cobranza.md`.

**NO construye (fuera de alcance):**
- Detalle de la **Orden de Compra** y la **captura** de facturas/notas de crédito desde la fuente externa (módulo Compras).
- **Emisión** de la factura de venta nacional (DTE 33/34) — vive en `cobranza.md` (Ventas Nacionales); aquí solo se genera la proforma.
- El **cálculo/proceso de liquidación** al productor (Etapa 3 — Liquidaciones); aquí solo se configura.
- El cómputo del **volumen real comprado** (depende de Compras/recepciones).

---

## 3. Decisiones cerradas (defaults) y decisiones de Etapa 3

| # | Decisión | Default |
|---|---|---|
| PR1 | Productor | No hay tabla `Productor` aparte: es `Entidad` con `PRODUCTOR` en `tipos`; predios/contrato/CC cuelgan de `entidadId`. |
| PR2 | Representante legal | El productor exige ≥1 `EntidadContacto` con `esRepresentanteLegal = true` y `rut` (cambio ya aplicado en entidades.md). |
| PR3 | Predio | Maestro: `Int`, código único por productor, softdelete, auditoría. **Sin** descripción extranjera. |
| PR4 | Contrato | Múltiples contratos por productor (historial), con `temporadaId` (season-scoped, E3). PDF opcional adjunto. |
| PR5 | Cuenta corriente | Movimientos **inmutables**; saldo = Σ HABER − Σ DEBE; corrección por reverso. |
| PR6 | Concepto de liquidación | Cabecera (código, descripción, forma de aplicación, naturaleza COBRO/ABONO) + valor por especie (matriz tipo lista de precios). |
| PR7 | Forma de aplicación | `POR_KILO`, `POR_CAJA`, `PORCENTAJE_VENTA` y **`MONTO_TOTAL`** (añadido para el caso "transporte por X dólares totales"). |
| PR8 | Naturaleza concepto | `COBRO` (resta de la liquidación) / `ABONO` (suma). Cubre el "positivos o negativos". |
| PR9 | Moneda | Conceptos y CC en USD por defecto (`monedaId` opcional para multimoneda). |

**Decisiones de Etapa 3 (no bloquean Etapa 1; se resuelven antes del cálculo de liquidación):** semántica de "Valores de facturación" vs "Condiciones de facturación"; unidad y fuente del volumen comprometido/cumplimiento (depende de Compras); si `MONTO_TOTAL` es correcto; moneda de los conceptos; y si los valores de conceptos se asocian por especie, por productor o ambos.

---

## 4. Modelo de datos (Prisma)

```prisma
enum UnidadVolumen {
  KG
  CAJAS
}

enum NaturalezaMovimientoCC {
  DEBE
  HABER
}

enum FormaAplicacionConcepto {
  POR_KILO
  POR_CAJA
  PORCENTAJE_VENTA
  MONTO_TOTAL
}

enum NaturalezaConcepto {
  COBRO          // resta de la liquidación (−)
  ABONO          // suma a la liquidación (+)
}

model Predio {
  id               Int             @id @default(autoincrement())
  entidadId        Int                                       // Entidad tipo PRODUCTOR (R1)
  entidad          Entidad         @relation("PrediosProductor", fields: [entidadId], references: [id])
  codigo           String                                    // único por productor (R2)
  descripcion      String
  codigoCsg        String?
  nombreCsg        String?
  codigoSdp        String?
  codigoGgn        String?
  direccion        String?
  comunaId         Int?
  comuna           Comuna?         @relation(fields: [comunaId], references: [id])
  tipoProduccionId Int?
  tipoProduccion   TipoProduccion? @relation(fields: [tipoProduccionId], references: [id])
  zonaId           Int?
  zona             Zona?           @relation(fields: [zonaId], references: [id])
  latitud          Decimal?        @db.Decimal(10, 7)
  longitud         Decimal?        @db.Decimal(10, 7)

  // auditoría + softdelete (patrón maestro)
  creadoEn      DateTime  @default(now())
  creadoPor     String
  actualizadoEn DateTime? @updatedAt
  actualizadoPor String?
  eliminadoEn   DateTime?
  eliminadoPor  String?

  @@index([entidadId])
}

model ProductorContrato {
  id                     Int            @id @default(autoincrement())
  entidadId              Int
  entidad                Entidad        @relation("ContratosProductor", fields: [entidadId], references: [id])
  temporadaId            Int?
  temporada              Temporada?     @relation(fields: [temporadaId], references: [id])
  pdfRuta                String?                            // contrato escaneado (PDF)
  fechaInicio            DateTime?      @db.Date
  fechaTermino           DateTime?      @db.Date

  // Condiciones controladas durante el proceso
  valoresFacturacion     String?                            // ⚠ a refinar
  condicionesPago        String?
  condicionesFacturacion String?                            // ⚠ a refinar (vs valoresFacturacion)
  volumenComprometido    Decimal?       @db.Decimal(14, 3)
  unidadVolumen          UnidadVolumen?
  minimoGarantizado      Decimal?       @db.Decimal(14, 4)
  // porcentajeCumplimiento: CALCULADO (volumen real / comprometido), no se almacena (R5b)

  creadoEn      DateTime  @default(now())
  creadoPor     String
  actualizadoEn DateTime? @updatedAt
  actualizadoPor String?
  eliminadoEn   DateTime?
  eliminadoPor  String?

  @@index([entidadId])
}

model MovimientoCuentaCorriente {
  id          Int                 @id @default(autoincrement())   // operativo, inmutable (R5)
  entidadId   Int                                            // productor
  entidad     Entidad                @relation("CCProductor", fields: [entidadId], references: [id])
  tipoId      Int
  tipo        TipoCuentaCorriente    @relation(fields: [tipoId], references: [id])
  naturaleza  NaturalezaMovimientoCC                          // DEBE o HABER (consistente con tipo.naturaleza)
  fecha       DateTime
  glosa       String?
  monto       Decimal                @db.Decimal(14, 4)
  monedaId    Int?
  moneda      Moneda?                @relation(fields: [monedaId], references: [id])
  referencia  String?                                        // ej: liquidación / OC
  temporadaId Int?
  usuarioId   String
  creadoEn    DateTime               @default(now())

  @@index([entidadId, fecha])
  @@index([tipoId])
}

model ConceptoLiquidacion {
  id              Int                          @id @default(autoincrement())
  codigo          String
  descripcion     String
  formaAplicacion FormaAplicacionConcepto
  naturaleza      NaturalezaConcepto                          // COBRO (−) / ABONO (+)
  valores         ConceptoLiquidacionEspecie[]

  creadoEn      DateTime  @default(now())
  creadoPor     String
  actualizadoEn DateTime? @updatedAt
  actualizadoPor String?
  eliminadoEn   DateTime?
  eliminadoPor  String?
}

model ConceptoLiquidacionEspecie {
  id         Int                 @id @default(autoincrement())
  conceptoId Int
  concepto   ConceptoLiquidacion @relation(fields: [conceptoId], references: [id], onDelete: Cascade)
  especieId  Int
  especie    Especie             @relation(fields: [especieId], references: [id])
  valor      Decimal             @db.Decimal(14, 4)          // valor del concepto para esa especie

  @@unique([conceptoId, especieId])
  @@index([conceptoId])
}
```

### 4.2 Solicitud de Pago a Productores

Opera sobre los **documentos de compra** capturados desde la fuente externa (`compras.md` §4.8). Permite filtrar y buscar cuotas pendientes, seleccionarlas y transformarlas en una solicitud; al **confirmarse**, alimenta la cuenta corriente del productor.

```prisma
enum EstadoSolicitudPago {
  BORRADOR        // seleccionada, sin efectos reales
  CONFIRMADA      // genera movimientos de CC y abona las cuotas
  ANULADA
}

model SolicitudPago {
  id          Int                   @id @default(autoincrement())
  numero      Int                   @unique
  entidadId   Int                                             // Entidad tipo PRODUCTOR (R10)
  entidad     Entidad               @relation("SolicitudesPagoProductor", fields: [entidadId], references: [id])
  fecha       DateTime              @default(now())
  moneda      String
  montoTotal  Decimal               @db.Decimal(14, 2)        // Σ montoPagado de sus cuotas (neto de NC, R12)
  estado      EstadoSolicitudPago   @default(BORRADOR)
  glosa       String?

  cuotas      SolicitudPagoCuota[]

  creadoPorId    String
  creadoEn       DateTime           @default(now())
  confirmadoPorId String?
  confirmadoEn   DateTime?
  anuladoPorId   String?
  anuladoEn      DateTime?

  @@index([entidadId])
  @@index([estado])
}

model SolicitudPagoCuota {
  id                     Int           @id @default(autoincrement())
  solicitudPagoId        Int
  solicitudPago          SolicitudPago @relation(fields: [solicitudPagoId], references: [id], onDelete: Cascade)
  cuotaDocumentoCompraId Int                                  // CuotaDocumentoCompra (compras.md)
  montoPagado            Decimal       @db.Decimal(14, 2)     // ≤ saldoPendiente de la cuota (R12)

  @@unique([solicitudPagoId, cuotaDocumentoCompraId])
  @@index([cuotaDocumentoCompraId])
}
```

### 4.3 Proforma de Servicios a Productores

Cobro de servicios al productor. Se genera aquí y se **valida/emite** en el módulo de Ventas Nacionales de `cobranza.md`. Las líneas son **Conceptos de Liquidación** (PR6).

```prisma
enum EstadoProformaServicio {
  BORRADOR
  ENVIADA_VALIDACION
  FACTURADA
  ANULADA
}

model ProformaServicioProductor {
  id           Int                          @id @default(autoincrement())
  numero       Int                          @unique
  entidadId    Int                                                 // PRODUCTOR y además CLIENTE_NACIONAL (R13)
  entidad      Entidad                      @relation("ProformasServicioProductor", fields: [entidadId], references: [id])
  fecha        DateTime                     @default(now())
  moneda       String
  montoTotal   Decimal                      @db.Decimal(14, 2)
  estado       EstadoProformaServicio       @default(BORRADOR)
  facturaNacionalId Int?                                           // FacturaNacional (cobranza.md), al confirmar

  detalle      ProformaServicioDetalle[]

  creadoPorId  String
  creadoEn     DateTime                     @default(now())
  actualizadoEn DateTime?                   @updatedAt

  @@index([entidadId])
  @@index([estado])
}

model ProformaServicioDetalle {
  id          Int                       @id @default(autoincrement())
  proformaId  Int
  proforma    ProformaServicioProductor @relation(fields: [proformaId], references: [id], onDelete: Cascade)
  conceptoId  Int                                                  // ConceptoLiquidacion (PR6/R14)
  concepto    ConceptoLiquidacion       @relation(fields: [conceptoId], references: [id])
  descripcion String?                                              // glosa editable, default = concepto.descripcion
  cantidad    Decimal                   @db.Decimal(14, 3)
  precioUnitario Decimal                @db.Decimal(14, 4)
  monto       Decimal                   @db.Decimal(14, 2)

  @@index([proformaId])
}
```

> Back-relations a agregar: `Entidad` → `predios`, `contratos`, `movimientosCC`, `solicitudesPago`, `proformasServicio`; `Comuna/TipoProduccion/Zona/Temporada/Moneda/Especie` → sus listas; `TipoCuentaCorriente` (mantenedores) → `movimientos MovimientoCuentaCorriente[]`; `ConceptoLiquidacion` → `lineasProforma ProformaServicioDetalle[]`.

---

## 5. Reglas de negocio / invariantes

- **R1 — Predio de productor.** `Predio.entidadId` debe ser una entidad con `PRODUCTOR` en `tipos` → 422.
- **R2 — Código de predio** único por productor entre no eliminados.
- **R3 — Representante legal obligatorio.** Un productor debe tener un `EntidadContacto` con `esRepresentanteLegal = true` y `rut` válido (regla R9 de entidades). Bloquear operaciones que lo requieran si falta.
- **R4 — Contrato.** PDF opcional; condiciones se editan/exhiben en sección independiente. Múltiples contratos por productor (historial), season-scoped.
- **R5 — Cuenta corriente.** Movimientos inmutables; corrección por reverso. **R5b:** saldo = Σ(HABER) − Σ(DEBE). `% cumplimiento` del contrato = volumen real / `volumenComprometido` × 100 (volumen real proviene de Compras — pendiente).
- **R6 — Naturaleza CC.** `movimiento.naturaleza` debe ser compatible con `tipo.naturaleza`: si el tipo es `DEBE` → solo DEBE; `HABER` → solo HABER; `AMBOS` → cualquiera. → 422 si incompatible.
- **R7 — Concepto por especie.** `valor` único por `(conceptoId, especieId)`. La `naturaleza` del concepto define el signo al aplicarlo (COBRO resta, ABONO suma).
- **R8 — Softdelete + auditoría** en Predio, Contrato y Concepto. Movimientos CC inmutables (no softdelete, se revierten).

### Solicitud de Pago (documentos de compra)

- **R10 — Solo productores.** La Solicitud de Pago aplica únicamente a entidades con `PRODUCTOR` en `tipos` → 422. Otros proveedores quedan fuera de alcance.
- **R11 — Impacto en CC (signos).** Consistente con `compras.md` CO6:
  - **Factura de compra capturada** → movimiento **HABER**, aplicado **de inmediato** al capturarse (no espera al pago).
  - **Nota de Crédito capturada** → movimiento **DEBE** (inverso de la factura).
  - **Pago confirmado** (Solicitud de Pago) → movimiento **DEBE**.
  Saldo = Σ HABER − Σ DEBE (R5b): la factura aumenta lo que se le debe al productor; NC y pago lo reducen.
- **R12 — Neto de NC.** `SolicitudPagoCuota.montoPagado ≤ CuotaDocumentoCompra.saldoPendiente`, donde el saldo ya viene neto de las NC aplicadas (`compras.md` CO5). **Se paga la factura menos la NC.**
- **R12b — Confirmación = efectos reales.** En `BORRADOR` la solicitud no genera movimientos ni abona cuotas. Al **confirmar**: se generan los movimientos `DEBE` en la CC y se descuenta el `saldoPendiente` de cada cuota. Una solicitud `CONFIRMADA` no se edita (se anula con reverso, R5).

### Proforma de servicios y su relación con la liquidación

- **R13 — Entidad facturable.** Para emitirle una factura de venta, el productor debe estar marcado **también** como `CLIENTE_NACIONAL` en `Entidad.tipos` (multiselect, `entidades.md` R1/R8) → 422 si no. Una misma entidad puede ser Productor + Cliente + Proveedor + Empresa de Transporte simultáneamente.
- **R14 — Líneas = conceptos de liquidación.** El detalle de la proforma de servicios se arma con `ConceptoLiquidacion` (naturaleza `COBRO`), no con texto libre.
- **R15 — Se factura O se descuenta de la liquidación (excluyente).** ⚠ **Invariante crítica.** Un cobro al productor sigue **una sola** vía:
  - **Vía factura:** se emite una Proforma de Servicios → factura de venta nacional. Impacta la **cuenta corriente** del productor (y su pago también). **No** impacta la liquidación.
  - **Vía liquidación:** el cobro se ingresa como concepto (`COBRO`/`ABONO`) dentro de la liquidación (Etapa 3). **No** se factura.

  El mismo concepto no puede ir por ambas vías para un mismo período/productor: sería doble cobro. El sistema debe impedirlo o, como mínimo, alertar explícitamente.
- **R16 — Efectos al confirmar.** La proforma en `BORRADOR`/`ENVIADA_VALIDACION` no tiene efectos. Al confirmarse en el módulo de validación de `cobranza.md` se emite la `FacturaNacional` y la proforma pasa a `FACTURADA`.

---

## 6. Contratos API (Fastify)

**Productores** (prefijo `/api/productores`)
| Método | Ruta | Notas |
|---|---|---|
| GET | `/` | Lista entidades con tipo PRODUCTOR (+ resumen). |
| GET | `/:entidadId` | Ficha: datos de entidad, representante legal, predios, contratos. |
| GET/POST/PATCH/DELETE | `/:entidadId/predios[/:predioId]` | CRUD de predios (R1/R2). |
| GET/POST/PATCH/DELETE | `/:entidadId/contratos[/:contratoId]` | CRUD de contratos + condiciones (R4). |
| POST | `/:entidadId/contratos/:contratoId/pdf` | Subir/reemplazar PDF del contrato. |
| GET | `/:entidadId/cuenta-corriente` | Informe: movimientos + saldo (filtros fecha/temporada). |
| POST | `/:entidadId/cuenta-corriente` | Imputar debe/haber (R6). |

**Solicitud de Pago** (prefijo `/api/productores`)
| Método | Ruta | Notas |
|---|---|---|
| GET | `/cuotas-pendientes` | Busca/filtra cuotas de documentos de compra con `saldoPendiente > 0`. Filtros: `entidadId`, `vencimientoDesde`, `vencimientoHasta`, `folio`, `ordenCompraId`. |
| GET/POST | `/solicitudes-pago[/:id]` | Crea la solicitud en `BORRADOR` a partir de `{ entidadId, cuotas:[{cuotaId, montoPagado}] }` (R10/R12). |
| POST | `/solicitudes-pago/:id/confirmar` | Genera movimientos `DEBE` en CC y abona las cuotas (R11/R12b). |
| POST | `/solicitudes-pago/:id/anular` | Reversa por contramovimiento (R5). |

**Proformas de servicios** (prefijo `/api/productores`)
| Método | Ruta | Notas |
|---|---|---|
| GET/POST/PATCH | `/proformas-servicio[/:id]` | Detalle con `ConceptoLiquidacion` (R14). Editable solo en `BORRADOR`. |
| POST | `/proformas-servicio/:id/enviar-validacion` | Pasa a `ENVIADA_VALIDACION`; queda visible en el confirmador de `cobranza.md`. |

> La **emisión** de la factura de venta (DTE 33/34) ocurre en `cobranza.md` (Ventas Nacionales), no aquí.

**Conceptos de liquidación** (prefijo `/api/config`)
| Método | Ruta | Notas |
|---|---|---|
| GET | `/conceptos-liquidacion` | Lista (no eliminados). |
| GET | `/conceptos-liquidacion/:id` | Cabecera + matriz de valores por especie. |
| POST | `/conceptos-liquidacion` | `{ codigo, descripcion, formaAplicacion, naturaleza, valores:[{especieId, valor}] }`. |
| PATCH | `/conceptos-liquidacion/:id` | Edita cabecera y/o matriz. |
| DELETE | `/conceptos-liquidacion/:id` | Softdelete. |

---

## 7. Frontend (`fas-web/app/(app)/productores/`)

- **Listado de productores:** tabla (entidades PRODUCTOR) con búsqueda; acceso a la ficha.
- **Ficha de productor:** datos de entidad (reutiliza Entidades) con foco en **representante legal** (contacto con RUT obligatorio) + pestañas:
  - **Predios:** grilla (código, descripción, códigos CSG/SDP/GGN, dirección, comuna, tipo producción, zona, geo). Alta/edición.
  - **Contrato:** subida de PDF + **sección independiente** con las condiciones (valores/condiciones de facturación, condiciones de pago, volumen comprometido + % cumplimiento, mínimo garantizado).
  - **Cuenta corriente:** informe con debes/haberes y **saldo corriente**; alta de movimientos por tipo.
- **Conceptos de liquidación** (Configuración o Productores): primero la cabecera (código, descripción, **forma de aplicación**: por kilo / por caja / % venta / monto total; **naturaleza**: cobro/abono) y luego la **tabla de especies** con el valor de cada una (estilo lista de precios). Responsivo (E5).

---

## 8. Criterios de aceptación (Given / When / Then)

- **CA1 (R1):** Crear predio sobre una entidad sin tipo PRODUCTOR → 422.
- **CA2 (R2):** Dos predios del mismo productor con igual código → 422; mismo código en otro productor → OK.
- **CA3 (R3):** Marcar contacto como representante legal sin RUT → 422 (regla de entidades).
- **CA4 (R4):** Asociar un PDF al contrato y registrar volumen comprometido = 10.000 kg; la ficha muestra el contrato y la sección de condiciones.
- **CA5 (R5b):** Con HABER 1.000 y DEBE 300, el saldo del informe = 700.
- **CA6 (R6):** Movimiento `DEBE` con un tipo cuya naturaleza es `HABER` → 422; con tipo `AMBOS` → OK.
- **CA7 (R5 inmutable):** No existe endpoint para editar/borrar un movimiento de CC; se corrige con reverso.
- **CA8 (R7):** Concepto "ASOEX" forma `POR_CAJA` naturaleza `COBRO`, con valores por especie; duplicar la misma especie en el concepto → 422.
- **CA9 (R7 signo):** Un concepto `ABONO` suma y uno `COBRO` resta al aplicarse (validable en el cálculo de liquidación — Etapa 3).
- **CA10 (matriz):** `GET /conceptos-liquidacion/:id` devuelve la cabecera y el valor por cada especie configurada.

---

## 9. Plan de implementación (orden para Claude Code)

1. Enums + modelos `Predio`, `ProductorContrato`, `MovimientoCuentaCorriente`, `ConceptoLiquidacion(+Especie)` + migración + back-relations.
2. Confirmar cambio de `EntidadContacto` (representante legal + RUT) y `TipoCuentaCorriente` (maestros) en el schema.
3. Service de predios (R1/R2) + contratos (R4, subida PDF).
4. Service de cuenta corriente (R5/R6) + informe con saldo.
5. Service de conceptos de liquidación (R7, matriz por especie).
6. Rutas de §6.
7. Tests CA1–CA10.
8. Frontend: listado → ficha con pestañas (predios / contrato / cuenta corriente) + mantenedor de conceptos.

---

## 10. Definition of Done

- [ ] Modelos migrados + back-relations + cambios en Entidad/Mantenedores aplicados.
- [ ] Endpoints de §6 con reglas R1–R8.
- [ ] Informe de cuenta corriente con saldo correcto.
- [ ] Mantenedor de conceptos (lista de precios por especie) operativo.
- [ ] Tests CA1–CA10 en verde.
- [ ] Ficha de productor responsiva con pestañas de predios, contrato y cuenta corriente.
- [ ] Decisiones de Etapa 3 de §3 resueltas antes de cerrar el cálculo de liquidación.
- [ ] Schema incorporado al `CLAUDE.md` global.
