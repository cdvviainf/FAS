/*
  Warnings:

  - You are about to drop the column `formaPagoId` on the `notas_venta` table.
  - You are about to drop the column `saldoPagoId` on the `notas_venta` table.
  - You are about to drop the `notas_venta_detalle_calibre` table. Sin
    registros de Cierre Comercial en ningún ambiente al momento de esta
    migración (Nota de Venta / notas_venta aún no se usa en producción).
  - Added the required columns `calibreFinId` and `calibreInicioId` to the
    `notas_venta_detalle` table without a default. Seguro porque la tabla
    está vacía.

*/
-- DropForeignKey
ALTER TABLE "notas_venta_detalle_calibre" DROP CONSTRAINT "notas_venta_detalle_calibre_calibreId_fkey";

-- DropForeignKey
ALTER TABLE "notas_venta_detalle_calibre" DROP CONSTRAINT "notas_venta_detalle_calibre_detalleId_fkey";

-- AlterTable
ALTER TABLE "notas_venta" DROP COLUMN "formaPagoId",
DROP COLUMN "saldoPagoId",
ADD COLUMN     "condicionPagoId" INTEGER;

-- AlterTable
ALTER TABLE "notas_venta_detalle" ADD COLUMN     "calibreFinId" INTEGER NOT NULL,
ADD COLUMN     "calibreInicioId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "notas_venta_detalle_calibre";

-- CreateIndex
CREATE INDEX "notas_venta_condicionPagoId_idx" ON "notas_venta"("condicionPagoId");

-- AddForeignKey
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_modalidadVentaId_fkey" FOREIGN KEY ("modalidadVentaId") REFERENCES "parametros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_clausulaVentaId_fkey" FOREIGN KEY ("clausulaVentaId") REFERENCES "parametros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_tipoFleteId_fkey" FOREIGN KEY ("tipoFleteId") REFERENCES "parametros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_condicionPagoId_fkey" FOREIGN KEY ("condicionPagoId") REFERENCES "condiciones_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta_detalle" ADD CONSTRAINT "notas_venta_detalle_calibreInicioId_fkey" FOREIGN KEY ("calibreInicioId") REFERENCES "calibres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta_detalle" ADD CONSTRAINT "notas_venta_detalle_calibreFinId_fkey" FOREIGN KEY ("calibreFinId") REFERENCES "calibres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
