-- Pallet cuya Guía de Despacho la emite "Agrosan" (la empresa exportadora),
-- marcado así en la columna Emisor del Packing List. Queda sin número de guía
-- ni emisor-entidad (pendiente de que Agrosan la emita).
ALTER TABLE "pallets" ADD COLUMN "guiaEmitidaPorAgrosan" BOOLEAN NOT NULL DEFAULT false;
