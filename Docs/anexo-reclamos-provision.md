# Anexo al spec de Reclamos — Entidad Provisión

Este contenido debe incorporarse al spec de Reclamos/Claims (Calidad, pendiente). `cobranza.md` referencia `provisionId` en `NotaCredito` de forma opcional — este anexo define el modelo completo del lado de Reclamos.

## Contexto

Cuando existe un reclamo asociado a un embarque, se puede registrar una **Provisión**: una reserva de monto que reduce el saldo pendiente visible del cliente mientras el reclamo se resuelve, sin ser todavía un documento tributario. Más adelante puede (o no) convertirse en una Nota de Crédito sobre la Factura DTE del mismo embarque (`cobranza.md`).

## Modelo de datos

```prisma
enum TipoCalculoProvision {
  POR_UNIDAD_CAJA
  POR_PESO_KILO
  MONTO_FIJO
}

enum EstadoProvision {
  VIGENTE
  REVERSADA
}

model Provision {
  id                Int                   @id @default(autoincrement())
  reclamoId         Int                                          // obligatorio
  embarqueId        Int                                          // referencia a Embarque (cobranza.md / Despacho)
  tipoCalculo       TipoCalculoProvision
  valorUnitario     Decimal?              @db.Decimal(12, 4)      // ej. USD 1 por caja, USD 0,5 por kilo
  cantidadAfectada  Decimal?              @db.Decimal(12, 2)      // cajas o kilos reclamados
  montoFijo         Decimal?              @db.Decimal(12, 2)      // usado si tipoCalculo = MONTO_FIJO
  montoCalculado    Decimal               @db.Decimal(12, 2)      // resultado final, siempre poblado
  moneda            String
  estado            EstadoProvision       @default(VIGENTE)
  fechaCreacion     DateTime              @default(now())
  creadoPorId       String
  fechaReversa      DateTime?
  reversadoPorId    String?

  @@index([reclamoId])
  @@index([embarqueId])
}
```

## Reglas

- **PR1** — `reclamoId` es obligatorio; no existen Provisiones sin reclamo asociado.
- **PR2** — `cantidadAfectada` (cajas o kilos) no puede superar la cantidad total del embarque reclamado — se valida contra los datos ya cargados del embarque. Es habitual que el reclamo cubra solo una parte del embarque.
- **PR3** — Al reversar una Provisión, **cualquier usuario con permiso** puede hacerlo (no requiere ser quien la creó). La reversa cambia `estado = REVERSADA` y registra `fechaReversa`/`reversadoPorId`; **nunca se elimina**, queda visible en el historial.
- **PR4** — Una Provisión reversada puede o no derivar posteriormente en una Nota de Crédito — son dos pasos independientes que el usuario concilia.
- **PR5** — Mientras `estado = VIGENTE`, el monto de la Provisión reduce el saldo pendiente que ve Cobranza para ese cliente/embarque (es informativo/visual en la cartera, no altera los montos de las Cuotas en `cobranza.md`).
- **PR6** — Al emitir una NC en `cobranza.md` sobre la Factura del mismo embarque, si existe una Provisión `VIGENTE` para ese reclamo, el sistema debe alertar (no bloquear) y sugerir como monto inicial de la NC el `montoCalculado` de la provisión (editable). Ver `NotaCredito.provisionId` en `cobranza.md`.
- **PR7** — El monto de Provisiones `VIGENTE` (junto con los Claims cerrados) alimenta el parámetro "Valor Reclamado" del motor de Score (`cobranza-score-riesgo.md`, §5.3).

## Contratos API sugeridos (a incorporar en el spec de Reclamos)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/calidad/reclamos/:id/provisiones` | Crea una Provisión para el reclamo. Valida PR1/PR2. |
| GET | `/api/calidad/reclamos/:id/provisiones` | Lista provisiones del reclamo. |
| POST | `/api/calidad/provisiones/:id/reversar` | Reversa la provisión (PR3). |
| GET | `/api/calidad/embarques/:id/provision-vigente` | Consumido por `cobranza.md` para la alerta de PR6. |
