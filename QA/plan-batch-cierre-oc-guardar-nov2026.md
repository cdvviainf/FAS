# Plan — Batch Cierre/OC/guardar (2026-11-09)

Alcance acumulado sin commit: incluye el ciclo anterior ya aprobado (QA/plan-cierre-orden-calidad-linea-nov2026.md, TESTS_OK) más lo siguiente.

## 1. Cierre Comercial: edición solo del creador
- Mientras el Cierre está abierto, solo su creador (`creadoPor`) edita encabezado y líneas, elimina o cierra. Además del nivel TOTAL del perfil.
- Excepción: permiso de USUARIO (no perfil) `Usuario.puedeEditarCierresAjenos` (default false) → edita todos los Cierres.
- Ver, PDF, duplicar (quien duplica pasa a ser el creador) y reabrir (VENTAS_REABRIR_CIERRE) no se restringen.
- Backend: `requireEditorCierre` (403) en actualizar/eliminar/cerrar/agregar/editar/eliminar línea. GET y listado devuelven `creadoPorNombre` y `puedeEditar`.
- Web: checkbox en Usuarios (crear/editar) + columna; Cierre en solo lectura con aviso; listado con columna "Creado por" y acciones Editar/Cerrar/Eliminar solo si `puedeEditar`.
- Migración `20261109200000_usuario_editar_cierres_ajenos`.

## 2. OC de fruta
- Fecha por defecto = día local (antes UTC).
- "Destino" → "Mercado". Con Cierre, Mercado = el del Cierre: bloqueado en el form y forzado en el service (crear/editar).
- `OrdenCompraLinea.calibreModo` (ESPECIFICOS/RANGO) + selector "Calibres en PDF"; línea tomada del Cierre lo hereda (form y backend). PDF: el resolver formatea con `textoCalibres` (compartido con el Cierre, `resolvers/calibres-texto.ts`); plantillas sin cambios.
- Migración `20261109210000_oc_linea_calibre_modo` (backfill desde la línea del Cierre).

## 3. Al guardar cambios, volver al listado
- "Guardar cambios" del encabezado redirige al listado en: Cierre, OC fruta, Instructivo de Embalaje, Recepción, OC Materiales, Proforma Materiales, Movimientos (cabecera), Proforma de Servicio, Generador DTE. (Solicitud, Entidades, Empresas, Perfiles, Usuarios ya lo hacían; mantenedores en panel lateral ya cierran.)
- Crear un documento con líneas sigue abriendo el documento creado; agregar/editar líneas no sale del documento.

## 4. Recepción: asociar OC / Procesos solo de la temporada activa (agregado 2026-11-09, post TESTS_OK ronda 1)
- Al CREAR una Recepción, el combo de OC (modo OC, estado EMITIDA) y el selector de Instructivos de Embalaje (modo PROCESO) listan solo registros de la temporada activa del selector general (`temporadaId` en los listados, filtro ya soportado por la API).
- Las opciones esperan a que la temporada activa termine de cargar.
- En EDICIÓN la asociación está bloqueada: se listan sin filtro para que la OC/Instructivos ya asociados de otra temporada sigan mostrando su nombre.
- Solo frontend (`recepcion-form.tsx`).

## 5. Temporada OBLIGATORIA en todo registro (agregado 2026-11-09, post QA ronda 4)
Decisión del usuario: "No puede haber un registro sin temporada activa; debe ser parte de los requerimientos de cualquier registro" — alcance "Todos".
- Tablas afectadas: `notas_venta` (Cierre), `ordenes_compra`, `instructivos_embalaje`, `recepciones`, `reclamos`, `movimientos_cuenta_corriente` → `temporadaId` NOT NULL. Reclamo y Movimiento CC ganan FK compuesta `(empresaId, temporadaId) → temporadas(empresaId, id)`.
- Migración `20261109230000_temporada_obligatoria`: backfill de nulos (temporada de su empresa por rango de fecha → predeterminada → más reciente; Reclamo hereda antes la del Cierre de su Embarque). Reclamo/Movimiento con temporada de otra empresa se recalculan. Si una empresa con registros no tiene temporadas, la migración falla con mensaje explícito.
- Backend (`shared/temporada-documento.ts`): `temporadaParaCrear` nunca devuelve null; sin temporada enviada ni resoluble por fecha/predeterminada → 400 "No hay temporada activa…". Edición: `null` explícito rechazado (ya existía); los repos nunca escriben null.
  - Reclamo: la enviada (validada); si no viene, la del Cierre del Embarque (heredada, sin exigir vigencia); si no, por fecha del reclamo. Edición valida con `validarTemporadaEnEdicion`.
  - Movimiento CC manual: la enviada (validada) o por fecha. Movimiento automático al firmar Factura Nacional desde Proforma Materiales: `temporadaParaMovimientoAutomatico` (por fecha → predeterminada → más reciente de la empresa).
- Frontend:
  - Formularios de creación de Cierre, OC, Instructivo, Recepción y Movimiento CC: sin temporada (activa o elegida en el form) muestran aviso `AvisoSinTemporada` y deshabilitan el botón de guardar. El Movimiento CC envía la temporada activa.
  - Selector global: sin temporada activa se destaca en ámbar con el texto "Selecciona temporada".
  - Recepción (BCOG-R3-001): sin temporada activa, selectores de OC/Instructivos bloqueados con aviso y Guardar deshabilitado.
- BCOG-R4-001: el combo de OC de Recepción recorre todas las páginas del listado (mismo patrón que Instructivos).


