# Cobranza — Score de Riesgo Crediticio

**Sección:** Ventas · **Etapa:** 1 · **Estado:** ⚠️ Listo para implementación, con 1 punto pendiente (ver §3)
**Key user:** María José (Cobranza), Fabián (Finanzas) · **Consumidor:** Ventas (bloqueo al crear Nota de Venta)
**Prefijo API:** `/api/ventas/cobranza/score`

Documento relacionado: `cobranza.md` (Facturas, Cuotas, NC/ND — de donde este motor obtiene sus insumos).

---

## 0. Contexto

Agrosan califica a cada cliente con una **nota de 1.0 a 7.0** (escala académica chilena), combinando dos grupos de factores:

1. **Conducta de pago** (4 parámetros: morosidad ponderada, deuda vencida, impacto financiero, deuda total).
2. **Riesgo Claim** (3 parámetros: valor reclamado, tasa de reclamos, días de cierre).

La nota final determina una clasificación (Bajo/Medio/Alto/Muy alto) y, combinada con la mora ponderada, si el cliente queda **Bloqueado** para nuevas Notas de Venta. Todo el motor es paramétrico vía mantenedores (escalas y ponderadores), porque las tablas de calificación cambian con el tiempo y **el score de un cliente cambia solo por el paso de los días**, incluso sin que se registre ningún pago, documento o reclamo nuevo (la mora aumenta día a día).

---

## 1. Objetivo

1. Calcular, para cada cliente, una nota de **Conducta de Pago** (1.0–7.0).
2. Calcular, para cada cliente, una nota de **Riesgo Claim** (1.0–7.0).
3. Combinar ambas en una **Nota Final**, con la regla de que Claim solo puede empeorar el resultado, nunca mejorarlo.
4. Clasificar al cliente (Bajo / Medio / Alto / Muy alto) y determinar si queda **Bloqueado**.
5. Exponer un endpoint de **estado de crédito** que el módulo de Ventas consulta antes de crear una Nota de Venta.
6. Permitir una **autorización de excepción puntual** (sobregiro o desbloqueo) válida solo para una Nota de Venta específica.

---

## 2. Alcance

### Construye
- Mantenedores de escalas de calificación (rango → nota) para cada uno de los 7 parámetros.
- Mantenedores de ponderadores (pesos) para cada combinación, y de la tasa mensual financiera (con histórico).
- Motor de cálculo de las 7 notas, la Nota de Pago, la Nota Claim y la Nota Final.
- Determinación de clasificación y de bloqueo automático.
- Registro histórico de cada cálculo de score (auditoría).
- Autorización de excepción de crédito puntual (sobregiro/bloqueo), con registro de quién, cuándo y motivo, válida para una sola Nota de Venta.
- Endpoint de estado de crédito consumible por Ventas.

### NO construye
- La creación/edición de la Nota de Venta en sí (spec de Ventas, pendiente) — este documento solo define el endpoint de consulta que Ventas debe invocar.
- Línea de crédito, estado activo/inactivo del cliente (mantenedor de Cliente) → viven en `entidades.md`; aquí solo se leen.
- Emisión de documentos y cuotas (`cobranza.md`) — este motor solo lee `Cuota.saldoPendiente` y fechas de vencimiento.
- Reclamos/Claims/Provisión (spec Reclamos) — este motor solo lee montos y fechas agregadas.
- **Frecuencia y mecanismo de recálculo (batch vs. tiempo real)** — explícitamente pendiente, ver §3.

---

## 3. Decisiones cerradas (default) — y lo pendiente

