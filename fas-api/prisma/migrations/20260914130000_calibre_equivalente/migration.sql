-- Calibre equivalente: relación auto-referencial (otro calibre de la misma
-- especie; por defecto apunta a sí mismo). FK compuesta (empresaId,
-- calibreEquivalenteId) -> calibres(empresaId, id) — la misma-especie se valida
-- en el service.
ALTER TABLE "calibres" ADD COLUMN "calibreEquivalenteId" INTEGER;

-- Target de la FK compuesta.
CREATE UNIQUE INDEX IF NOT EXISTS "calibres_empresaId_id_key" ON "calibres"("empresaId", "id");

ALTER TABLE "calibres"
  ADD CONSTRAINT "calibres_empresaId_calibreEquivalenteId_fkey"
  FOREIGN KEY ("empresaId", "calibreEquivalenteId")
  REFERENCES "calibres"("empresaId", "id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Calibres existentes: por defecto, cada uno es su propio equivalente.
UPDATE "calibres" SET "calibreEquivalenteId" = "id" WHERE "calibreEquivalenteId" IS NULL AND "eliminadoEn" IS NULL;
