-- AlterTable
ALTER TABLE "movimientos" ADD COLUMN     "movimientoInversoDeId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_movimientoInversoDeId_key" ON "movimientos"("movimientoInversoDeId");

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_movimientoInversoDeId_fkey" FOREIGN KEY ("movimientoInversoDeId") REFERENCES "movimientos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
