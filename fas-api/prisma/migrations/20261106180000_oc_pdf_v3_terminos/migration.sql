-- PDF Orden de Compra v3 (2026-11-06, QA/plan-oc-pdf-v3-nov2026.md):
-- Términos y Condiciones editables por empresa (bilingües) + nota final.

CREATE TYPE "IconoClausula" AS ENUM ('CALIDAD', 'INOCUIDAD', 'COSTOS', 'TRIBUTARIO', 'EMBARQUE', 'ACEPTACION', 'DOCUMENTO', 'INFO');

ALTER TABLE "empresas" ADD COLUMN "notaTerminosOcEs" TEXT,
ADD COLUMN "notaTerminosOcEn" TEXT;

CREATE TABLE "empresa_clausulas_oc" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "icono" "IconoClausula" NOT NULL,
    "tituloEs" TEXT NOT NULL,
    "textoEs" TEXT NOT NULL,
    "tituloEn" TEXT NOT NULL,
    "textoEn" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    CONSTRAINT "empresa_clausulas_oc_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "empresa_clausulas_oc_empresaId_idx" ON "empresa_clausulas_oc"("empresaId");

ALTER TABLE "empresa_clausulas_oc" ADD CONSTRAINT "empresa_clausulas_oc_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Texto inicial para Agrosan (código AGROSAN) ──────────────────────────────
-- EN tomado del modelo corporativo; ES traducción. `{empresa}` se reemplaza por
-- la razón social de la empresa al renderizar. Otras empresas quedan sin
-- cláusulas (sin hoja de términos) hasta que se configuren.
INSERT INTO "empresa_clausulas_oc" ("empresaId", "orden", "icono", "tituloEs", "textoEs", "tituloEn", "textoEn", "creadoPor")
SELECT e."id", c.orden, c.icono::"IconoClausula", c.titulo_es, c.texto_es, c.titulo_en, c.texto_en, 'sistema'
FROM "empresas" e
CROSS JOIN (VALUES
  (1, 'CALIDAD', 'Calidad y condición',
   $t$El proveedor es responsable de la calidad, condición y conformidad de la fruta con las especificaciones indicadas en esta Orden de Compra, incluyendo calibre, embalaje, etiqueta y presentación. Cualquier defecto, pudrición, deshidratación o rechazo imputable al proveedor, aun detectado en destino, podrá dar lugar a ajustes de precio y/o al reclamo de los costos y daños directos.$t$,
   'Quality and Condition',
   $t$The supplier is responsible for the quality, condition and conformity of the fruit with the specifications indicated in this Purchase Order, including size, caliber, packing, label and presentation. Any defects, decay, dehydration or rejection attributable to the supplier, even if detected at destination, may result in price adjustments and/or claim of direct costs and damages.$t$),
  (2, 'INOCUIDAD', 'Inocuidad y cumplimiento fitosanitario',
   $t$El proveedor garantiza que la fruta cumple con toda la normativa aplicable de inocuidad, fitosanitaria y de límites máximos de residuos (LMR) exigidos por el mercado de destino. El proveedor es responsable de cualquier incumplimiento que impida o limite la exportación o comercialización de la fruta.$t$,
   'Food Safety and Phytosanitary Compliance',
   $t$The supplier guarantees that the fruit complies with all applicable food safety, phytosanitary and maximum residue limits (MRLs) required by the destination market. The supplier is responsible for any non-compliance that prevents or limits the export or commercialization of the fruit.$t$),
  (3, 'COSTOS', 'Costos y compensación',
   $t$Cualquier costo, gasto o daño adicional en que incurra {empresa} por incumplimientos, defectos de calidad u otros hechos imputables al proveedor podrá descontarse de los montos adeudados al proveedor y/o cargarse en la liquidación correspondiente.$t$,
   'Costs and Compensation',
   $t$Any additional costs, expenses or damages incurred by {empresa} due to non-compliance, quality defects or other issues attributable to the supplier may be deducted from the amounts due to the supplier and/or charged in the corresponding settlement.$t$),
  (4, 'TRIBUTARIO', 'Cumplimiento tributario y recuperación del IVA',
   $t$El proveedor declara cumplir íntegramente sus obligaciones tributarias. Si el Servicio de Impuestos Internos (SII) observa o rechaza, total o parcialmente, la devolución del crédito fiscal IVA exportador por incumplimiento imputable al proveedor, Agrosan podrá retener pagos pendientes y/o compensar el monto rechazado, incluidas las multas y costos aplicables, contra los montos adeudados al proveedor, una vez acreditada debidamente la situación.$t$,
   'Tax Compliance and VAT Recovery',
   $t$The supplier declares full compliance with its tax obligations. If the Chilean Tax Authority (SII) observes or rejects, in whole or in part, the recovery of the export VAT credit due to non-compliance attributable to the supplier, Agrosan may withhold pending payments and/or offset the rejected amount, including applicable fines and costs, against amounts owed to the supplier, once the situation has been duly substantiated.$t$),
  (5, 'EMBARQUE', 'Precio y embarque',
   $t$El precio unitario corresponde al Incoterm indicado conforme a Incoterms 2020 y rige solo para la nave y fecha de embarque indicadas. Cualquier cambio de nave o postergación podrá implicar un ajuste o renegociación del precio.$t$,
   'Price and Shipment',
   $t$The unit price corresponds to the indicated Incoterm in accordance with Incoterms 2020 and is valid only for the vessel and shipment date indicated. Any change in vessel or postponement may imply an adjustment or renegotiation of the price.$t$),
  (6, 'ACEPTACION', 'Aceptación',
   $t$La aceptación de esta Orden de Compra por parte del proveedor, mediante firma, correo electrónico u otro medio verificable, implica la conformidad total con estos términos y condiciones comerciales, que forman parte integrante de la venta. Toda modificación deberá constar por escrito y ser aceptada por ambas partes.$t$,
   'Acceptance',
   $t$The supplier's acceptance of this Purchase Order, by signature, email or other verifiable means, implies full agreement with these commercial terms and conditions, which form an integral part of the sale. Any modification must be in writing and accepted by both parties.$t$)
) AS c(orden, icono, titulo_es, texto_es, titulo_en, texto_en)
WHERE e."codigo" = 'AGROSAN' AND e."eliminadoEn" IS NULL;

UPDATE "empresas"
SET "notaTerminosOcEs" = $t$La fecha y hora de carga en el packing se indicará en el instructivo de embarque. Esta Orden de Compra se emite electrónicamente y está sujeta a los términos y condiciones aquí establecidos.$t$,
    "notaTerminosOcEn" = $t$The date and time for loading at the packing facility will be indicated in the shipping instruction. This Purchase Order is issued electronically and is subject to the terms and conditions stated herein.$t$
WHERE "codigo" = 'AGROSAN' AND "eliminadoEn" IS NULL;
