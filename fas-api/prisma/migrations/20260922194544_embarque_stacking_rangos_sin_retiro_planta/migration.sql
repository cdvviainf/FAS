-- AlterTable
ALTER TABLE "embarques" DROP COLUMN "fechaRetiroPlantaManual",
DROP COLUMN "stackingDesde",
DROP COLUMN "stackingHasta";

-- CreateTable
CREATE TABLE "embarque_stacking_rangos" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "embarqueId" INTEGER NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,
    "hasta" TIMESTAMP(3) NOT NULL,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "embarque_stacking_rangos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "embarque_stacking_rangos_embarqueId_idx" ON "embarque_stacking_rangos"("embarqueId");

-- CreateIndex
CREATE INDEX "embarque_stacking_rangos_empresaId_idx" ON "embarque_stacking_rangos"("empresaId");

-- AddForeignKey
ALTER TABLE "embarque_stacking_rangos" ADD CONSTRAINT "embarque_stacking_rangos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embarque_stacking_rangos" ADD CONSTRAINT "embarque_stacking_rangos_empresaId_embarqueId_fkey" FOREIGN KEY ("empresaId", "embarqueId") REFERENCES "embarques"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

