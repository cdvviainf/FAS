# Cobranza — Emisión de documentos, cuotas y pagos

**Sección:** Ventas · **Etapa:** 1 · **Estado:** 🟡 Proforma + Factura de Exportación (DTE 110) + Factura Nacional (DTE 33/34) + Cuotas + **Pagos / Saldo a Favor (Ciclo 2) + job diario VENCIDA (Ciclo 3) + NC de anulación (Ciclo 4, DTE 112/61) (2026-10-28)** construidos — pendiente: NC/ND parciales y por reclamo (resto del Ciclo 4)
**Key user:** María José (Cobranza) · **Relacionado:** Giovanni (Ventas), Fabián (Finanzas), Isella (Calidad)
**Prefijo API:** `/api/ventas/cobranza`

## 0.b Supersesión (2026-09-24) — Proforma de Exportación construida, reconciliación contra el código real

> Este spec (v2) se escribió antes de que existieran varias piezas que hoy ya están construidas en otros módulos. Se implementó **solo la Proforma** (objetivo 1 de §1, primer paso del plan de §9) — Factura DTE/Cuotas/NC-ND/Pagos/Saldo a Favor/Ventas Nacionales siguen **sin construir**, tal como los dejó este documento. Reconciliación aplicada a la Proforma:
>
> - **`FormaPago`/`FormaPagoCuota` (que este spec proponía crear) NO se crearon.** Ya existen como `CondicionPago`/`CondicionPagoCuota` (mismo mantenedor que usan Compras y Ventas) — la Proforma hereda `condicionPagoId` de la Nota de Venta del Embarque (decisión de negocio, Christian). Cuando se construya Factura DTE, sus `Cuota` reales deberán generarse igual desde `CondicionPago`, no desde un `FormaPago` nuevo.
> - **`clienteId`/`moneda: String` → `Entidad`/`Moneda` (FK reales)**, heredados de la Nota de Venta vía el Embarque — no editables, mismo criterio que Reclamos (RC-D4).
> - **`pdfUrl: String` → Motor de Documentos** (`DocumentoEmitido`, PDF en Bytes en Postgres, plantilla React+TSX vía Playwright) — se registró `'proforma'` en `documentos.registry.ts` con `controlCopia: false` (la emisión de negocio ya es definitiva al crear el registro — un solo paso, sin `BORRADOR` previo — así que no hay un segundo paso de "oficializar" el PDF, mismo criterio que Instructivo de Embarque/Embalaje).
> - **`numero: Int @unique` → `codigo: String`** generado vía `PrefijoCodigo` (modelo `'proforma'`, prefijo `PRF`, 4 dígitos), mismo mecanismo que el resto del sistema.
> - **`detalleFruta: Json` → líneas reales persistidas (`ProformaLinea`)**, no un blob. Decisión de negocio nueva (Christian, no estaba en el spec original): la Proforma puede facturar agrupado por **Especie siempre + cualquier combinación de Variedad/Artículo/Calibre/Categoría/Marca(Etiqueta)** elegida por el usuario al emitir — no siempre al detalle completo de cada `PalletLinea`. El monto de cada línea agrupada se sugiere sumando `cajas × precio` de la línea de Nota de Venta que calce (mismo criterio de calce que `palletCalzaConDetalleNV`, ver `embarques.comparacion.ts:precioNVParaLineaPallet`) y queda editable antes de emitir.
> - **Sin `BORRADOR` (D12 aplicado literalmente):** al no ser tributaria, la emisión es un solo paso — `POST .../proforma` crea el registro ya en estado `EMITIDA`. `ANULADA` es soft delete (libera el índice único parcial `(empresaId, embarqueId) WHERE eliminadoEn IS NULL`, permitiendo reemitir).
> - **Tabla de vencimientos estimada (D4):** se arma en el resolver del PDF a partir de `NotaVentaCuotaPago` (snapshot de cuotas del Cierre Comercial, ventas.md R12), no de una entidad `Cuota` nueva — las cuotas `PORCENTAJE` se recalculan contra el `montoTotal` real de la Proforma; las `MONTO_UNITARIO` usan el monto ya congelado en el Cierre Comercial. El enum real es `FechaReferenciaPago` (`FACTURA`/`ZARPE`/`ENVIO_DOCUMENTOS`/`ARRIBO`, sin `EMBARQUE`/`BL`/`PROFORMA` como decía este spec) — solo `ZARPE` y `ARRIBO` tienen fecha resoluble hoy; `FACTURA`/`ENVIO_DOCUMENTOS` quedan "Pendiente" hasta que exista Factura DTE.
> - **Pantalla propia, no pestaña del Embarque** (decisión de negocio, Christian): `Facturación → Cobranza / Factura Exportación` (`/dashboard/facturacion/exportacion`, ítem `FACT_EXPORTACION` ya sembrado desde 2026-07-24 sin uso hasta ahora) — pensada para que la futura emisión del DTE 110 viva en la misma pantalla junto a la Proforma.
> - **Idioma:** selector real (EN/ES) al emitir, guardado en `Proforma.idioma` — el PDF traduce sus rótulos principales según ese valor.
> - **Selector "Nueva Proforma" lee Embarques ajeno al módulo:** el listado `GET /api/ventas/embarques` (usado para elegir el Embarque despachado a facturar) pertenece a Ventas y exige `VENTAS_EMBARQUES` — se cambió su guard a `requireAnyLevel([VENTAS_EMBARQUES, FACT_EXPORTACION], 'LECTURA')` (mismo criterio que reclamos.routes.ts) para que un usuario con solo `FACT_EXPORTACION` pueda usar el flujo completo de su propio módulo sin necesitar acceso a Embarques.
> - **Integridad de las líneas al emitir:** el backend nunca confía en los IDs/cajas que manda el cliente — recalcula los grupos canónicos desde los pallets reales del Embarque y exige que el body cubra ese multiconjunto exacto (sin faltantes, duplicados ni líneas ajenas). `montoTotal` se suma en centavos enteros (no floats) para que sea exactamente Σ `montoLinea`.

## 0.c Supersesión (2026-09-24) — Factura de Exportación (DTE 110) + Cuotas construidas

