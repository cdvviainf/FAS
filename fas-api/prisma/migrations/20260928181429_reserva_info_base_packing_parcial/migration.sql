-- AlterTable
ALTER TABLE "embarque_packing_lists" ADD COLUMN     "numerosPallet" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "embarques" ADD COLUMN     "cbm" INTEGER,
ADD COLUMN     "fechaCompromiso" TIMESTAMP(3),
ADD COLUMN     "temperatura" INTEGER,
ADD COLUMN     "tipoBlId" INTEGER;

-- AddForeignKey
ALTER TABLE "embarques" ADD CONSTRAINT "embarques_empresaId_tipoBlId_fkey" FOREIGN KEY ("empresaId", "tipoBlId") REFERENCES "parametros"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

