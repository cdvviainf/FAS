-- AlterTable
ALTER TABLE "embarques" ADD COLUMN     "fechaArribo" TIMESTAMP(3),
ADD COLUMN     "observacionesInstructivo" TEXT,
ADD COLUMN     "stackingDesde" TIMESTAMP(3),
ADD COLUMN     "stackingHasta" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "instructivos_hijos" DROP COLUMN "stackingDesde",
DROP COLUMN "stackingHasta";

