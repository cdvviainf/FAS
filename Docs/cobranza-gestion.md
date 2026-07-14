# Cobranza — Ventana de Gestión y Envío de Correos

**Sección:** Ventas · **Etapa:** 1 · **Estado:** ✅ Listo para implementación
**Key user:** María José (Cobranza)
**Prefijo API:** `/api/ventas/cobranza/gestion`

Documento relacionado: `cobranza.md` (Facturas y Cuotas, base de este listado).

---

## 0. Contexto

Ventana operativa de uso diario: María José necesita ver los vencimientos pendientes, filtrarlos, seleccionar un subconjunto y despachar un correo de cobranza usando una plantilla — todo dejando registro de qué gestión se hizo sobre cada embarque/cliente.

---

## 1. Objetivo

1. Listar Cuotas pendientes/vencidas con filtros operativos.
2. Permitir selección múltiple y envío de un correo de cobranza por cliente, agrupando los vencimientos seleccionados.
3. Mantener un catálogo de **Plantillas de correo** con campos dinámicos, asociables por defecto a cada cliente.
4. Enviar cada correo a la o las casillas correctas según el **país de destino** del embarque.
5. Dejar **historial** de cada envío, visible desde el embarque/factura y desde el cliente.

---

## 2. Alcance

### Construye
- Listado de Cuotas pendientes/vencidas con filtros: Cliente, Tipo de embarque, País destino, rango de fechas de vencimiento, Estado (Pendiente/Vencido).
- Selección múltiple (checkbox) de vencimientos.
- Selector de Plantilla de correo, con precarga de la plantilla predeterminada del cliente si existe.
- Envío de correo individual por cliente, agrupando los vencimientos seleccionados de ese cliente en un solo mensaje.
- Autoselección de destinatarios según el país de destino de cada documento incluido.
- Mantenedor de **Plantillas de correo** con campos dinámicos (merge fields).
- Mantenedor de **Configuración SMTP** (host, puerto, usuario, password, remitente).
- **Historial de envíos** por embarque/factura y por cliente.
- Registro adicional de **notas de gestión libres** (heredado del alcance original de Cobranza — bitácora sin flujo de estados).

### NO construye
- Motor de Score (`cobranza-score-riesgo.md`).
- Emisión/edición de documentos tributarios (`cobranza.md`).
- Asociación de contactos de correo por país al Cliente, ni la plantilla predeterminada por cliente — esos **campos** viven en `entidades.md` (anexo); aquí solo se consumen.
- Envío por WhatsApp/SMS.
- Envíos automáticos/programados (cron) — este spec cubre solo despacho manual bajo demanda.

---

## 3. Decisiones cerradas (default)

| # | Decisión |
|---|---|
| D1 | El envío es **manual**, bajo demanda del usuario. No hay recordatorios automáticos en este spec. |
| D2 | Un correo por cliente, agrupando todos los vencimientos seleccionados de ese cliente en un mismo envío (no uno por cuota). |
| D3 | Los destinatarios se **autoseleccionan** según el país de destino de cada documento incluido (fuente: contactos de país por cliente, definidos en `entidades.md`). Si el envío agrupa documentos de más de un país destino para el mismo cliente, se despacha una copia a cada casilla asociada a esos países. |
| D4 | Cada cliente puede tener una plantilla predeterminada (`entidades.md`); si no la tiene, el usuario debe elegir una manualmente antes de enviar. |
| D5 | El historial de envíos queda asociado tanto a nivel de Factura/Cuota como de Cliente, para poder ver qué gestión se hizo sobre cada embarque. |
| D6 | La configuración SMTP es única a nivel de sistema (no por cliente ni por usuario). |
| D7 | El contenido final enviado (asunto y cuerpo ya resueltos con los merge fields) se guarda como snapshot inmutable en el historial, independiente de cambios posteriores a la plantilla original. |

---

