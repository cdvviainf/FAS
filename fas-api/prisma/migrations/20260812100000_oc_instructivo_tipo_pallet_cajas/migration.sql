/*
  Warnings:

  - You are about to drop the column `fechaEntregaDesde` on the `ordenes_compra` table. All the data in the column will be lost.
  - You are about to drop the column `fechaEntregaHasta` on the `ordenes_compra` table. All the data in the column will be lost.
  - You are about to drop the column `incotermId` on the `ordenes_compra` table. All the data in the column will be lost.
  - A unique constraint covering the columns on the `orden_compra_linea` table will require the column `cajas` to be populated.
  - A unique constraint covering the columns on the `instructivo_embalaje_detalle` table will require the column `cajas` to be populated.

*/
-- AlterTable
ALTER TABLE "ordenes_compra" DROP COLUMN "fechaEntregaDesde",
DROP COLUMN "fechaEntregaHasta",
DROP COLUMN "incotermId";

-- AlterTable
ALTER TABLE "orden_compra_linea" ADD COLUMN "tipoPalletId" INTEGER,
ADD COLUMN "cajas" INTEGER;

-- Backfill: cajas = cantidadPallets × cajasPorPallet para líneas ya existentes
UPDATE "orden_compra_linea" SET "cajas" = "cantidadPallets" * "cajasPorPallet" WHERE "cajas" IS NULL;

ALTER TABLE "orden_compra_linea" ALTER COLUMN "cajas" SET NOT NULL;

-- AlterTable
ALTER TABLE "instructivo_embalaje_detalle" ADD COLUMN "tipoPalletId" INTEGER,
ADD COLUMN "cajas" INTEGER;

-- Backfill: cajas = cantidadPallets × cajasPorPallet para líneas ya existentes
UPDATE "instructivo_embalaje_detalle" SET "cajas" = "cantidadPallets" * "cajasPorPallet" WHERE "cajas" IS NULL;

ALTER TABLE "instructivo_embalaje_detalle" ALTER COLUMN "cajas" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "orden_compra_linea" ADD CONSTRAINT "orden_compra_linea_tipoPalletId_fkey" FOREIGN KEY ("tipoPalletId") REFERENCES "tipos_pallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructivo_embalaje_detalle" ADD CONSTRAINT "instructivo_embalaje_detalle_tipoPalletId_fkey" FOREIGN KEY ("tipoPalletId") REFERENCES "tipos_pallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
