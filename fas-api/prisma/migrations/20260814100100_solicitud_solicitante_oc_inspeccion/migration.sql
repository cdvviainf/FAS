/*
  Warnings:

  - A new required column `usuarioSolicitanteId` is added to `solicitudes_inspeccion`
    without a default — se hace en 3 pasos (agregar nullable, backfill desde
    `creadoPor`, forzar NOT NULL) para no romper filas existentes.

*/

-- Backfill: toda solicitud ya CERRADA se considera APROBADA (no había
-- concepto de rechazo antes de este cambio). El valor nuevo del enum ya está
-- committeado por la migración anterior.
UPDATE "solicitudes_inspeccion" SET "estado" = 'APROBADA' WHERE "estado" = 'CERRADA';

-- AlterTable: usuarioSolicitanteId (nullable primero, backfill, luego NOT NULL)
ALTER TABLE "solicitudes_inspeccion" ADD COLUMN "usuarioSolicitanteId" TEXT;

UPDATE "solicitudes_inspeccion" SET "usuarioSolicitanteId" = "creadoPor" WHERE "usuarioSolicitanteId" IS NULL;

ALTER TABLE "solicitudes_inspeccion" ALTER COLUMN "usuarioSolicitanteId" SET NOT NULL;

-- CreateIndex (requerido para la FK compuesta empresaId+id desde ordenes_compra)
CREATE UNIQUE INDEX "solicitudes_inspeccion_empresaId_id_key" ON "solicitudes_inspeccion"("empresaId", "id");

-- AddForeignKey
ALTER TABLE "solicitudes_inspeccion" ADD CONSTRAINT "solicitudes_inspeccion_usuarioSolicitanteId_fkey" FOREIGN KEY ("usuarioSolicitanteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: solicitudInspeccionId en ordenes_compra (nullable a nivel de
-- columna — obligatoriedad real vía service/schema, mismo criterio que
-- Articulo.etiquetaId).
ALTER TABLE "ordenes_compra" ADD COLUMN "solicitudInspeccionId" INTEGER;

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_empresaId_solicitudInspeccionId_fkey" FOREIGN KEY ("empresaId", "solicitudInspeccionId") REFERENCES "solicitudes_inspeccion"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;
