-- Planta en Solicitud de Inspección (Entidad tipo PLANTA, opcional) y Exportador
-- en Nota de Venta / Cierre Comercial (Entidad tipo EXPORTADORA, opcional).
-- Columnas aditivas nullables + índice simple + FK COMPUESTA (empresaId, X) ->
-- entidades(empresaId, id), mismo patrón multiempresa que clienteId/notifyId.

ALTER TABLE "solicitudes_inspeccion" ADD COLUMN "plantaId" INTEGER;
CREATE INDEX "solicitudes_inspeccion_plantaId_idx" ON "solicitudes_inspeccion"("plantaId");
ALTER TABLE "solicitudes_inspeccion" ADD CONSTRAINT "solicitudes_inspeccion_empresaId_plantaId_fkey" FOREIGN KEY ("empresaId", "plantaId") REFERENCES "entidades"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notas_venta" ADD COLUMN "exportadorId" INTEGER;
CREATE INDEX "notas_venta_exportadorId_idx" ON "notas_venta"("exportadorId");
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_empresaId_exportadorId_fkey" FOREIGN KEY ("empresaId", "exportadorId") REFERENCES "entidades"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;
