-- Solicitud de Inspección asociada a la Recepción (opcional).
ALTER TABLE "recepciones" ADD COLUMN "solicitudInspeccionId" INTEGER;

CREATE INDEX "recepciones_solicitudInspeccionId_idx" ON "recepciones"("solicitudInspeccionId");

ALTER TABLE "recepciones" ADD CONSTRAINT "recepciones_empresaId_solicitudInspeccionId_fkey" FOREIGN KEY ("empresaId", "solicitudInspeccionId") REFERENCES "solicitudes_inspeccion"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
