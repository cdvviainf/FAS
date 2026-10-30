-- Vínculo NC ↔ Reclamo: una NC parcial (crédito por reclamo aprobado) referencia
-- el reclamo que la origina. Null en las NC de anulación.
ALTER TABLE "notas_credito" ADD COLUMN "reclamoId" INTEGER;
ALTER TABLE "notas_credito"
  ADD CONSTRAINT "notas_credito_reclamoId_fkey"
  FOREIGN KEY ("reclamoId") REFERENCES "reclamos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "notas_credito_reclamoId_idx" ON "notas_credito"("reclamoId");
