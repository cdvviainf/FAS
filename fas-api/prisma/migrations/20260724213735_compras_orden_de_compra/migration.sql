/*
  Warnings:

  - You are about to drop the column `ordenCompraId` on the `StockLote` table. All the data in the column will be lost.
  - You are about to drop the `OrdenCompra` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OrdenCompraItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PagoProductor` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "EstadoOrdenCompra" AS ENUM ('BORRADOR', 'EMITIDA', 'RECEPCIONADA');

-- DropForeignKey
ALTER TABLE "OrdenCompra" DROP CONSTRAINT "OrdenCompra_productorId_fkey";

-- DropForeignKey
ALTER TABLE "OrdenCompraItem" DROP CONSTRAINT "OrdenCompraItem_ordenCompraId_fkey";

-- DropForeignKey
ALTER TABLE "OrdenCompraItem" DROP CONSTRAINT "OrdenCompraItem_variedadId_fkey";

-- DropForeignKey
ALTER TABLE "PagoProductor" DROP CONSTRAINT "PagoProductor_ordenCompraId_fkey";

-- DropForeignKey
ALTER TABLE "StockLote" DROP CONSTRAINT "StockLote_ordenCompraId_fkey";

-- AlterTable
ALTER TABLE "StockLote" DROP COLUMN "ordenCompraId";

-- AlterTable
ALTER TABLE "articulos" ADD COLUMN     "etiqueta" TEXT,
ADD COLUMN     "kgBrutoEnvase" DECIMAL(10,3),
ADD COLUMN     "kgNetoEnvase" DECIMAL(10,3);

-- DropTable
DROP TABLE "OrdenCompra";

-- DropTable
DROP TABLE "OrdenCompraItem";

-- DropTable
DROP TABLE "PagoProductor";

-- DropEnum
DROP TYPE "OcEstado";

-- DropEnum
DROP TYPE "TipoPago";

-- CreateTable
CREATE TABLE "ordenes_compra" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "entidadProductorId" INTEGER NOT NULL,
    "notaVentaId" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "formaPago" TEXT,
    "condicionPagoTexto" TEXT,
    "monedaId" INTEGER NOT NULL,
    "incotermId" INTEGER,
    "facturarAId" INTEGER,
    "observaciones" TEXT,
    "estado" "EstadoOrdenCompra" NOT NULL DEFAULT 'BORRADOR',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "ordenes_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orden_compra_cuota_pago" (
    "id" SERIAL NOT NULL,
    "ordenCompraId" INTEGER NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "plazoDias" INTEGER NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "orden_compra_cuota_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orden_compra_linea" (
    "id" SERIAL NOT NULL,
    "ordenCompraId" INTEGER NOT NULL,
    "especieId" INTEGER NOT NULL,
    "variedadId" INTEGER NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "calibreMinId" INTEGER NOT NULL,
    "calibreMaxId" INTEGER NOT NULL,
    "cantidadPallets" INTEGER NOT NULL,
    "cajasPorPallet" INTEGER NOT NULL,
    "precioUsdCaja" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "orden_compra_linea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_compra_numero_key" ON "ordenes_compra"("numero");

-- CreateIndex
CREATE INDEX "ordenes_compra_entidadProductorId_idx" ON "ordenes_compra"("entidadProductorId");

-- CreateIndex
CREATE INDEX "ordenes_compra_notaVentaId_idx" ON "ordenes_compra"("notaVentaId");

-- CreateIndex
CREATE INDEX "orden_compra_cuota_pago_ordenCompraId_idx" ON "orden_compra_cuota_pago"("ordenCompraId");

-- CreateIndex
CREATE INDEX "orden_compra_linea_ordenCompraId_idx" ON "orden_compra_linea"("ordenCompraId");

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_entidadProductorId_fkey" FOREIGN KEY ("entidadProductorId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_notaVentaId_fkey" FOREIGN KEY ("notaVentaId") REFERENCES "notas_venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "monedas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_facturarAId_fkey" FOREIGN KEY ("facturarAId") REFERENCES "entidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra_cuota_pago" ADD CONSTRAINT "orden_compra_cuota_pago_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "ordenes_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra_linea" ADD CONSTRAINT "orden_compra_linea_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "ordenes_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra_linea" ADD CONSTRAINT "orden_compra_linea_especieId_fkey" FOREIGN KEY ("especieId") REFERENCES "especies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra_linea" ADD CONSTRAINT "orden_compra_linea_variedadId_fkey" FOREIGN KEY ("variedadId") REFERENCES "variedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra_linea" ADD CONSTRAINT "orden_compra_linea_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra_linea" ADD CONSTRAINT "orden_compra_linea_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra_linea" ADD CONSTRAINT "orden_compra_linea_calibreMinId_fkey" FOREIGN KEY ("calibreMinId") REFERENCES "calibres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra_linea" ADD CONSTRAINT "orden_compra_linea_calibreMaxId_fkey" FOREIGN KEY ("calibreMaxId") REFERENCES "calibres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
