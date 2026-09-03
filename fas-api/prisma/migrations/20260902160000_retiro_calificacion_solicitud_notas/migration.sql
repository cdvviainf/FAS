-- DropForeignKey
ALTER TABLE "solicitudes_inspeccion" DROP CONSTRAINT "solicitudes_inspeccion_empresaId_calificacionId_fkey";

-- DropForeignKey
ALTER TABLE "calificaciones" DROP CONSTRAINT "calificaciones_empresaId_fkey";

-- AlterTable
ALTER TABLE "solicitudes_inspeccion" DROP COLUMN "calificacionId",
ADD COLUMN     "notaCalidadId" INTEGER,
ADD COLUMN     "notaCondicionId" INTEGER;

-- DropTable
DROP TABLE "calificaciones";

-- AddForeignKey
ALTER TABLE "solicitudes_inspeccion" ADD CONSTRAINT "solicitudes_inspeccion_empresaId_notaCalidadId_fkey" FOREIGN KEY ("empresaId", "notaCalidadId") REFERENCES "notas_calidad"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_inspeccion" ADD CONSTRAINT "solicitudes_inspeccion_empresaId_notaCondicionId_fkey" FOREIGN KEY ("empresaId", "notaCondicionId") REFERENCES "notas_condicion"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