> Segunda etapa del módulo (objetivos 2 y 3 de §1): emisión de la **Factura de Exportación (DTE 110)** por Embarque, vía LibreDTE, con generación automática de **Cuotas**. NC/ND, Pagos, Saldo a Favor y Ventas Nacionales siguen sin construir. Reconciliación contra el código real:
>
> - **Modelos reales:** `FacturaExportacion` + `FacturaExportacionLinea` + `FacturaExportacionCuota` (`fas-api/prisma/schema.prisma`), enums `EstadoFacturaExportacion` (`BORRADOR/EMITIDA/ANULADA`) y `EstadoCuotaFacturaExportacion`. **No** son el `Factura`/`Cuota` literales de §4 (ese `Factura` no tenía líneas). Reconciliaciones iguales a la Proforma: `moneda String→monedaId`, `formaPagoId→condicionPagoId`, `numero Int→codigo` (`PrefijoCodigo` modelo `'facturaExportacion'`, prefijo **FEX**), `pdfUrl` fuera (el PDF/XML lo entrega LibreDTE al timbrar). Índice único parcial `(empresaId, embarqueId) WHERE eliminadoEn IS NULL` (CB2), igual que Proforma.
> - **Origen = Proforma (decisión de negocio, Christian):** la Factura se crea SIEMPRE desde una Proforma emitida (`POST /proformas/:id/factura-exportacion`), copiando sus líneas/agrupación como punto de partida. Valores (precio unitario) y agrupación son **editables** mientras está en `BORRADOR` — reusa el motor de agrupación canónica de la Proforma (`validarYCompletarLineas`, revalida contra los pallets reales). Comparte con la Proforma solo Cliente/Monto/Condición de Pago/Fecha (D1); son entidades independientes.
> - **Flujo en dos pasos (D-nuevo):** `PATCH .../facturas-exportacion/:id` guarda el borrador; `POST .../facturas-exportacion/:id/emitir` timbra. La Factura solo pasa a `EMITIDA` si el timbrado tiene éxito; si falla, queda en `BORRADOR` con el error para reintentar. No se puede anular una Factura `EMITIDA` (CB16 — corregir con NC, futuro).
> - **Timbrado real vía LibreDTE (firma electrónica ya configurada, 2026-09-24):** el motor genérico `DocumentoDte` se extendió a la Fase 2 — `generarReal()` (folio + envío SII), estados nuevos `GENERANDO/GENERADO`, columnas `folio/respuestaGenerar/generadoEn`. La emisión es `emitirTemporal()` → `generarReal()`. `origenTipo='factura-exportacion'`. Con `DTE_PROVIDER!=='libredte'` (mock) se simula folio, igual que el resto del motor. **Requiere `DTE_PROVIDER=libredte` en el ambiente para timbrar de verdad.**
> - **Mapper DTE 110** (`finanzas/facturacion/mappers/factura-exportacion.mapper.ts`): receptor extranjero (RUT `55555555-5` + `Extranjero.NumId/Nacionalidad`), moneda extranjera en `Totales.TpoMoneda`, sección **Aduana** (`CodModVenta/CodClauVenta/TotClauVenta/CodViaTransp/CodPtoEmbarque/CodPtoDesemb/CodPaisRecep`), `Detalle` con `IndExe=1`. **Códigos de Aduana vía `codigoAduana` (supersesión 2026-10-01):** se agregó una columna `codigoAduana` (nullable) a `ClausulaVenta`, `TipoEmbarque` (vía), `Puerto`, `Pais` y `Parametro` (modalidad) — editable en cada mantenedor (campo "Código Aduana (SII)"). El mapper manda **ese** código, no el `codigo` de negocio (LibreDTE descarta los que no son de su tabla). El service **valida antes de enviar al SII** (`validarCodigosAduana` en `enviarBorradorSii`) que cada mantenedor requerido tenga su `codigoAduana`; si falta alguno, bloquea `POST .../enviar-sii` con el detalle de qué completar. Normalización de los estándar (migración `20261001170000`, corregida por `20261001180000`, + seed): cláusula `CIF=1/CFR=2/EXW=3/FOB=5` (códigos reales de la tabla de Aduana del SII verificados contra LibreDTE; una versión previa de este spec tenía FOB/EXW invertidos), vía `MARITIMO=1/AEREO=4/TERRESTRE=7`, modalidad `FIRME=1`; puertos vía migraciones `20261001190000`/`20261002090000` (específico por nombre + "otros puertos de &lt;país&gt;"/catch-all regional); **Puerto y País se cargan con los datos del cliente** (la validación los exige). Se envía con `normalizar=1`; los valores siguen pendientes de afinar contra respuestas reales de LibreDTE/SII.
> - **Cuotas (CB5/CB6):** se generan al emitir copiando el snapshot `NotaVentaCuotaPago` del Cierre Comercial. `PORCENTAJE` se recalcula contra el `montoTotal` real; `MONTO_UNITARIO` usa el congelado. Vencimiento = fecha de referencia + `plazoDias`: `FACTURA` usa la fecha de emisión de la Factura, `ZARPE`/`ARRIBO` las del Embarque, `ENVIO_DOCUMENTOS` queda `null` (sin fuente aún). El descuadre de redondeo se ajusta en la última cuota (Σ `montoCuota` == `montoTotal`). Pagos/estado dinámico de cuota siguen fuera de alcance.
> - **Programación de pagos en el DTE 110 — `IdDoc.MntPagos` (supersesión 2026-10-13):** las cuotas del cliente se **emiten** en el DTE como `MntPagos` (SII campos 17-20, hasta **30** repeticiones): `FchPago` = vencimiento de la cuota, `MntPago` = monto, `GlosaPagos` = "Cuota N". `FchVenc` de cabecera = vencimiento de la última cuota. Las cuotas se **calculan** (mismo `construirCuotas` CB5/CB6) al armar el payload de `enviar-sii`, **no** se leen de `FacturaExportacionCuota` (que recién se persiste al confirmar el timbrado → el borrador saldría sin pagos). `FchPago` es obligatorio dentro del bloque, así que las cuotas sin vencimiento (p. ej. `ENVIO_DOCUMENTOS`) se **omiten** del DTE (no bloquean). Si una condición genera >30 cuotas, `enviar-sii` se bloquea con mensaje accionable (no se truncan en silencio); el mantenedor también acota a 30.
> - **Formas de pago del DTE 110 — `FmaPago` vs `FmaPagExp` (supersesión 2026-10-13):** `IdDoc.FmaPago` (1=contado, 2=crédito, 3=sin costo) se deriva del plazo de las cuotas (alguna con `plazoDias > 0` → crédito). **`FmaPagExp` fue retirado:** según el Formato DTE del SII es la forma de pago del importador según el DUS (acreditivo/cobranza/anticipo/contado, Tabla de Formas de Pago de Aduanas) — un eje distinto del plazo/condición de pago. El binding erróneo `FmaPagExp = CondicionPago.codigoAduana` se eliminó (campo `codigoAduana` dropeado de `CondicionPago`, migración `20261013150000`). Si se requiere emitir `FmaPagExp`, se modelará como catálogo Aduana propio seleccionable por factura.
> - **Frontend:** en el detalle de la Proforma (Facturación → Exportación) aparece "Generar Factura de Exportación" (o "Ver Factura" si ya existe) → pantalla de la Factura con editor de líneas/agrupación en `BORRADOR` + "Guardar" + "Emitir DTE" (confirmación). Emitida: detalle de solo lectura con folio, líneas y tabla de Cuotas. Separador de miles en todos los montos.

