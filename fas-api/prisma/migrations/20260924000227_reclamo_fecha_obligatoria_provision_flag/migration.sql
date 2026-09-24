-- Reclamo.fechaReclamo pasa a obligatoria (feedback 2026-09-23). Backfill
-- defensivo antes del NOT NULL: si algún Reclamo existente quedó sin fecha
-- (posible en producción, no en local — se verificó 0 filas), se usa la
-- fecha de creación como mejor aproximación en vez de fallar la migración.
UPDATE "reclamos" SET "fechaReclamo" = "creadoEn"::date WHERE "fechaReclamo" IS NULL;

ALTER TABLE "reclamos" ALTER COLUMN "fechaReclamo" SET NOT NULL;

-- Distingue la reversa automática de una Provisión al valorizar (R6) de una
-- reversa manual, para que "Anular Valorización" restaure solo las que ella
-- misma reversó.
ALTER TABLE "provisiones" ADD COLUMN "reversadaPorValorizacion" BOOLEAN NOT NULL DEFAULT false;
