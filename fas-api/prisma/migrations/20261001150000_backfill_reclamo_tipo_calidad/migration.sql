-- Backfill (BRT-R1-002): la migración 20261001140000 agregó
-- reclamos.tipoReclamoId nullable sin backfill. Como la pantalla de Calidad
-- ahora lista solo reclamos cuyo tipo genera análisis (y el endpoint de análisis
-- rechaza los que no tienen tipo), los reclamos históricos (tipo NULL) quedarían
-- invisibles e inanalizables. Se los re-apunta a un TipoReclamo 'CALIDAD'
-- (generaAnalisisCalidad = true) por empresa, garantizando que ese tipo exista.
--
-- Decisión de negocio 2026-10-01: los reclamos previos a la clasificación son
-- de Calidad (siguen analizables). El seed crea COMERCIAL/CALIDAD; este backfill
-- NO duplica porque el seed hace findFirst por (empresa, código) antes de crear.

-- 1. Garantizar el tipo 'CALIDAD' en cada empresa que tenga reclamos sin tipo.
INSERT INTO "tipos_reclamo" ("empresaId", "codigo", "descripcion", "generaAnalisisCalidad", "creadoPor", "creadoEn")
SELECT DISTINCT r."empresaId", 'CALIDAD', 'Calidad', true, 'system', CURRENT_TIMESTAMP
FROM "reclamos" r
WHERE r."tipoReclamoId" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "tipos_reclamo" t
    WHERE t."empresaId" = r."empresaId"
      AND t."codigo" = 'CALIDAD'
      AND t."eliminadoEn" IS NULL
  );

-- 2. Re-apuntar los reclamos sin tipo al 'CALIDAD' de su propia empresa.
UPDATE "reclamos" r
SET "tipoReclamoId" = t."id"
FROM "tipos_reclamo" t
WHERE r."tipoReclamoId" IS NULL
  AND t."empresaId" = r."empresaId"
  AND t."codigo" = 'CALIDAD'
  AND t."eliminadoEn" IS NULL;