## 0.d Supersesión (2026-09-30) — Facturación Exportación fase 1 (firma SII en 2 pasos, idioma/fecha, XML, landing embarque-céntrica)

> Contrato **autoritativo vigente** del módulo. Supersede de 0.a/0.c: los estados de la Factura, el paso único `/emitir`, y el frontend centrado en Proformas. Cambios de negocio aprobados por Christian (2026-09-29/30). La **Nota de Crédito de anulación (DTE 61)** queda para **fase 2** (depende de CAF tipo 61 en LibreDTE).
>
> - **Estados `EstadoFacturaExportacion`:** `BORRADOR / APROBADA / RECHAZADA / ANULADA` (**supersede** `BORRADOR/EMITIDA/ANULADA`). Migración recrea el enum: `EMITIDA` histórico → `APROBADA`.
> - **Firma SII en dos pasos manuales (supersede el `/emitir` atómico):**
>   - `POST .../facturas-exportacion/:id/enviar-sii` → crea el DTE temporal (`emitirTemporal`). La Factura sigue `BORRADOR`; el "borrador enviado" se **deriva** del `DocumentoDte` en `TEMPORAL_CREADO`.
>   - `POST .../facturas-exportacion/:id/firmar` → timbra (`generarReal`). Éxito → `APROBADA` (folio, `fechaEmision`, cuotas). Fallo → `RECHAZADA` con `errorMensajeSii` (recuperable). **Reconciliación idempotente** (FAS-COB-F1-005): si el `DocumentoDte` ya está `GENERADO` (éxito parcial), firmar no re-timbra, solo reconcilia la factura con el folio existente; `GENERADO` es terminal en el motor DTE.
>   - `POST .../facturas-exportacion/:id/reabrir` → `RECHAZADA` → `BORRADOR` para editar y reintentar.
>   - **Editar descarta el temporal** (FAS-COB-F1-001): `PATCH` invalida el `DocumentoDte` descartable (`TEMPORAL_CREADO/ERROR/PENDIENTE`, nunca en vuelo/timbrado) bajo el mismo advisory lock que emitir/firmar, para que "Firmar" nunca timbre un payload viejo. Política de rechazo (F1-A03): se **reusa** el temporal para reintentar; solo se descarta si se edita.
> - **Idioma + fecha del documento (editables en `BORRADOR`):** `FacturaExportacion.idioma` (ES/EN) y `fechaDocumento` (fecha **calendario `YYYY-MM-DD`**, F1-003). Se **heredan de la Proforma** al crear el borrador y luego son **independientes** (copia inicial, no sincronía permanente — F1-A02). La Proforma también gana `fechaDocumento` editable al emitir.
> - **Tipo de cambio por la fecha del documento (2026-10-06):** la paridad (`OtraMoneda.TpoCambio` del DTE 110, dólar/euro observado del Banco Central vía mindicador.cl) se toma de la **`fechaDocumento`**, no del día. Si esa fecha cae en día sin publicación (finde/feriado) se usa la del **día hábil anterior más cercano** (se consulta la serie del año y, si hace falta por borde de año, la del anterior). Si `fechaDocumento` está vacía, cae al valor más reciente (hoy). El botón **"Obtener"** del editor corre antes de guardar, así que el frontend envía la `fechaDocumento` del formulario como `?fecha=YYYY-MM-DD` (`GET .../facturas-exportacion/:id/tipo-cambio?fecha=`); al **crear** el borrador se usa la `fechaDocumento` heredada de la Proforma.
> - **Descripción por idioma:** la descripción de cada línea se **reconstruye desde los IDs** de los mantenedores (`descripcion` en ES, `descripcionExtranjera` en EN) en el PDF de la Proforma y en el `NmbItem` del DTE. Al elegir EN o al emitir/firmar, si algún mantenedor referenciado no tiene `descripcionExtranjera`, se **bloquea** y se listan los faltantes. La descripción deja de ser texto libre (read-only en pantalla).
> - **XML timbrado:** `generarReal` se llama con `getXML=1`; el XML se persiste en `DocumentoDte.xml` y se descarga con `GET .../facturas-exportacion/:id/xml`. El detalle expone `dte: { estado, folio, tieneXml }`.
> - **PDFs de la Factura (dos artefactos distintos):**
>   - **Factura Comercial (PDF interno):** documento de formato propio generado por el Motor de Documentos (`documentos/factura-exportacion`, reusa la plantilla de la Proforma con `variante='FACTURA'` + folio; título "FACTURA COMERCIAL DE EXPORTACIÓN"). **No** es la representación tributaria del DTE. Solo disponible para una Factura `APROBADA` con folio (gate en el resolver, FAS-EXP-IE-QA-002), no solo en la UI.
>   - **PDF oficial (DTE 110) de LibreDTE:** el artefacto tributario lo entrega LibreDTE al timbrar. **Pendiente de integrar** (segundo botón "PDF Tributario SII") hasta validar la respuesta real del proveedor — mismo estado de validación que el formato del XML.
> - **Flete/Seguro de la cláusula de venta (Incoterm):** `ClausulaVenta.requiereFlete/requiereSeguro` marcan si la cláusula los exige (⚠️ **Supersesión 2026-09-30:** antes vivían en el catálogo genérico `Parametro`; el mantenedor dedicado `ClausulaVenta` — `config/clausulas-venta` — los expone en su propio listado, ver `Docs/ventas.md` §4.1); `Proforma`/`FacturaExportacion.montoFlete/montoSeguro` los guardan. Son un **monto cerrado dentro del total** (restan al valor de venta → valor FOB de la mercadería). Total y cuotas siguen sobre el valor cláusula/CIF; el detalle del DTE se timbra a FOB y la Aduana lleva `MntFlete/MntSeguro` (`TotClauVenta` = CIF).
> - **Anulación:** la **Proforma** no se puede anular si el Embarque tiene una Factura activa (se anula primero la Factura). La **Factura** se anula (soft delete, permite reemitir) en `BORRADOR`/`RECHAZADA`; una `APROBADA` (timbrada) **no** se anula — requiere Nota de Crédito de anulación (fase 2).
> - **Landing embarque-céntrica (supersede el listado de Proformas):** `/dashboard/facturacion/exportacion` lista los **Embarques despachados** (`GET .../exportacion/embarques-despachados`) con columnas de estado **Proforma** (Pendiente/Emitida) y **SII** (Pendiente/Borrador/Aprobada/Rechazada) y acciones (Emitir/Ver Proforma, Generar/Ver Factura).
> - **"Ver Cierre Comercial" desde la Proforma:** abre el **PDF del Cierre Comercial en una pestaña nueva** (`documentosService.abrirPdf('cierre-comercial', notaVentaId)`) — supersede (2026-09-30, reconfirmado 2026-10-06) la navegación original a la pantalla `/dashboard/ventas/cierre/{notaVentaId}`. Análogamente "Ver Factura" abre el PDF de la Factura en pestaña nueva.

