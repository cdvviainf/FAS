-- Características de calidad/madurez (2026-10-26): mantenedor configurable por
-- especie (Firmeza lb, Brix °Brix…) + captura en el cierre de la Solicitud de
-- Inspección.

CREATE TYPE "TipoDatoMadurez" AS ENUM ('DECIMAL', 'PORCENTAJE', 'ENTERO', 'TEXTO');

-- Mantenedor
CREATE TABLE "caracteristicas_madurez" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "descripcionExtranjera" TEXT,
    "tipoDato" "TipoDatoMadurez" NOT NULL DEFAULT 'DECIMAL',
    "unidadId" INTEGER,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,
    CONSTRAINT "caracteristicas_madurez_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "caracteristicas_madurez_empresaId_id_key" ON "caracteristicas_madurez"("empresaId", "id");
CREATE INDEX "caracteristicas_madurez_empresaId_idx" ON "caracteristicas_madurez"("empresaId");

-- Asociación por especie (N:M)
CREATE TABLE "caracteristicas_madurez_especie" (
    "id" SERIAL NOT NULL,
    "caracteristicaId" INTEGER NOT NULL,
    "especieId" INTEGER NOT NULL,
    CONSTRAINT "caracteristicas_madurez_especie_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cme_caracteristica_especie_key" ON "caracteristicas_madurez_especie"("caracteristicaId", "especieId");
CREATE INDEX "caracteristicas_madurez_especie_caracteristicaId_idx" ON "caracteristicas_madurez_especie"("caracteristicaId");

-- Captura en el cierre de la Solicitud de Inspección
CREATE TABLE "solicitud_inspeccion_madurez" (
    "id" SERIAL NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "caracteristicaId" INTEGER NOT NULL,
    "valorNumerico" DECIMAL(10,2),
    "valorTexto" TEXT,
    CONSTRAINT "solicitud_inspeccion_madurez_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sim_solicitud_caracteristica_key" ON "solicitud_inspeccion_madurez"("solicitudId", "caracteristicaId");
CREATE INDEX "solicitud_inspeccion_madurez_solicitudId_idx" ON "solicitud_inspeccion_madurez"("solicitudId");
CREATE INDEX "solicitud_inspeccion_madurez_caracteristicaId_idx" ON "solicitud_inspeccion_madurez"("caracteristicaId");

-- FKs
ALTER TABLE "caracteristicas_madurez"
  ADD CONSTRAINT "caracteristicas_madurez_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "caracteristicas_madurez"
  ADD CONSTRAINT "caracteristicas_madurez_empresaId_unidadId_fkey" FOREIGN KEY ("empresaId", "unidadId") REFERENCES "unidades_medida"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "caracteristicas_madurez_especie"
  ADD CONSTRAINT "caracteristicas_madurez_especie_caracteristicaId_fkey" FOREIGN KEY ("caracteristicaId") REFERENCES "caracteristicas_madurez"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "caracteristicas_madurez_especie"
  ADD CONSTRAINT "caracteristicas_madurez_especie_especieId_fkey" FOREIGN KEY ("especieId") REFERENCES "especies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "solicitud_inspeccion_madurez"
  ADD CONSTRAINT "solicitud_inspeccion_madurez_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitudes_inspeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "solicitud_inspeccion_madurez"
  ADD CONSTRAINT "solicitud_inspeccion_madurez_caracteristicaId_fkey" FOREIGN KEY ("caracteristicaId") REFERENCES "caracteristicas_madurez"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