## 4. Modelo de datos (Prisma)

```prisma
enum EstadoEnvioGestion {
  ENVIADO
  ERROR
}

model PlantillaCobranza {
  id         Int      @id @default(autoincrement())
  nombre     String
  asunto     String                        // admite campos dinámicos, ej. {{cliente}}
  cuerpoHtml String                        // admite campos dinámicos
  activo     Boolean  @default(true)
  creadoEn   DateTime @default(now())
}

// La asociación "plantilla predeterminada por cliente" vive en Cliente.plantillaCobranzaDefaultId (entidades.md)

model ConfiguracionSmtp {
  id              Int      @id @default(autoincrement())
  host            String
  puerto          Int
  usuario         String
  passwordCifrado String                    // write-only, nunca se expone en la API
  remitenteNombre String
  remitenteEmail  String
  usarTls         Boolean  @default(true)
  activo          Boolean  @default(true)
  actualizadoEn   DateTime @updatedAt
}

model GestionEnvioCobranza {
  id           Int                             @id @default(autoincrement())
  clienteId    Int
  plantillaId  Int
  plantilla    PlantillaCobranza               @relation(fields: [plantillaId], references: [id])
  destinatarios String[]                                        // correos efectivamente usados
  asuntoFinal  String                                            // snapshot ya resuelto
  cuerpoFinal  String                                            // snapshot ya resuelto
  estado       EstadoEnvioGestion
  errorDetalle String?
  documentos   GestionEnvioCobranzaDocumento[]
  creadoPorId  String
  creadoEn     DateTime                        @default(now())

  @@index([clienteId])
}

model GestionEnvioCobranzaDocumento {
  id             Int                  @id @default(autoincrement())
  gestionEnvioId Int
  gestionEnvio   GestionEnvioCobranza @relation(fields: [gestionEnvioId], references: [id])
  facturaId      Int                                    // Factura DTE (cobranza.md)
  cuotaId        Int?                                   // opcional: si fue una cuota específica

  @@index([facturaId])
}

// Bitácora libre (CRM básico), independiente de los envíos de correo
model NotaGestionCobranza {
  id          Int      @id @default(autoincrement())
  clienteId   Int
  facturaId   Int?
  comentario  String
  creadoPorId String
  creadoEn    DateTime @default(now())

  @@index([clienteId])
  @@index([facturaId])
}
```

---

## 5. Reglas / invariantes

- **CB1** — El listado base son Cuotas (`cobranza.md`) con `estado` en `PENDIENTE`, `PARCIAL` o `VENCIDA` (excluye `PAGADA`).
- **CB2** — El filtro "Tipo de embarque" usa `Embarque.tipoEmbarqueId`; "País destino" usa `Embarque.paisDestino` (ambos leídos desde `cobranza.md`/Embarque).
- **CB3** — Al enviar, el sistema agrupa las cuotas seleccionadas por `clienteId` y genera un `GestionEnvioCobranza` por cada combinación (cliente, conjunto de casillas determinado por los países de destino involucrados) — D3.
- **CB4** — Los merge fields disponibles incluyen al menos: `{{cliente}}`, `{{lista_documentos}}`, `{{monto_total}}`, `{{moneda}}`, `{{fecha_envio}}`. Antes de enviar, se resuelven y se guardan como `asuntoFinal`/`cuerpoFinal` (D7).
- **CB5** — Un envío fallido (error SMTP) se registra igual con `estado = ERROR` y su detalle, sin bloquear el resto de los envíos del lote.
- **CB6** — `ConfiguracionSmtp.passwordCifrado` nunca se expone en las respuestas de la API (solo escritura).
- **CB7** — Si un cliente no tiene plantilla predeterminada ni el usuario elige una, el envío no procede (validación de formulario, no de backend únicamente).

---

## 6. Contratos API

