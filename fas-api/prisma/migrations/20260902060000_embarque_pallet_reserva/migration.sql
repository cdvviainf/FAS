-- AlterTable
ALTER TABLE "embarques" ADD COLUMN     "despachadoEn" TIMESTAMP(3),
ADD COLUMN     "despachadoPor" TEXT;

-- AlterTable
ALTER TABLE "pallets" ADD COLUMN     "embarqueId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "embarques_empresaId_id_key" ON "embarques"("empresaId", "id");

-- CreateIndex
CREATE INDEX "pallets_embarqueId_idx" ON "pallets"("embarqueId");

-- AddForeignKey
ALTER TABLE "pallets" ADD CONSTRAINT "pallets_empresaId_embarqueId_fkey" FOREIGN KEY ("empresaId", "embarqueId") REFERENCES "embarques"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