## 0.e Supersesión (2026-10-19) — Pagos / Saldo a Favor construidos (Ciclo 1: modelo de datos)

> Se construye el **registro de pagos** (objetivos 5-6 de §1) reconciliado contra el código real — el `Factura`/`Cuota`/`Pago`/`SaldoAFavorCliente` literales del §4 eran pre-reconciliación y quedan **superseded**. Modelos reales (`schema.prisma`, migración `20261019140000_cobranza_pagos`):
>
> - **Dos tipos de factura, no uno:** `Pago` aplica a `FacturaExportacion` **o** `FacturaNacional` vía **FK polimórfica** (`PagoAplicacionDocumento.facturaExportacionId?`/`facturaNacionalId?`, exactamente una). La cascada a cuotas (`PagoAplicacionCuota`) es igual de polimórfica (cuota de export o nacional).
> - **Convenciones reales:** `empresaId` (tenant), `codigo` vía `PrefijoCodigo` (modelo `'pago'`, prefijo **PAG**), `clienteId`→`Entidad` (FK compuesta empresa/id), `monedaId`→`Moneda`, soft delete. `MedioPago {TRANSFERENCIA, CHEQUE, EFECTIVO, OTRO}`.
> - **Saldo en cuotas persistido:** `FacturaExportacionCuota`/`FacturaNacionalCuota` ganan `montoPagado` (default 0) y `saldoPendiente` (= `montoCuota` al crear; CB7). Estado de cuota `PENDIENTE/PARCIAL/PAGADA/VENCIDA`.
> - **Estado de cobranza a nivel factura** separado del estado SII: campo `estadoCobranza EstadoCobranza? {SIN_CUOTAS, PENDIENTE, PARCIAL, PAGADA, VENCIDA}` en ambas facturas, derivado del agregado de cuotas (CB15). El estado SII (`BORRADOR/APROBADA/...`) **no** se recicla.
> - **Supersesión VN6:** la **Factura Nacional SÍ entra a cartera** — gana `FacturaNacionalCuota` (se generarán al aprobar/firmar desde la `CondicionPago`, como exportación). Decisión de negocio (Christian): "pagos de facturas nacionales **y** de exportación".
> - **Supersesión D9/CB17:** pagos **multi-moneda CON conversión** (no "sin conversión"): `PagoAplicacionDocumento.tipoCambioAplicado` convierte del monto del pago (en su `monedaId`) a la moneda de la factura; `montoAplicado` queda en la moneda de la factura. Decisión de negocio (Christian).
> - **Saldo a favor** (`SaldoAFavorCliente` + `SaldoAFavorAplicacion`, CB12/D11): remanente no aplicado, reaplicable a facturas del mismo cliente+moneda.
>
> **Ciclo 1 = solo el modelo de datos + migración.** La lógica (aplicación/cascada/saldo/multi-moneda, pantalla de Cobranza, job diario VENCIDA, NC/ND) va en ciclos posteriores encadenados.

## 0.f Supersesión (2026-10-20) — Correcciones DTE 110 (bloque Aduana + moneda) contra rechazo real del SII

> Al timbrar la primera Factura de Exportación real, el SII rechazó el XML por errores de estructura/datos en el bloque Aduana y la moneda. Correcciones en `factura-exportacion.mapper.ts` + `factura-exportacion.service.ts`:
>
> - **Unidad de peso = código numérico de 2 dígitos del Anexo 51 de Aduana**, NO la sigla: `CodUnidPesoBruto = 36` (Kilo Bruto), `CodUnidPesoNeto = 06` (Kilo Neto). Antes se mandaba `'KB'`/`'KN'` (rechazado).
> - **Orden del bloque Aduana = secuencia exacta del XSD del SII**: `CodModVenta, CodClauVenta, TotClauVenta, CodViaTransp, NombreTransp, RUTCiaTransp, NombreCiaTransp, Booking, CodPtoEmbarque, CodPtoDesemb, PesoBruto, CodUnidPesoBruto, PesoNeto, CodUnidPesoNeto, TotItems, TipoBultos, TotBultos, MntFlete, MntSeguro, CodPaisRecep, CodPaisDestin`. Antes `CodViaTransp` iba después de los datos de transporte (rechazado: "'NombreCiaTransp' no esperado, se esperaba 'CodPaisDestin'").
> - **`CodPaisDestin` agregado** = mismo código de país que `CodPaisRecep` (país del cliente, decisión de negocio).
> - **`TpoMoneda` = nombre de la tabla "Monedas" de Aduana** (valores de `TipMonType`), mapeado por código ISO de la Moneda: `USD→DOLAR USA`, `EUR→EURO`, `GBP→LIBRA EST`, `CNY→RENMINBI`, `JPY→YEN`, etc. (mapa fijo en `factura-exportacion.service.ts`). Antes se mandaba la descripción libre (`"DOLAR"`, rechazado). Si una moneda no está en el mapa, `enviar-sii` se bloquea con mensaje accionable (no se manda un valor inválido).
> - La **Guía de Despacho de exportación (DTE 52)** usaba los mismos `'KB'/'KN'` y le faltaba `CodPaisDestin`: se corrigió igual en `embarque-guia-despacho.mapper.ts` (ver `ventas.md` R13).
> - El CAF/folios no eran el problema: un folio saltado (el que falló) debe anularse en el SII.

