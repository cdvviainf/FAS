# Anexo a entidades.md — Campos de Cliente para Cobranza

Este contenido debe incorporarse al spec de Entidades (`entidades.md`, pendiente). Los modelos completos de `FormaPago` y `PlantillaCobranza` referenciados aquí se definen en `cobranza.md` y `cobranza-gestion.md` respectivamente — este anexo solo agrega los campos y relaciones del lado de `Cliente`.

## Campos nuevos en `Cliente`

```prisma
model Cliente {
  // ...campos existentes del maestro de Cliente...

  lineaCredito              Decimal   @db.Decimal(12, 2)
  estadoActivo              Boolean   @default(true)     // inactivo = no operable; distinto del bloqueo automático por score
  plantillaCobranzaDefaultId Int?                          // FK a PlantillaCobranza (cobranza-gestion.md)

  formasPagoHabilitadas     ClienteFormaPago[]
  contactosPais             ClientePaisContacto[]
}
```

## Nuevos modelos

```prisma
model ClienteFormaPago {
  id          Int       @id @default(autoincrement())
  clienteId   Int
  cliente     Cliente   @relation(fields: [clienteId], references: [id])
  formaPagoId Int                                  // FK a FormaPago (cobranza.md)
  habilitado  Boolean   @default(true)

  @@unique([clienteId, formaPagoId])
}

model ClientePaisContacto {
  id        Int      @id @default(autoincrement())
  clienteId Int
  cliente   Cliente  @relation(fields: [clienteId], references: [id])
  pais      String
  emails    String[]                               // uno o más correos para ese país

  @@unique([clienteId, pais])
}
```

## Reglas relevantes para Entidades

- **EA1** — Solo se agregan países explícitamente asociados a un cliente (`ClientePaisContacto`), **no** se precarga la lista completa de países existentes en el sistema.
- **EA2** — Un cliente puede tener 0, 1 o varios `ClientePaisContacto`; si un embarque tiene un país de destino sin contacto configurado, el envío de gestión de cobranza (`cobranza-gestion.md`) debe señalar el caso en vez de fallar silenciosamente.
- **EA3** — `Cliente.estadoActivo = false` (inactivo) es una decisión manual del área comercial, independiente del `bloqueado` que calcula el motor de score (`cobranza-score-riesgo.md`). Ambos estados deben mostrarse por separado en la ficha de cliente.
- **EA4** — Al crear una Nota de Venta, Ventas debe validar tanto `Cliente.estadoActivo` (aquí) como el estado de crédito derivado del score (`GET /api/ventas/cobranza/score/clientes/:id/estado-credito`) — son dos chequeos independientes.
- **EA5** — `ClienteFormaPago.habilitado` determina qué Formas de Pago puede elegir Ventas para ese cliente al generar el embarque/proforma en `cobranza.md`.

## Nota sobre el bloqueo por score

`Cliente.bloqueado` **no** es un campo editable de este maestro — es un valor derivado, calculado y expuesto por `cobranza-score-riesgo.md`. Entidades no debe agregar una columna `bloqueado` editable; cualquier pantalla que necesite mostrarlo debe consultar el endpoint de estado de crédito.
