-- Instructivo de Embalaje: el detalle pasa de Grupo de Mercado a MERCADO
-- (2026-10-14): ahora se pide el Mercado, no el Grupo de Mercado. No existe un
-- mapeo grupo→mercado y los instructivos actuales son datos de prueba, así que
-- se limpian las líneas existentes (sus calibres caen por cascade) antes de
-- cambiar la columna.
DELETE FROM "instructivo_embalaje_detalle";

DROP INDEX IF EXISTS "instructivo_embalaje_detalle_grupoMercadoId_idx";

ALTER TABLE "instructivo_embalaje_detalle" DROP COLUMN "grupoMercadoId";
ALTER TABLE "instructivo_embalaje_detalle" ADD COLUMN "mercadoId" INTEGER NOT NULL;

ALTER TABLE "instructivo_embalaje_detalle"
  ADD CONSTRAINT "instructivo_embalaje_detalle_mercadoId_fkey"
  FOREIGN KEY ("mercadoId") REFERENCES "mercados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "instructivo_embalaje_detalle_mercadoId_idx" ON "instructivo_embalaje_detalle"("mercadoId");