## 0.g Supersesión (2026-10-20) — DTE 110: NomCiaTransp + NumId, PDF tributario (supersede Factura Comercial en el detalle) y Sello de contenedor

> Segunda tanda de correcciones tras timbrar contra el SII real (folios 3531–3533) y ver el PDF devuelto. Todo en `fas-api` (+ un campo nuevo en Embarques) y `fas-web`:
>
> - **`NomCiaTransp` (no `NombreCiaTransp`)** — ⚠️ **corrige el nombre citado en §0.f**: el elemento del XSD de Aduana para la compañía transportista es `NomCiaTransp`; `NombreCiaTransp` no existe y el SII lo rechaza como "elemento no esperado". Fix en `factura-exportacion.mapper.ts` (solo la key del XML).
> - **`NumId` del receptor extranjero (TAXID) = máx 20, ALFA** (SII Formato DTE v2.5, campo 53). El TAXID puede traer varios IDs con etiquetas (ej. `"IEC/PAN: ABOFA8252F - FSSAI NO: ... - GST: ..."`). Se envía **solo el primer código** (`resolverNumIdReceptor` en `factura-exportacion.service.ts`: separa por coma/;/|/salto/" - "/" / " sin romper guiones pegados tipo `99-1234567`, y quita la etiqueta anterior al último `:`). **Guard** en `enviar-sii`: si el primer código aun así supera 20, se **bloquea** con mensaje accionable (no quema folio).
> - **PDF tributario (DTE 110 timbrado) IMPLEMENTADO** (supersede el "pendiente" del bullet "PDFs de la Factura" de §0.d): `GET .../facturas-exportacion/:id/pdf-sii` → `obtenerPdfTimbrado` → `obtenerPdfEmitido` → LibreDTE `GET /api/dte/dte_emitidos/pdf/{dte}/{folio}/{emisor}?papelContinuo=0`. Requiere `APROBADA` + folio. Botón **"Ver DTE Timbrado (SII)"** en el detalle de la Factura.
> - **Factura Comercial RETIRADA del detalle de la Factura** (decisión de negocio Christian: "elimínala, esta es la Proforma" — el PDF comercial reusa la plantilla de la Proforma, es redundante). En `factura-detalle-view.tsx` el botón comercial se **reemplazó** por el tributario SII. *(El documento `documentos/factura-exportacion` sigue existiendo en el Motor de Documentos porque la vista de la Proforma lo ofrece como "Ver Factura"; solo se quitó del detalle de la Factura.)*
> - **Ambiente LibreDTE = parámetro de la Integración** (no env): el parámetro `AMBIENTE` (`produccion`/`certificacion`) de la Integración `LIBREDTE` manda sobre `_contribuyente_certificacion`; si no está, cae a `env.DTE_AMBIENTE`. Editable por empresa sin redeploy.
> - **Sello/precinto del contenedor** (`Embarque.numeroSelloManual`, `SolicitudReserva.numeroSello`): el SII exige `TipoBultos.Sello` + `EmisorSello` junto a `IdContainer`, y LibreDTE los lee sin `isset()` al armar el PDF (reventaba con "Undefined index: Sello" y devolvía un PDF corrupto/truncado). Se captura en la pestaña **Solicitud de Reserva** (campo "Sello / Precinto"), **editable en ambos modos de reserva** (manual y AGL360 — es un dato operacional; si la API de AGL360 no lo trae, se completa a mano). Tiene su **propio endpoint** `PATCH .../embarques/:id/sello` (no toca `estadoReserva`), que persiste `Embarque.numeroSelloManual`. El DTE lo resuelve con `numeroSelloManual ?? solicitudReserva.numeroSello` (gana el manual, cae al de AGL360); `SolicitudReserva.numeroSello` queda para cuando la API de AGL360 lo entregue. `EmisorSello` se deriva de la **naviera**. El mapper emite `IdContainer + Sello + EmisorSello` **solo si existen los tres** — faltando cualquiera, se **omite el contenedor** (nunca tag vacío ni PDF corrupto). El DTE tributario no cambia su validez por esto; solo arregla el PDF.

## 0.h Supersesión (2026-10-28) — Pagos / Saldo a Favor: lógica + pantalla (Ciclo 2)