| # | Decisión |
|---|---|
| D1 | Escala de nota: 1.0 a 7.0. Clasificación: Bajo 6.0–7.0, Medio 5.0–5.9, Alto 4.0–4.9, Muy alto 1.0–3.9. |
| D2 | Bloqueado = Clasificación `MUY_ALTO` **y** mora ponderada > `umbralMoraBloqueoDias` (default 30). Es puramente automático; no existe un bloqueo manual por score. |
| D3 | El estado **Inactivo** de un cliente es independiente del bloqueo por score y vive en el mantenedor de Cliente (`entidades.md`) — no se calcula aquí. |
| D4 | Mora ponderada (días) se calcula sobre **todas** las Cuotas con `saldoPendiente > 0` del cliente (vencidas o no), ponderando por `saldoPendiente`. Las cuotas no vencidas aportan 0 días pero sí pesan en el denominador. *(Supuesto a confirmar — ver ejemplo en §5.)* |
| D5 | Deuda vencida (corto/largo plazo) se combina en **una sola nota ponderada** para ese parámetro (dos sub-notas con pesos propios, no dos parámetros separados). |
| D6 | El umbral que separa "corto" de "largo" plazo (`umbralCortoPlazoDias`, default 15) se mide sobre los días de mora **de cada cuota individual**, no del documento completo — un documento con 2 cuotas se evalúa como 2 unidades independientes. |
| D7 | Tasa financiera es **mensual**, con histórico versionado (vigencia por rango de fechas). |
| D8 | Fórmula de Impacto Financiero: para cada cuota con saldo pendiente, `pctImpacto = (1 + tasaMensualVigente) ^ (diasMora / 30) − 1` (equivalente a la función FV de Excel aplicada a fracciones de mes), ponderado por `saldoPendiente`. *(Fórmula asumida a partir de "la fórmula que usa Excel para VF" — confirmar antes de implementar.)* |
| D9 | Deuda Total = (Σ saldoPendiente de todas las cuotas, vencidas o no) / línea de crédito del cliente. Mide el uso total de la línea, a diferencia de Deuda Vencida que solo mide lo vencido. |
| D10 | Los 4 pesos de Conducta de Pago suman 100%. Los 3 pesos de Riesgo Claim suman 100%. El peso Pago/Claim final (ej. 80/20) es un mantenedor global. |
| D11 | Valor Reclamado, Reclamos (tasa) y Días de Cierre se calculan sobre la **temporada actual** (no histórico acumulado). |
| D12 | Días de Cierre: para reclamos cerrados, `fechaCierre − fechaReclamo`; para reclamos abiertos, `hoy − fechaReclamo`. |
| D13 | Regla de combinación final: si `notaClaim < notaPago` (peor), `notaFinal = notaPago × pesoPago + notaClaim × pesoClaim`. Si `notaClaim >= notaPago`, `notaFinal = notaPago` (Claim nunca mejora el resultado). |
| D14 | La autorización de excepción de crédito requiere: cliente/usuario que autoriza, texto de motivo obligatorio, y queda ligada a una única Nota de Venta (`notaVentaId`); una vez usada, no vuelve a aplicar. |
| **⏳ Pendiente** | **Frecuencia y mecanismo de recálculo del score** (tiempo real vs. batch nocturno vs. bajo demanda). No fue definido por el negocio. Recomendación de default (a confirmar): recálculo nocturno para toda la cartera + recálculo inmediato del cliente afectado tras registrar un pago, emitir NC/ND, o cerrar un reclamo. El endpoint de estado de crédito (§6) siempre puede forzar un recálculo síncrono si la última snapshot es de otro día. |

---

## 4. Modelo de datos (Prisma)

