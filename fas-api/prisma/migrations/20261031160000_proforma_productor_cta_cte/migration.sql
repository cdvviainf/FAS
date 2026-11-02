-- Proforma a Productor: concepto de cuenta corriente que impactará la CC del
-- productor cuando la Factura Nacional de origen se timbre (FAS-PP-QA-002, R16/VN5).
ALTER TABLE "proformas_productor" ADD COLUMN "conceptoCtaCteId" INTEGER;

-- CreateIndex
CREATE INDEX "proformas_productor_conceptoCtaCteId_idx" ON "proformas_productor"("conceptoCtaCteId");

-- AddForeignKey (FK compuesta empresaId + conceptoCtaCteId -> conceptos_cta_cte)
ALTER TABLE "proformas_productor"
  ADD CONSTRAINT "proformas_productor_empresaId_conceptoCtaCteId_fkey"
  FOREIGN KEY ("empresaId", "conceptoCtaCteId") REFERENCES "conceptos_cta_cte"("empresaId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
