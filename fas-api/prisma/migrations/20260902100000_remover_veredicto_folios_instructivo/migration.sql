-- DropForeignKey
ALTER TABLE "instructivo_embalaje_folios" DROP CONSTRAINT "instructivo_embalaje_folios_empresaId_instructivoId_fkey";

-- AlterTable
ALTER TABLE "instructivos_embalaje" DROP COLUMN "comentarioInspeccion",
DROP COLUMN "estadoInspeccion",
DROP COLUMN "inspeccionadoEn",
DROP COLUMN "inspeccionadoPor",
DROP COLUMN "notificadaEn";

-- AlterTable
ALTER TABLE "recepciones" ADD COLUMN     "advertenciasAceptadas" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "advertenciasAceptadasEn" TIMESTAMP(3),
ADD COLUMN     "advertenciasAceptadasPor" TEXT,
ADD COLUMN     "advertenciasDetalle" JSONB;

-- DropTable
DROP TABLE "instructivo_embalaje_folios";

-- DropEnum
DROP TYPE "EstadoFolioInspeccion";

-- DropEnum
DROP TYPE "InspeccionProcesoEstado";
