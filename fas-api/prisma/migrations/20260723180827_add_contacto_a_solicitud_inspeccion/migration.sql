-- AlterTable
ALTER TABLE "solicitudes_inspeccion" ADD COLUMN     "contactoId" INTEGER;

-- AddForeignKey
ALTER TABLE "solicitudes_inspeccion" ADD CONSTRAINT "solicitudes_inspeccion_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "entidad_contactos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
