-- Cierre de inspección POR LÍNEA (2026-11-03): veredicto por línea
-- (estadoCierre), defectos y características de madurez pasan a colgar de la línea
-- (solicitudLineaId, nullable para las filas históricas a nivel solicitud), y la
-- cabecera agrega el estado MIXTO (rollup con veredictos distintos).

-- Veredicto por línea.
CREATE TYPE "EstadoLineaInspeccion" AS ENUM ('APROBADA', 'RECHAZADA', 'OBJETADA');

-- Nuevo estado de rollup de la cabecera.
ALTER TYPE "EstadoSolicitudInspeccion" ADD VALUE IF NOT EXISTS 'MIXTO';

-- Veredicto por línea (null = pendiente).
ALTER TABLE "solicitud_inspeccion_lineas" ADD COLUMN "estadoCierre" "EstadoLineaInspeccion";

-- Línea a la que pertenecen defectos / madurez (nullable para histórico).
ALTER TABLE "solicitud_inspeccion_defectos" ADD COLUMN "solicitudLineaId" INTEGER;
ALTER TABLE "solicitud_inspeccion_madurez"  ADD COLUMN "solicitudLineaId" INTEGER;

ALTER TABLE "solicitud_inspeccion_defectos"
  ADD CONSTRAINT "solicitud_inspeccion_defectos_solicitudLineaId_fkey"
  FOREIGN KEY ("solicitudLineaId") REFERENCES "solicitud_inspeccion_lineas"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "solicitud_inspeccion_madurez"
  ADD CONSTRAINT "solicitud_inspeccion_madurez_solicitudLineaId_fkey"
  FOREIGN KEY ("solicitudLineaId") REFERENCES "solicitud_inspeccion_lineas"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "solicitud_inspeccion_defectos_solicitudLineaId_idx" ON "solicitud_inspeccion_defectos"("solicitudLineaId");
CREATE INDEX "solicitud_inspeccion_madurez_solicitudLineaId_idx"  ON "solicitud_inspeccion_madurez"("solicitudLineaId");

-- Unicidad de madurez: pasa de (solicitudId, característica) a (línea, característica).
-- Las filas históricas (línea NULL) quedan sin restringir (nulls distintos en Postgres).
DROP INDEX IF EXISTS "solicitud_inspeccion_madurez_solicitudId_caracteristicaId_key";
CREATE UNIQUE INDEX "solicitud_inspeccion_madurez_solicitudLineaId_caracteristicaId_key"
  ON "solicitud_inspeccion_madurez"("solicitudLineaId", "caracteristicaId");
-- Conserva la unicidad de las filas HISTÓRICAS (cierre a nivel solicitud, línea
-- NULL): una medición por (solicitud, característica) cuando no hay línea.
CREATE UNIQUE INDEX "solicitud_inspeccion_madurez_solicitud_caracteristica_hist_key"
  ON "solicitud_inspeccion_madurez"("solicitudId", "caracteristicaId")
  WHERE "solicitudLineaId" IS NULL;