> Se construye la **lógica de pagos** (objetivos 5-6 de §1) y su **pantalla**, sobre el modelo de datos del Ciclo 1 (§0.e). Reconciliación contra el código real:
>
> - **Cuotas de la Factura Nacional al firmar (supersede VN6):** `FacturaNacional.firmar()` ahora genera `FacturaNacionalCuota` desde su `CondicionPago` (espejo del `construirCuotas` de exportación, que las toma del Cierre Comercial — la Nacional no tiene Cierre). PORCENTAJE = % del `montoTotal`; MONTO_UNITARIO = `valorUnitario × Σ cantidad de líneas` (en CLP, sin conversión de la cuota); ajuste de redondeo en la última cuota para que Σ == `montoTotal`. `FACTURA` usa `fechaDocumento`; `ZARPE/ARRIBO` las del Embarque (solo `VENTA_NACIONAL`); `ENVIO_DOCUMENTOS` sin fecha. Sin `CondicionPago` → sin cuotas (`estadoCobranza = SIN_CUOTAS`).
> - **`estadoCobranza` se setea al firmar** (ambas facturas): derivado del agregado de cuotas (CB15, enum `SIN_CUOTAS/PENDIENTE/PARCIAL/PAGADA/VENCIDA`) — antes quedaba `null` tras el Ciclo 1.
> - **`PagoService` (nuevo módulo `ventas/cobranza/pago.*`):** `POST /pagos` registra el pago (prefijo **PAG**) y lo aplica a 1+ facturas (export **o** nacional, FK polimórfica). Cascada a la cuota más antigua primero (CB11/D10, función pura `distribuirEnCuotas`); el excedente por factura se valida contra su saldo (no se sobre-aplica). **Multi-moneda CON conversión (supersede D9/CB17):** cada aplicación lleva `tipoCambioAplicado` (pago→factura); `montoAplicado` queda en la moneda de la factura, y lo consumido del pago = `montoAplicado / tipoCambio`. Si el pago no tiene aplicaciones, o `Σ consumido < monto`, el remanente genera un **Saldo a Favor** en la moneda del pago (CB12). Un pago sin aplicaciones = anticipo (todo a saldo a favor).
> - **Estados recalculados tras cada mutación:** cuota (CB14) y `estadoCobranza` de la factura (CB15).
> - **Aplicar saldo a favor (CB13):** `POST /saldo-a-favor/:id/aplicar` reaplica un saldo existente a una factura del **mismo cliente + misma moneda** (sin conversión), con la misma cascada; descuenta `montoDisponible` y registra `SaldoAFavorAplicacion`.
> - **Concurrencia:** cada aplicación toma `pg_advisory_xact_lock` por factura (namespace `LOCK_NAMESPACE_COBRANZA_PAGO`, clave `tipo:id`, en orden ascendente) y **re-lee el saldo bajo lock** dentro de la transacción — dos pagos (o un pago y una aplicación de saldo) sobre la misma factura no pueden sobre-aplicar.
> - **Endpoints** (`/api/ventas/cobranza`, ítem `VENTAS_COBRANZA`): `GET /clientes/:id/documentos-pendientes` (filtro opcional `monedaId`), `POST /pagos` (TOTAL), `GET /pagos` · `GET /pagos/:id` (LECTURA), `GET /clientes/:id/saldo-a-favor` (LECTURA), `POST /saldo-a-favor/:id/aplicar` (TOTAL). Sin migración nueva (todo el schema es del Ciclo 1; prefijo PAG e ítem ya sembrados).
> - **Frontend** (`/dashboard/facturacion/cobranza`, feature `facturacion-cobranza`, nav habilitado): pantalla **cliente-céntrica** — selector de cliente → pestañas **Cartera** (facturas con saldo + estado), **Saldo a Favor** (con "Aplicar") y **Pagos** (historial). Modal **Registrar Pago**: moneda/monto/medio/fecha + facturas pendientes con monto por factura (y T/C si la moneda difiere), con remanente "quedará a favor" en vivo. *(El listado global de cartera `GET /facturas` de §6 — todas las facturas de todos los clientes — queda diferido: la vista por cliente cubre el flujo de pago.)*
> - **Política de redondeo multimoneda (QA FAS-COB-PAG-R1-002):** lo consumido del pago se acumula SIN redondear por aplicación y se redondea una sola vez al total; además toda aplicación debe consumir ≥ 1 centavo representable del pago (si no, se rechaza) — así una aplicación nunca abona a la factura sin cargar el equivalente al pago.
> - **Deuda conocida aceptada (QA FAS-COB-PAG-R2-004):** el `codigo` PAG se genera con `siguienteCodigo` (sugerencia, no reserva atómica) igual que TODO el sistema (FEX/FNA/OC/...), sin `@@unique([empresaId, codigo])` — dos pagos concurrentes podrían, en teoría, compartir código (etiqueta humana; la PK es `id`). Se deja consistente con el resto del sistema; su endurecimiento es un refactor system-wide del motor de correlativos, no del Ciclo 2.
> - **Fuera de Ciclo 2 (ciclos siguientes):** job diario `VENCIDA` (Ciclo 3, BullMQ) y NC/ND (Ciclo 4, DTE 61/111/112). Tests transaccionales de pagos/saldo a favor/concurrencia contra Postgres real quedan para la etapa de tests de integración (la suite unitaria cubre las funciones puras CB11/CB14/CB15/CB5/CB6).

## 0.i Supersesión (2026-10-28) — Job diario de vencimientos (Ciclo 3)

> Se construye el **barrido diario** que mueve a `VENCIDA` las cuotas/facturas impagas cuyo vencimiento ya pasó (CB14/CB15, D7). Primer **cron** del sistema.
>
> - **Cola BullMQ `cobranza`** (ya declarada en `lib/queue.ts`) + `cobranza.queue.ts`: `iniciarWorkerCobranza()` y `programarVencimientosDiarios()` (vía `upsertJobScheduler`, idempotente — se re-registra en cada arranque sin duplicar). Cron **`0 3 * * *` (03:00 `America/Santiago`)** con **reintentos** (`attempts: 3`, backoff exponencial 60s) y retención acotada — el barrido es idempotente, así que reintentar la corrida completa tras una falla transitoria es seguro. Ambos se inician en `server.ts` junto a los workers de correos/auditoría.
> - **Multi-tenant + aislamiento de fallos:** el worker corre fuera de request, así que **enumera las empresas activas** y refresca cada una bajo `empresaContext.run({ empresaId })` — los updates de factura son de un modelo tenant (requieren el contexto); las cuotas no lo son → se filtran con `empresaId` explícito. Un fallo de una empresa **no aborta a las demás** (try/catch por empresa); si al menos una falló, el job termina con error para activar el reintento/alerta de BullMQ.
> - **Recalcula vencimientos (CB6/D7), no solo compara estados:** por cada factura en cartera activa, bajo su **advisory lock de pago** (serializa con `POST /pagos` para no competir con un pago concurrente), re-lee las cuotas y recalcula `fechaVencimiento = fechaBase actual + plazoDias` para toda cuota NO pagada (FACTURA = fecha del documento; ZARPE/ARRIBO del Embarque; ENVIO_DOCUMENTOS sin fuente). Esto implementa CB6/D7 en modelo **pull** (diario) sin depender de una notificación externa del módulo de Embarque (la dependencia que §9.10 dejaba pendiente). Luego re-deriva el estado de cada cuota (CB14) y el `estadoCobranza` de la factura (CB15) — **bidireccional**: si una fecha base se movió al futuro, una cuota marcada vencida vuelve a `PENDIENTE`. Las `PAGADA` conservan su fecha histórica y estado (D7); las `PARCIAL` siguen `PARCIAL` (el parcial gana, CB14/CB15). `hoy = inicioDeHoy()` = **medianoche UTC** (alinea con cómo Prisma persiste las fechas-calendario `YYYY-MM-DD`, independiente de la TZ del contenedor); una cuota que vence hoy aún no está vencida.
> - **Relación con la derivación de pago:** el estado/fecha almacenados son un snapshot refrescado a diario **y** tras cada pago; entre corridas, una cuota recién vencida puede seguir mostrándose `PENDIENTE` hasta el próximo barrido (igual permanece en la cartera activa).
> - **Pendiente:** NC/ND (Ciclo 4). Tests del barrido contra Postgres real quedan para integración; la lógica pura de recálculo+estado (`planRefresco`, `calcularVencimiento`, `derivarEstadoCuota/Cobranza`) está cubierta por tests unitarios (incluido el borde "vence hoy no vence" y el des-vencimiento por cambio de fecha base).

