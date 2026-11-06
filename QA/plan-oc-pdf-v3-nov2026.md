# Plan — PDF Orden de Compra v3 (formato corporativo) — nov-2026

Fecha: 2026-11-06 · Alcance QA: `oc-pdf-v3-nov2026`
Referencia visual: `Docs/Orden de Compra Corporativa de Frutas.png` (2 hojas).

## Decisiones del usuario (2026-11-06)

- Bilingüe ES/EN (como la v2: el idioma se elige al emitir).
- Cabecera: logo de la empresa + imagen de la especie. La leyenda "Fresh fruit from Chile to the
  world" es **parte de la imagen del logo** (no se agrega texto).
- La hoja 2 repite la cabecera (versión compacta: logo + título/N°/fecha, sin imagen de especie).
- Comprador — Contacto/Teléfono/Email = **responsable de la OC** (Usuario: nombre, `whatsapp` como teléfono — campo ya existente y editable en la ficha —, email).
- Bloque **Embarque: se elimina** (no va en el PDF).
- Términos y Condiciones (hoja 2): **editables por empresa**, ES/EN.

## Plantilla v3 (`templates/orden-compra/v3`)

Nueva versión; `plantillaActual: 'v3'`. v1/v2 se conservan para reimpresiones (regla de versionado).

Hoja 1:
1. Cabecera: logo (izq.) · imagen de especie (der., recorte diagonal) · título grande "ORDEN DE COMPRA /
   PURCHASE ORDER" · "N° OC-AAAA-NNNN | Fecha de emisión".
2. Dos tarjetas: **Comprador** (razón social, RUT, dirección completa, contacto/teléfono/email del
   responsable) y **Proveedor / Productor** (razón social, RUT, dirección completa, contacto/teléfono/email
   del contacto principal).
3. **Condiciones de compra** (íconos: forma de pago, moneda, Incoterm) + **Calendario de pago** (cuotas).
   Modalidad GRANEL: se agrega la tarjeta "Condiciones de granel" (como hoy).
4. **Detalle de productos**: columna `#` + las columnas actuales (cajas: especie, variedad, embalaje/
   artículo, etiqueta, categoría, calibre, pallets, cajas, precio unit., total, kg neto/caja, kg bruto/
   caja, kg neto total, kg bruto total; granel: las actuales). Fila TOTAL.
5. **Facturación** ("Facturar a": razón social, dirección, RUT de la empresa) y **Observaciones**.
6. Firmas: "{Razón social empresa} — Firma autorizada" (con la firma PNG del responsable si existe) y
   "Proveedor / Productor — Firma autorizada".

Hoja 2 (solo si la empresa tiene cláusulas configuradas):
- Cabecera compacta + barra "TÉRMINOS Y CONDICIONES GENERALES / GENERAL TERMS AND CONDITIONS".
- Cláusulas numeradas (círculo con N°, ícono, título, texto) en el idioma del documento.
- Nota final (ícono "!") en el idioma del documento.
- Pie "Página X de Y / Page X of Y" en todas las hojas.
- Sin cláusulas configuradas → no hay hoja 2 (se mantiene la nota genérica actual al pie).

Estilo: barras de sección azul corporativo, tarjetas con fondo gris-azulado claro, íconos SVG inline
(sin red — Playwright offline).

## Datos nuevos

- Dirección completa: el resolver arma "dirección, comuna, región, país" desde `EntidadDireccion` /
  `EmpresaDireccion` (comuna→provincia→región, país) — solo lectura, sin cambios de modelo.
- Proveedor: teléfono/email del contacto principal (ya existen en `EntidadContacto`).
- Términos por empresa:
  - `EmpresaClausulaOc` (id, empresaId, orden, icono enum, tituloEs, textoEs, tituloEn, textoEn,
    creadoEn/Por, actualizadoEn/Por). **No** va en `MODELOS_TENANT`: se administra desde el mantenedor
    Empresas para cualquier empresa (mismo criterio que `EmpresaDireccion`/`EmpresaContacto`); el
    resolver la lee filtrando explícitamente por la empresa del documento.
  - API: `PUT /api/config/empresas/:id/terminos-oc` (replace-all en transacción: nota ES/EN + cláusulas);
    el GET de la empresa incluye `clausulasOc` y las notas.
  - `Empresa.notaTerminosOcEs String?` / `Empresa.notaTerminosOcEn String?`.
  - Enum `IconoClausula`: CALIDAD, INOCUIDAD, COSTOS, TRIBUTARIO, EMBARQUE, ACEPTACION, DOCUMENTO, INFO.
  - UI: sección "Términos de la Orden de Compra" en el form de Empresa (lista ordenable: ícono, título
    ES/EN, texto ES/EN; nota final ES/EN). Permiso: el mismo del mantenedor Empresas.
  - Migración: siembra las 6 cláusulas + nota para la empresa con código `AGROSAN` (texto abajo).
    AGDry queda sin cláusulas (sin hoja 2) hasta que se configuren.

