/*
  Warnings:

  - You are about to drop the column `condicionPagoTexto` on the `ordenes_compra` table. All the data in the column will be lost.
  - You are about to drop the column `facturarAId` on the `ordenes_compra` table. All the data in the column will be lost.
  - You are about to drop the column `formaPago` on the `ordenes_compra` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ordenes_compra" DROP CONSTRAINT "ordenes_compra_facturarAId_fkey";

-- AlterTable
ALTER TABLE "ordenes_compra" DROP COLUMN "condicionPagoTexto",
DROP COLUMN "facturarAId",
DROP COLUMN "formaPago",
ADD COLUMN     "condicionPagoId" INTEGER,
ADD COLUMN     "destinoMercadoId" INTEGER,
ADD COLUMN     "fechaEntregaDesde" DATE,
ADD COLUMN     "fechaEntregaHasta" DATE,
ADD COLUMN     "formaPagoId" INTEGER,
ADD COLUMN     "responsableId" TEXT;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "esResponsableVenta" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "condiciones_pago" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "condiciones_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "condicion_pago_cuota" (
    "id" SERIAL NOT NULL,
    "condicionPagoId" INTEGER NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "plazoDias" INTEGER NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "condicion_pago_cuota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "condicion_pago_cuota_condicionPagoId_idx" ON "condicion_pago_cuota"("condicionPagoId");

-- CreateIndex
CREATE INDEX "ordenes_compra_condicionPagoId_idx" ON "ordenes_compra"("condicionPagoId");

-- CreateIndex
CREATE INDEX "ordenes_compra_destinoMercadoId_idx" ON "ordenes_compra"("destinoMercadoId");

-- CreateIndex
CREATE INDEX "ordenes_compra_responsableId_idx" ON "ordenes_compra"("responsableId");

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_condicionPagoId_fkey" FOREIGN KEY ("condicionPagoId") REFERENCES "condiciones_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_destinoMercadoId_fkey" FOREIGN KEY ("destinoMercadoId") REFERENCES "mercados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condicion_pago_cuota" ADD CONSTRAINT "condicion_pago_cuota_condicionPagoId_fkey" FOREIGN KEY ("condicionPagoId") REFERENCES "condiciones_pago"("id") ON DELETE CASCADE ON UPDATE CASCADE;
