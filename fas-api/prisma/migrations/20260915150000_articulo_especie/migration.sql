-- Especie (opcional) del artículo: agrupa embalajes por especie en el editor
-- de Cajas por Pallet. FK compuesta (empresaId, especieId) -> especies(empresaId, id).
ALTER TABLE "articulos" ADD COLUMN "especieId" INTEGER;

ALTER TABLE "articulos"
  ADD CONSTRAINT "articulos_empresaId_especieId_fkey"
  FOREIGN KEY ("empresaId", "especieId") REFERENCES "especies"("empresaId", "id")
  ON DELETE SET NULL ON UPDATE CASCADE;