## Texto inicial (Agrosan) — EN tomado del modelo; ES borrador para revisión

1. **Calidad y condición / Quality and Condition** (CALIDAD)
   ES: El proveedor es responsable de la calidad, condición y conformidad de la fruta con las
   especificaciones indicadas en esta Orden de Compra, incluyendo calibre, embalaje, etiqueta y
   presentación. Cualquier defecto, pudrición, deshidratación o rechazo imputable al proveedor, aun
   detectado en destino, podrá dar lugar a ajustes de precio y/o al reclamo de los costos y daños directos.
2. **Inocuidad y cumplimiento fitosanitario / Food Safety and Phytosanitary Compliance** (INOCUIDAD)
   ES: El proveedor garantiza que la fruta cumple con toda la normativa aplicable de inocuidad,
   fitosanitaria y de límites máximos de residuos (LMR) exigidos por el mercado de destino. El proveedor
   es responsable de cualquier incumplimiento que impida o limite la exportación o comercialización de la fruta.
3. **Costos y compensación / Costs and Compensation** (COSTOS)
   ES: Cualquier costo, gasto o daño adicional en que incurra {empresa} por incumplimientos, defectos de
   calidad u otros hechos imputables al proveedor podrá descontarse de los montos adeudados al proveedor
   y/o cargarse en la liquidación correspondiente.
4. **Cumplimiento tributario y recuperación del IVA / Tax Compliance and VAT Recovery** (TRIBUTARIO)
   ES: El proveedor declara cumplir íntegramente sus obligaciones tributarias. Si el Servicio de
   Impuestos Internos (SII) observa o rechaza, total o parcialmente, la devolución del crédito fiscal IVA
   exportador por incumplimiento imputable al proveedor, Agrosan podrá retener pagos pendientes y/o
   compensar el monto rechazado, incluidas las multas y costos aplicables, contra los montos adeudados al
   proveedor, una vez acreditada debidamente la situación.
5. **Precio y embarque / Price and Shipment** (EMBARQUE)
   ES: El precio unitario corresponde al Incoterm indicado conforme a Incoterms 2020 y rige solo para la
   nave y fecha de embarque indicadas. Cualquier cambio de nave o postergación podrá implicar un ajuste o
   renegociación del precio.
6. **Aceptación / Acceptance** (ACEPTACION)
   ES: La aceptación de esta Orden de Compra por parte del proveedor, mediante firma, correo electrónico u
   otro medio verificable, implica la conformidad total con estos términos y condiciones comerciales, que
   forman parte integrante de la venta. Toda modificación deberá constar por escrito y ser aceptada por
   ambas partes.

Nota final — ES: "La fecha y hora de carga en el packing se indicará en el instructivo de embarque. Esta
Orden de Compra se emite electrónicamente y está sujeta a los términos y condiciones aquí establecidos."
EN: tal cual el modelo.

`{empresa}` = marcador reemplazado por la razón social de la empresa al renderizar.

## Riesgos

- La OC emitida guarda su versión: las ya emitidas siguen con v2 al reimprimir.
- Ajustar el layout para que la hoja 1 quepa en A4 con ~8 líneas de detalle; con más líneas, la tabla
  continúa en la hoja siguiente y los términos pasan a la última.

## Estado de implementación (2026-11-06)

Implementado por Claude, pendiente QA Codex. Backend: migración `20261106180000_oc_pdf_v3_terminos`,
`config/empresas` (schema/repo/service/controller/routes `PUT /:id/terminos-oc`), `documentos.repository.ts`
(direcciones completas, email de contacto, `getTerminosOc`), `resolvers/orden-compra.resolver.ts`,
`schemas/orden-compra.schema.ts`, `templates/orden-compra/v3/{index.tsx,estilos.ts,iconos.ts}`, registro
`plantillaActual: 'v3'`, `ui/Documento.tsx` (prop `numeracion`), `ui/formato.ts` (`numeroIdioma`,
`fechaLarga`), `shared/pdf/render.ts` (pie con numeración). Frontend: `features/empresas` (types, service,
`components/terminos-oc-form.tsx`, pestaña en `empresa-form.tsx`).
Render verificado con datos de ejemplo: 2 hojas A4 (ES y EN).

## Ronda QA 1 → correcciones (2026-11-06)

- OC-PDF-V3-001 (Media) — **Corregido**: sin cláusulas configuradas (`terminos === null`) la hoja 1 muestra
  la nota genérica sobre las firmas, en el idioma del documento (decisión del usuario: ES y EN).
  ES: "* El precio unitario corresponde al Incoterm indicado conforme a Incoterms 2020. La aprobación del
  lote será hecha por el cliente final en destino." EN: "* The unit price corresponds to the indicated
  Incoterm in accordance with Incoterms 2020. Lot approval will be made by the final customer at destination."