```prisma
enum TipoEscalaScore {
  MOROSIDAD
  DEUDA_VENCIDA_CORTO
  DEUDA_VENCIDA_LARGO
  IMPACTO_FINANCIERO
  DEUDA_TOTAL
  VALOR_RECLAMADO
  RECLAMOS
  DIAS_CIERRE
}

enum TipoPonderacionScore {
  PAGO_MOROSIDAD
  PAGO_DEUDA_VENCIDA
  PAGO_IMPACTO_FINANCIERO
  PAGO_DEUDA_TOTAL
  DEUDA_VENCIDA_CORTO_SUBPESO
  DEUDA_VENCIDA_LARGO_SUBPESO
  CLAIM_VALOR_RECLAMADO
  CLAIM_RECLAMOS
  CLAIM_DIAS_CIERRE
  FINAL_PAGO
  FINAL_CLAIM
}

enum ClasificacionScore {
  BAJO
  MEDIO
  ALTO
  MUY_ALTO
}

model EscalaCalificacionScore {
  id             Int             @id @default(autoincrement())
  tipo           TipoEscalaScore
  rangoDesde     Decimal         @db.Decimal(10, 4)
  rangoHasta     Decimal         @db.Decimal(10, 4)
  nota           Decimal         @db.Decimal(3, 2)     // 1.00 a 7.00
  vigenteDesde   DateTime        @default(now())
  vigenteHasta   DateTime?

  @@index([tipo, vigenteDesde])
}

model PonderacionScore {
  id           Int                   @id @default(autoincrement())
  tipo         TipoPonderacionScore
  peso         Decimal               @db.Decimal(5, 2)  // %
  vigenteDesde DateTime              @default(now())
  vigenteHasta DateTime?

  @@index([tipo, vigenteDesde])
}

model TasaMensualFinanciera {
  id           Int       @id @default(autoincrement())
  valor        Decimal   @db.Decimal(6, 4)   // tasa mensual, ej. 0.0150 = 1.5%
  vigenteDesde DateTime
  vigenteHasta DateTime?
}

model ConfiguracionScore {
  id                    Int       @id @default(autoincrement())
  umbralCortoPlazoDias  Int       @default(15)
  umbralMoraBloqueoDias Int       @default(30)
  vigenteDesde          DateTime  @default(now())
  vigenteHasta          DateTime?
}

model ScoreCliente {
  id                    Int                  @id @default(autoincrement())
  clienteId             Int
  fechaCalculo          DateTime             @default(now())
  notaMorosidad         Decimal              @db.Decimal(3, 2)
  notaDeudaVencida      Decimal              @db.Decimal(3, 2)
  notaImpactoFinanciero Decimal              @db.Decimal(3, 2)
  notaDeudaTotal        Decimal              @db.Decimal(3, 2)
  notaPago              Decimal              @db.Decimal(3, 2)
  notaValorReclamado    Decimal              @db.Decimal(3, 2)
  notaReclamos          Decimal              @db.Decimal(3, 2)
  notaDiasCierre        Decimal              @db.Decimal(3, 2)
  notaClaim             Decimal              @db.Decimal(3, 2)
  notaFinal             Decimal              @db.Decimal(3, 2)
  clasificacion         ClasificacionScore
  moraPonderadaDias     Decimal              @db.Decimal(8, 2)
  bloqueado             Boolean
  detalleCalculo        Json                                    // snapshot completo de insumos usados (auditoría)

  @@index([clienteId, fechaCalculo])
}

model AutorizacionExcepcionCredito {
  id              Int      @id @default(autoincrement())
  clienteId       Int
  notaVentaId     Int                          // válida solo para esta Nota de Venta
  motivo          String
  autorizadoPorId String
  fecha           DateTime @default(now())
  usada           Boolean  @default(false)

  @@index([clienteId])
  @@index([notaVentaId])
}
```

**Nota:** `Cliente.lineaCredito` y el estado Inactivo pertenecen a `entidades.md`; este motor los lee vía `clienteId`, no los redefine.

---

## 5. Fórmulas y reglas de cálculo

### 5.1 Mora ponderada (días)

```
moraPonderada = Σ(saldoPendiente_i × diasMora_i) / Σ(saldoPendiente_i)
```
sobre todas las Cuotas del cliente con `saldoPendiente > 0` (D4). `diasMora_i = max(0, hoy − fechaVencimiento_i)`.

Ejemplo del negocio:
```
Factura 1: USD 50.000, 40 días de mora
Factura 2: USD 20.000, 30 días de mora
moraPonderada = (50.000×40 + 20.000×30) / 70.000 = 34,3 días
```

### 5.2 Conducta de pago (4 parámetros)

