-- PDF Cierre Comercial v2 (2026-11-06, QA/plan-cierre-pdf-v2-nov2026.md):
-- forma de pago del Cierre y texto de Reclamos por empresa (ES/EN).

ALTER TABLE "notas_venta" ADD COLUMN "formaPagoId" INTEGER;
CREATE INDEX "notas_venta_formaPagoId_idx" ON "notas_venta"("formaPagoId");
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_empresaId_formaPagoId_fkey" FOREIGN KEY ("empresaId", "formaPagoId") REFERENCES "formas_pago"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "empresas" ADD COLUMN "reclamosCierreEs" TEXT,
ADD COLUMN "reclamosCierreEn" TEXT,
ADD COLUMN "reclamosCierreRefEs" TEXT,
ADD COLUMN "reclamosCierreRefEn" TEXT;

-- Texto inicial para Agrosan (EN del modelo; ES traducido).
UPDATE "empresas"
SET "reclamosCierreEs" = $t$Todo reclamo relacionado con la calidad o condición de la fruta a su llegada a destino (incluidos temperatura, daño, pudrición, deshidratación, etc.) debe notificarse y documentarse conforme al Protocolo de Reclamos de Agrosan, que forma parte integrante de esta Orden de Venta. Se aplicarán los plazos, el procedimiento de inspección y la documentación requerida establecidos en el Protocolo.$t$,
    "reclamosCierreEn" = $t$Any claim related to the quality or condition of the fruit upon arrival at destination (including temperature, damage, decay, dehydration, etc.) must be notified and documented in accordance with the Agrosan Claim Protocol, which forms an integral part of this Sales Order. The applicable deadlines, inspection procedure and required documentation set out in the Protocol shall apply.$t$,
    "reclamosCierreRefEs" = 'Protocolo de Reclamos Agrosan — Ver documento adjunto',
    "reclamosCierreRefEn" = 'Agrosan Claim Protocol — See attached document'
WHERE "codigo" = 'AGROSAN' AND "eliminadoEn" IS NULL;