## 6. Contrato sin input de Temporada + Tipo de documento en Proformas (agregado 2026-11-09)
- Contrato del productor (`contrato-form-sheet.tsx`): se quita el selector Temporada. Alta = temporada activa del selector general (aviso + Guardar deshabilitado sin temporada); edición conserva la del contrato. Fechas precargadas con el rango de la temporada activa mientras el usuario no las toque.
- Proformas (Materiales y Productores): campo de cabecera `tipoDte` (33 Factura Nacional / 34 Factura Exenta, default 33). Migración `20261110090000_proforma_tipo_documento`: agrega `tipoDte` (todas las existentes = 33, decisión del usuario) y elimina `proforma_productor_linea.exento`.
  - Proforma Productor: sin columna Exento; totales Neto/IVA o Exento según tipo. PDF (resolver): todas las líneas afectas o exentas según tipo (plantilla v2 sin cambios).
  - Proforma Materiales: selector en cabecera; PDF IVA 0 si exenta (plantilla v2 congelada, monto como base).
  - Factura Nacional desde Proforma: líneas exentas sí y solo si `tipoDte` de la Proforma = 34. En el borrador se elimina la marca "Exenta" por línea; el backend ignora `exento` del request y lo fija por `factura.tipoDte`. Facturas de Venta Nacional (Embarque) sin cambios.

## 7. Observaciones de la Factura desde la Proforma (agregado 2026-11-09, revisado con el usuario)
- Al crear la Factura Nacional desde una Proforma (Materiales o Productores), sus observaciones iniciales = observaciones de la Proforma + (si la Proforma no es CLP) `{MONEDA} {NETO total en moneda origen} a {TC}` en formato es-CL, p. ej. `USD 2.500 a 998,56`, separados por " / ". NETO = Σ (cantidad × precio) de las líneas, **sin IVA y sin detalle por línea**.
- Solo facturas NUEVAS (al crear el borrador); luego editables. Facturas ya creadas no cambian.
- **Límite 100 caracteres** = límite SII de `TermPagoGlosa`: el campo Observaciones de la Factura Nacional acepta máx. 100 (schema `actualizarBorradorSchema` + `maxLength` y contador en pantalla), para que lo que se ve en el sistema sea exactamente lo que llega al SII. Al componer, si no cabe, se recorta el texto de la Proforma para conservar la línea del TC. El mapper recorta a 100 como resguardo.

## 8. Fecha de vencimiento y cuotas al SII (Factura Nacional 33/34) (agregado 2026-11-09)
- El DTE enviado a LibreDTE incluye `IdDoc.FchVenc` (vencimiento de la última cuota con fecha) y `IdDoc.MntPagos` (FchPago, MntPago en CLP entero, GlosaPagos "Cuota N"; máx. 30), con las mismas cuotas que se generan al firmar (`construirCuotasNacional`: Condición de Pago, FACTURA = fecha del documento + plazo). Cuotas sin fecha (zarpe/arribo/envío de documentos) no se informan. Mismo criterio que la Factura de Exportación (DTE 110).

## 9. Vencimiento estimado en cuotas de Proformas (agregado 2026-11-09)
- Pantallas de Proforma de Materiales y de Productores: cada cuota muestra "vence dd-mm-aaaa (estimado)" = fecha de la Proforma (o hoy si no se ha guardado) + plazo, solo para referencia FACTURA; otras referencias "—". La fecha real se fija al firmar la Factura. PDF sin cambios (plantillas congeladas).

## 10. Contrato y cambio de temporada (BCOG-R6-001, decisión del usuario)
- "El contrato es de la temporada en curso; si cambio la temporada desaparece el contrato": al crear un contrato, si la temporada activa cambia con el formulario abierto, el formulario se cierra y descarta el borrador (aviso toast). En edición no aplica.

## 11. Fixtures de integración (temporada obligatoria)
- Codex actualizó los fixtures de `embarques-gestor-logistico`, `embarques-agl-webhook` y `productores` para crear/usar una Temporada y enviar `temporadaId` (solo tests). Ejecutadas por Claude contra fas_test: 26/26 OK.

## 12. Vencimiento estimado de cuotas en el PDF de las Proformas (agregado 2026-11-09, post push 9beed7a)
- Plantillas nuevas **v3** de `proforma-material` y `proforma-productor` (v1/v2 congeladas, Etapa 4 §8); `plantillaActual: 'v3'`.
- Tabla "Cuotas de Pago" con columna "Vence (estimado)" = fecha de la Proforma + plazo, solo referencia Factura (otras "—"); helper `resolvers/vencimiento-estimado.ts`, mismo criterio que la pantalla.
- Cabecera muestra "Tipo de documento" (Factura Nacional / Factura Exenta). Totales según `tipoDte` del payload (BCOG-R8-001, no según el monto): 34 → solo fila Exento (también con total 0); 33 → Neto + IVA. Proforma Productor v3 sin columna Afecto/Exento por línea.
- Schemas de payload: `cuotas[].vencimientoEstimado`, `tipoDocumento`, `totales.exento` (material) opcionales para no romper v1/v2.

## 13. Fix producción: crear Factura desde Proforma a Productor → 500 (2026-11-09)
- Causa: `getProformaProductorParaFactura` (factura-nacional.repository.ts) seguía seleccionando `lineas.exento`, columna eliminada por la migración 20261110090000. Prisma rechaza la consulta en runtime (tsc no lo detectó por el tipado extendido del cliente). Afectaba toda creación de Factura desde Proforma a Productor (no solo tras anular).
- Corrección: se quita `exento` del select (afecto/exento sale de `proformaProductor.tipoDte`). Verificado ejecutando la consulta contra fas_test: falla con el select viejo, OK con el nuevo. Revisadas las demás columnas eliminadas hoy (`notas_venta.notaCalidadHastaId/notaCondicionHastaId`): sus referencias restantes son a nivel de detalle (válidas).