1. **Morosidad ponderada** → `notaMorosidad = escala(MOROSIDAD, moraPonderada)`.
2. **Deuda vencida** (corto + largo plazo, D5/D6):
   - `deudaVencidaCorto = Σ saldoPendiente` de cuotas vencidas con `diasMora ≤ umbralCortoPlazoDias`
   - `deudaVencidaLargo = Σ saldoPendiente` de cuotas vencidas con `diasMora > umbralCortoPlazoDias`
   - `pctCorto = deudaVencidaCorto / lineaCredito`, `pctLargo = deudaVencidaLargo / lineaCredito`
   - `notaCorto = escala(DEUDA_VENCIDA_CORTO, pctCorto)`, `notaLargo = escala(DEUDA_VENCIDA_LARGO, pctLargo)`
   - `notaDeudaVencida = notaCorto × pesoCorto + notaLargo × pesoLargo`
3. **Impacto financiero** (D8):
   - Por cuota con saldo pendiente: `pctImpacto_i = (1 + tasaMensualVigente)^(diasMora_i/30) − 1`
   - `pctImpactoPonderado = Σ(saldoPendiente_i × pctImpacto_i) / Σ(saldoPendiente_i)`
   - `notaImpactoFinanciero = escala(IMPACTO_FINANCIERO, pctImpactoPonderado)`
4. **Deuda total** (D9): `pctDeudaTotal = Σ saldoPendiente (todas las cuotas) / lineaCredito` → `notaDeudaTotal = escala(DEUDA_TOTAL, pctDeudaTotal)`

```
notaPago = notaMorosidad × pesoMorosidad
         + notaDeudaVencida × pesoDeudaVencida
         + notaImpactoFinanciero × pesoImpactoFinanciero
         + notaDeudaTotal × pesoDeudaTotal
```
(pesos suman 100%, D10)

### 5.3 Riesgo Claim (3 parámetros, temporada actual — D11)

1. **Valor Reclamado**: `pct = (Σ monto Provisión VIGENTE + Σ monto Claims cerrados) / Σ Total Ventas del cliente en la temporada` → `notaValorReclamado = escala(VALOR_RECLAMADO, pct)`
2. **Reclamos**: `pct = Embarques con reclamo / Embarques totales del cliente en la temporada` → `notaReclamos = escala(RECLAMOS, pct)`
3. **Días de Cierre** (D12): promedio de (`fechaCierre − fechaReclamo`) para cerrados, y (`hoy − fechaReclamo`) para abiertos → `notaDiasCierre = escala(DIAS_CIERRE, promedio)`

```
notaClaim = notaValorReclamado × pesoValorReclamado
          + notaReclamos × pesoReclamos
          + notaDiasCierre × pesoDiasCierre
```
(pesos suman 100%)

### 5.4 Nota final y clasificación

```
si notaClaim < notaPago:
    notaFinal = notaPago × pesoPagoFinal + notaClaim × pesoClaimFinal   (ej. 80/20)
si no:
    notaFinal = notaPago
```
(D13 — Claim nunca mejora el resultado)

Clasificación por `notaFinal` (D1). `bloqueado = (clasificacion == MUY_ALTO) && (moraPonderada > umbralMoraBloqueoDias)` (D2).

---

## 6. Contratos API

Prefijo: `/api/ventas/cobranza/score`

| Método | Ruta | Descripción |
|---|---|---|
| GET/POST/PATCH | `/mantenedores/escalas` | CRUD de `EscalaCalificacionScore` por tipo, con vigencia. |
| GET/POST/PATCH | `/mantenedores/ponderaciones` | CRUD de `PonderacionScore` por tipo, con vigencia. |
| GET/POST | `/mantenedores/tasa-mensual` | Histórico de tasa financiera mensual. |
| GET/PATCH | `/mantenedores/configuracion` | Umbrales (corto plazo, bloqueo por mora). |
| GET | `/clientes/:id` | Último `ScoreCliente` calculado, con el desglose de las 7 notas. |
| POST | `/clientes/:id/recalcular` | Fuerza el recálculo síncrono (bajo demanda). |
| GET | `/clientes/:id/historico` | Serie histórica de `ScoreCliente` (para gráfico de evolución). |
| GET | `/clientes/:id/estado-credito` | `{ habilitado, bloqueado, lineaCredito, deudaTotal, excepcionVigente }` — endpoint que Ventas consulta al crear una Nota de Venta. |
| POST | `/clientes/:id/excepcion-credito` | Crea una `AutorizacionExcepcionCredito` para una `notaVentaId` específica. Requiere permiso de acción `AutorizarExcepcionCredito`. |

