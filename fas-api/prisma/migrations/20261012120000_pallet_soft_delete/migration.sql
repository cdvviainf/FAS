-- Pallet soft delete (2026-10-12): eliminar un pallet desde Edición de Stock
-- (OPER_STOCK_EDICION). Solo permitido sobre stock libre (embarqueId IS NULL),
-- mismo guard que editar el lote. Las pallet_lineas quedan vivas en BD pero
-- ocultas al filtrar el pallet por eliminadoEn IS NULL.
ALTER TABLE "pallets" ADD COLUMN "eliminadoEn" TIMESTAMP(3);
ALTER TABLE "pallets" ADD COLUMN "eliminadoPor" TEXT;

CREATE INDEX "pallets_eliminadoEn_idx" ON "pallets"("eliminadoEn");
