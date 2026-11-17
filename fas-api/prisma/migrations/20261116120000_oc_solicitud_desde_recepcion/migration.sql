-- La Solicitud de Inspección opcional pasa de la Recepción a la Orden de
-- Compra (2026-11-16). Los vínculos existentes se traspasan a la OC de la
-- Recepción (tabla puente oc_solicitudes_inspeccion) cuando:
--   * la Recepción tiene OC vigente (no eliminada),
--   * la Solicitud es del mismo productor que la OC,
--   * la Solicitud no está vinculada ya a alguna OC (@@unique empresa+solicitud).
-- Si dos Recepciones de OCs distintas apuntan a la misma Solicitud, gana la de
-- menor id de OC. Las de Recepciones de Proceso (sin OC) no tienen OC a la cual
-- moverse y se descartan.
INSERT INTO "oc_solicitudes_inspeccion" ("empresaId", "ordenCompraId", "solicitudInspeccionId", "creadoEn", "creadoPor")
SELECT DISTINCT ON (r."empresaId", r."solicitudInspeccionId")
       r."empresaId", r."ordenCompraId", r."solicitudInspeccionId", now(), 'migracion-20261116'
  FROM "recepciones" r
  JOIN "ordenes_compra" oc
    ON oc."empresaId" = r."empresaId" AND oc.id = r."ordenCompraId" AND oc."eliminadoEn" IS NULL
  JOIN "solicitudes_inspeccion" s
    ON s."empresaId" = r."empresaId" AND s.id = r."solicitudInspeccionId"
   AND s."entidadProductorId" = oc."entidadProductorId"
 WHERE r."solicitudInspeccionId" IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM "oc_solicitudes_inspeccion" x
      WHERE x."empresaId" = r."empresaId" AND x."solicitudInspeccionId" = r."solicitudInspeccionId"
   )
 ORDER BY r."empresaId", r."solicitudInspeccionId", r."ordenCompraId";

ALTER TABLE "recepciones" DROP CONSTRAINT IF EXISTS "recepciones_empresaId_solicitudInspeccionId_fkey";
DROP INDEX IF EXISTS "recepciones_solicitudInspeccionId_idx";
ALTER TABLE "recepciones" DROP COLUMN IF EXISTS "solicitudInspeccionId";