---

## 7. Frontend

- **Mantenedores** (admin): pantallas CRUD para escalas, ponderaciones, tasa mensual y configuración de umbrales, todas con historial de vigencia visible.
- **Ficha de cliente — pestaña Score**: nota final grande con badge de clasificación, desglose de las 7 notas individuales (con su peso), mora ponderada, y gráfico simple de evolución histórica.
- **Botón "Autorizar excepción"**: visible solo para perfiles con el permiso de acción correspondiente, disponible en el flujo de creación de Nota de Venta cuando el cliente está bloqueado o excede línea de crédito. Pide motivo obligatorio.

---

## 8. Criterios de aceptación (Given/When/Then)

- **SC-T1**: Dadas las dos facturas del ejemplo de negocio (§5.1), cuando se calcula la mora ponderada, entonces el resultado es 34,3 días.
- **SC-T2**: Dado un cliente con clasificación `MUY_ALTO` y mora ponderada de 25 días (umbral 30), cuando se consulta su estado de crédito, entonces `bloqueado = false`.
- **SC-T3**: Dado un cliente con clasificación `MUY_ALTO` y mora ponderada de 35 días, cuando se consulta su estado de crédito, entonces `bloqueado = true`.
- **SC-T4**: Dada una `notaClaim` de 6.0 y una `notaPago` de 5.0 (Claim mejor que Pago), cuando se calcula la nota final, entonces `notaFinal = notaPago = 5.0` (D13).
- **SC-T5**: Dada una `notaClaim` de 3.0 y una `notaPago` de 5.0 (Claim peor), cuando se calcula la nota final con pesos 80/20, entonces `notaFinal = 5.0×0.8 + 3.0×0.2 = 4.6`.
- **SC-T6**: Dada una `AutorizacionExcepcionCredito` usada en una Nota de Venta, cuando se intenta crear una segunda Nota de Venta para el mismo cliente bloqueado, entonces el estado de crédito vuelve a reportar `bloqueado = true` (la excepción no se reutiliza).

---

## 9. Plan de implementación

1. Migraciones Prisma de §4.
2. Cargar mantenedores iniciales (escalas, pesos, tasa mensual, configuración) con los valores que entregue Fabián/Alejandro.
3. Servicio `ScoreCalculoService` implementando §5, con `detalleCalculo` (Json) guardando cada insumo usado, para auditoría y para poder explicarle a un usuario por qué un cliente quedó bloqueado.
4. Endpoint `/estado-credito` con caché de corto plazo (evitar recalcular en cada request de Ventas).
5. Definir junto a Christian/Alejandro el mecanismo de recálculo pendiente (§3) antes de poner esto en producción.
6. Endpoints de mantenedores y de excepción de crédito.
7. Frontend de §7.
8. Tests de SC-T1 a SC-T6, más al menos un test end-to-end con datos reales de un cliente de Alejandro Véliz.

---

## 10. Definition of Done

- [ ] Migraciones aplicadas.
- [ ] Fórmulas de §5 validadas con al menos 2 clientes reales (comparando contra un cálculo manual en Excel).
- [ ] Mecanismo de recálculo (§3, pendiente) decidido y documentado — **bloqueante para cerrar este spec como 100% completo**.
- [ ] Endpoint `/estado-credito` integrado con el flujo de creación de Nota de Venta.
- [ ] Excepción de crédito auditable (quién, cuándo, motivo, nota de venta) y de un solo uso.
- [ ] Revisión de Codex sin hallazgos críticos abiertos.