## 0.j Supersesión (2026-10-28) — Nota de Crédito de anulación (Ciclo 4, primera entrega)

> Primera pieza del Ciclo 4: **anular una factura timbrada con una Nota de Crédito** (DTE 112 de exportación / DTE 61 nacional), con timbrado real vía LibreDTE. NC/ND parciales y por reclamo quedan para una entrega posterior.
>
> - **Modelo `NotaCredito`** (migración `20261028120000`): polimórfico (una factura export **o** nacional, CHECK XOR), `tipoDte` 112/61, `motivo ANULA_DOCUMENTO`, estado `BORRADOR/APROBADA/RECHAZADA`, `folio/trackIdSii/errorMensajeSii`, `codigo` vía PrefijoCodigo (prefijo **NC**), tenant (`empresaId`). **No persiste detalle propio**: el Detalle del DTE se deriva de las líneas de la factura referenciada al emitir (siempre es anulación total).
> - **Referencia SII:** la NC referencia el DTE de la factura con `TpoDocRef` = tipo de la factura (110 / 33 / 34), `FolioRef` = folio timbrado, **`CodRef=1`** (anula documento) y `RazonRef`. Se agregó `CodRef` al builder de `Referencia` de ambos mappers; el de exportación se parametrizó (`tipoDte`, `incluirCuotas`, `incluirReferenciasFactura`, `referenciasExtra`) para reusar el mismo cuerpo del 110 como 112 sin MntPagos; el nacional ganó soporte de `Referencia`.
> - **Emisión (mismo motor y patrón que las facturas):** `POST .../facturas-exportacion/:id/anular-con-nc` y `.../facturas-nacional/:id/anular-con-nc` (nivel `TOTAL`, ítems `FACT_EXPORTACION`/`FACT_NACIONAL`). Flujo `emitirDteTemporal → generarDteReal` con `origenTipo` propio (`nota-credito-exportacion`/`nota-credito-nacional`) — el motor `DocumentoDte` los aísla del DTE de la factura (su `@@unique([empresaId, origenTipo, origenId])`) y serializa por advisory lock; reconciliación idempotente (reusa un temporal `GENERADO`, reintenta un `RECHAZADA`). **CAF:** LibreDTE resuelve el folio por `tipoDte` (112/61) + emisor + ambiente; hay que tener el CAF de ese tipo cargado para timbrar real (en mock se simula folio).
> - **Efecto al timbrar:** NC `APROBADA` + factura `estado = ANULADA` (SII) y `estadoCobranza = ANULADA` (valor nuevo del enum) — atómico. La factura sale de la cartera activa (el listado ya filtraba `estado=APROBADA`; el pago ya rechazaba facturas no aprobadas; el barrido diario ignora `estadoCobranza=ANULADA`). CB9: no se emite una segunda NC sobre una factura ya anulada.
> - **Una sola NC por factura (concurrencia, FAS-COB-NC-R1-001):** el create de la NC va bajo advisory lock por factura (`LOCK_NAMESPACE_COBRANZA_NOTA_CREDITO`, re-check bajo el lock) + índice único parcial por cada FK de factura (migración `20261028130000`, backstop a nivel BD). Dos "anular-con-nc" concurrentes no pueden crear dos NC/folios: el segundo reusa la NC del primero y el motor DTE reconcilia el timbrado por `nc.id`.
> - **Lecturas NC:** `GET .../notas-credito/:id` · `/xml` · `/pdf` (PDF tributario timbrado de LibreDTE). La ruta admite `FACT_EXPORTACION`/`FACT_NACIONAL`, pero además se exige el ítem **que corresponde al tipo de la NC** (una NC de exportación requiere `FACT_EXPORTACION`; una nacional, `FACT_NACIONAL`) — FAS-COB-NC-R1-002. El detalle de la factura trae sus `notasCredito`.
> - **Frontend:** en el detalle de una factura `APROBADA`, botón **"Anular con Nota de Crédito"** (confirmación; destructivo, nivel `TOTAL`). Tras anular: la factura muestra su estado `ANULADA` + el folio de la NC y botones **"Ver NC Timbrada (SII)"** / **"Descargar XML NC"**. Export y nacional.
> - **Tests:** mappers de NC 112/61 (TipoDTE + Referencia `CodRef=1` + sin MntPagos). La emisión real se valida contra LibreDTE (requiere CAF 112/61).

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
- ✅ **Generación de Proforma (PDF) por embarque** (2026-09-24), con tabla de vencimientos estimada (no persistida como Cuota) — ver §0.b. El resto de los ítems de abajo sigue sin construir.
- ~~Catálogo **Forma de Pago** con 1 a 3 cuotas~~ — no se construye: ya existe como `CondicionPago`/`CondicionPagoCuota` (§0.b).
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
- Conversión de moneda / consolidación de cartera en una moneda única — cada documento y cada pago se mantiene en su propia moneda (USD, EUR, RMB, etc.), sin tipo de cambio. *(Nota: esto aplica solo a la gestión de cobranza/cartera; NO contradice la paridad tributaria `OtraMoneda.TpoCambio` del DTE 110, que sí usa el dólar/euro observado por la fecha del documento — ver §4 arriba.)*

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

