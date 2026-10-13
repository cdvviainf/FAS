-- Guía de Despacho (DTE 52) del Embarque (2026-10-09): datos de transporte
-- capturados al emitir la Guía desde la pestaña Despachar. El DTE en sí (folio,
-- XML, estado) se registra en documentos_dte con origenTipo='embarque'.
ALTER TABLE "embarques" ADD COLUMN "guiaIndTraslado" INTEGER;
ALTER TABLE "embarques" ADD COLUMN "guiaTransporteId" INTEGER;
ALTER TABLE "embarques" ADD COLUMN "guiaChoferRut" TEXT;
ALTER TABLE "embarques" ADD COLUMN "guiaChoferNombre" TEXT;
ALTER TABLE "embarques" ADD COLUMN "guiaPatenteCamion" TEXT;
ALTER TABLE "embarques" ADD COLUMN "guiaPatenteRemolque" TEXT;
ALTER TABLE "embarques" ADD COLUMN "guiaDirOrigen" TEXT;
ALTER TABLE "embarques" ADD COLUMN "guiaComunaOrigen" TEXT;
ALTER TABLE "embarques" ADD COLUMN "guiaDirDestino" TEXT;
ALTER TABLE "embarques" ADD COLUMN "guiaComunaDestino" TEXT;

CREATE INDEX "embarques_guiaTransporteId_idx" ON "embarques"("guiaTransporteId");

ALTER TABLE "embarques" ADD CONSTRAINT "embarques_empresaId_guiaTransporteId_fkey" FOREIGN KEY ("empresaId", "guiaTransporteId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