Prefijo: `/api/ventas/cobranza/gestion`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/vencimientos` | Listado de cuotas pendientes/vencidas. Filtros: `clienteId`, `tipoEmbarqueId`, `paisDestino`, `vencimientoDesde`, `vencimientoHasta`, `estado`. |
| GET/POST/PATCH | `/plantillas` | Mantenedor de `PlantillaCobranza`. |
| GET/PATCH | `/configuracion-smtp` | Mantenedor de `ConfiguracionSmtp` (respuesta nunca incluye el password). |
| POST | `/envios` | Despacha el/los correos: `{ cuotaIds: number[], plantillaId?: number }`. Si `plantillaId` se omite, usa la plantilla predeterminada de cada cliente incluido; si algún cliente no tiene una y no se especificó, retorna error indicando qué clientes requieren selección manual. |
| GET | `/envios` | Historial. Filtros: `clienteId`, `facturaId`, `desde`, `hasta`. |
| POST | `/notas` | Crea una `NotaGestionCobranza`. |
| GET | `/notas` | Lista notas. Filtros: `clienteId`, `facturaId`. |

---

## 7. Frontend

- **Ventana de Gestión de Cobranza**: tabla de vencimientos con filtros de §6, checkboxes de selección, contador de "N cuotas seleccionadas de M clientes", selector de plantilla (con default sugerido), botón "Enviar".
- **Confirmación de envío**: previsualización del correo resuelto (con merge fields aplicados) antes de despachar, por cada cliente agrupado.
- **Historial**: en el detalle de Factura/Embarque y en la ficha de Cliente, timeline combinando `GestionEnvioCobranza` y `NotaGestionCobranza` en orden cronológico.
- **Mantenedores** (admin): Plantillas (editor con lista de merge fields disponibles) y Configuración SMTP.

---

## 8. Criterios de aceptación (Given/When/Then)

- **GC-T1**: Dadas 3 cuotas vencidas de 2 clientes distintos, cuando se seleccionan las 3 y se envía, entonces se generan 2 `GestionEnvioCobranza` (uno por cliente) — CB3.
- **GC-T2**: Dado un cliente con documentos de 2 países de destino distintos en el mismo envío, cuando se despacha, entonces se genera una copia del correo a cada casilla asociada a esos países — D3.
- **GC-T3**: Dado un cliente sin plantilla predeterminada, cuando se intenta enviar sin elegir plantilla manualmente, entonces la API rechaza indicando qué cliente requiere selección — CB7.
- **GC-T4**: Dado un envío que falla por error SMTP, cuando se consulta el historial, entonces aparece con `estado = ERROR` y su detalle, y los demás envíos del lote no se ven afectados — CB5.
- **GC-T5**: Dado el mantenedor de Configuración SMTP, cuando se consulta vía API, entonces la respuesta nunca incluye `passwordCifrado` — CB6.

---

## 9. Plan de implementación

1. Migraciones Prisma de §4.
2. Servicio `EnvioGestionService`: resolución de merge fields, agrupación por cliente/país (CB3/CB4), envío vía SMTP configurado, manejo de errores por envío individual (CB5).
3. Endpoints de §6.
4. Frontend de §7.
5. Coordinar con el anexo de `entidades.md` la disponibilidad de `Cliente.plantillaCobranzaDefaultId` y `ClientePaisContacto` antes de integrar la autoselección de destinatarios (D3/D4).
6. Tests de GC-T1 a GC-T5.

---

## 10. Definition of Done

- [ ] Migraciones aplicadas.
- [ ] Endpoints de §6 implementados y documentados.
- [ ] Reglas CB1–CB7 cubiertas por al menos un test.
- [ ] Criterios GC-T1–GC-T5 pasando.
- [ ] Envío de prueba real validado contra la Configuración SMTP definitiva.
- [ ] Anexo de `entidades.md` (contactos por país, plantilla default) confirmado e integrado.
- [ ] Revisión de Codex sin hallazgos críticos abiertos.