// ⚠️ Bloque histórico (spec original) — el modelo REAL implementado (2026-09-24)
// está reconciliado en §0.b y vive en `fas-api/prisma/schema.prisma` (models
// `Proforma`/`ProformaLinea`, enums `EstadoProforma`/`DimensionProforma`).
// Diferencias principales: sin `formaPagoId` (usa `condicionPagoId` real);
// `codigo: String` en vez de `numero: Int`; `moneda`→`monedaId` (FK real);
// `detalleFruta: Json` reemplazado por la relación `lineas ProformaLinea[]`;
// sin `pdfUrl` (Motor de Documentos); sin estado `BORRADOR` (emisión en un
// solo paso). Se deja el bloque original sin editar como referencia de la
// intención de negocio original.
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

> **⚠️ Supersesión — Implementación (2026-10-15), primera entrega: Factura Nacional desde Proforma de Materiales.** Reconciliación de este spec con lo construido (decisión del usuario):
> - **Alcance:** solo el camino **MATERIAL** (desde `ProformaMaterial` en estado `ENVIADA_VALIDACION`). **SERVICIO_PRODUCTOR** (su módulo aún no existe, `productores.md`) y **DIRECTO** (emisor desde 0) quedan **diferidos** — el `origen`/`origenClase` ya los contempla en el enum.
> - **Flujo = 2 pasos borrador→firma**, igual que la Factura de Exportación (DTE 110): estados **`BORRADOR / APROBADA / RECHAZADA / ANULADA`** y endpoints `enviar-sii` (crea el DTE temporal, sin folio) → `firmar` (timbra folio real). Esto **supersede** el `BORRADOR/EMITIDA/ANULADA` + `/emitir` único de VN5.
> - **Líneas mixtas afecta/exenta:** cada línea lleva un flag `exento` (IndExe=1 en el DTE). El `tipoDte` se **deriva**: `34` (Exenta) si TODAS las líneas son exentas, `33` (Afecta) si hay alguna afecta. Esto refina VN2 ("33 o 34") para permitir documentos mixtos. IVA 19% sobre el neto; totales reales los calcula LibreDTE con `normalizar=1`.
> - **Receptor:** RUT real del cliente (`Entidad.identificador`), `RznSocRecep/GiroRecep/DirRecep/CmnaRecep` de la Entidad `CLIENTE_NACIONAL` (VN3 validado al crear y antes de emitir). Sin bloque Aduana, sin moneda extranjera/tipo de cambio (CLP).
> - **Stock (VN5):** para el origen **MATERIAL** el stock **ya se descontó** al confirmar el Movimiento que originó la Proforma (ver `materiales.md`); la Factura **no** genera una nueva salida — solo marca la `ProformaMaterial` como **`FACTURADA`**. La "nueva salida al emitir" de VN5 aplicaría al camino **DIRECTO** (diferido).
> - **Modelo/contrato implementados:** `FacturaNacional` (+ `FacturaNacionalLinea`, `cantidad Decimal(14,3)`), discriminador `origenClase` (`PROFORMA_MATERIAL`↔MATERIAL) + `proformaMaterialId`; endpoints `/cobranza/facturas-nacional` (crear desde `{ proformaMaterialId }`, PATCH borrador, enviar-sii, firmar, reabrir, anular, list, `proformas-facturables`, pdf-borrador, xml); prefijo de código `FNA`; permiso `FACT_NACIONAL`. NC/ND y Pagos siguen fuera de alcance.

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
| ~~POST/GET/PATCH~~ | ~~`/formas-pago`~~ | No se construye — usar el mantenedor `CondicionPago` ya existente (§0.b). |
| ✅ GET | `/embarques/:id/proforma/sugerencia?dimensiones=...` | Líneas sugeridas (agrupadas por Especie + dimensiones elegidas), sin persistir. |
| ✅ GET | `/embarques/:id/proforma` | Proforma activa del embarque, o `null`. |
| ✅ POST | `/embarques/:id/proforma` | Crea y emite la Proforma en un solo paso (líneas ya confirmadas por el usuario en el body). |
| ✅ GET | `/proformas` / `/proformas/:id` | Listado / detalle, con tabla de vencimientos estimada calculada al vuelo (implementado en el resolver del PDF). |
| ✅ POST | `/proformas/:id/anular` | Anula (soft delete) — libera el embarque para reemitir. |
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

- ✅ **Facturación → Cobranza / Factura Exportación** (`/dashboard/facturacion/exportacion`, ítem `FACT_EXPORTACION`, 2026-09-24 — reemplaza la idea original de pestañas dentro del Embarque, decisión de negocio Christian): listado de Proformas (filtro por folio/estado) + botón "Nueva Proforma" (selector de Embarque despachado) → pantalla de emisión con checkboxes de agrupación (Variedad/Artículo/Calibre/Categoría/Marca, Especie siempre incluida), tabla de líneas sugeridas editable (descripción y monto), selector de idioma, botón "Emitir Proforma". Una vez emitida: detalle de solo lectura + "Ver PDF" + "Anular". Cuando se construya la Factura DTE, su emisión debería vivir en esta misma pantalla (por eso no se hizo una pestaña aparte en el Embarque).
- **Detalle de Embarque**: pestaña Factura DTE (pendiente de construir), con su estado y acción `Emitir Factura`. Tabla de Cuotas visible bajo la Factura, con columnas: N° cuota, %, monto, fecha de referencia, vencimiento, saldo pendiente, estado.
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

1. ✅ Migraciones Prisma de `Proforma`/`ProformaLinea` (2026-09-24, ver §0.b — el resto del modelo de §4 sigue pendiente).
2. Confirmar/definir la interfaz del adaptador DTE (emisión 110/111/112) — puede ser un paquete compartido con Finanzas si "Facturación" termina siendo el mismo adaptador.
3. ✅ Servicio de Proforma (PDF vía Motor de Documentos, tabla de vencimientos calculada al vuelo) — `fas-api/src/modules/ventas/cobranza/proforma.*`.
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
