-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-10-05 · Batch Solicitud / MercadoPais / Instructivo de Embalaje
--
-- 1) Solicitud de Inspección: Nota de Calidad / Condición pasan de un valor
--    único (notaCalidadId / notaCondicionId) a multiselección (tablas puente).
-- 2) MercadoPais: pasa a N:M real por empresa (un país puede estar en varios
--    mercados) — se relaja @@unique([empresaId, paisId]).
-- 3) Instructivo de Embalaje: el Grupo de Mercado pasa de cabecera a línea;
--    se agrega Exportador (cabecera) y Marca (Etiqueta) + observaciones (línea).
--
-- Orden deliberado: crear estructuras y copiar datos ANTES de dropear columnas,
-- y backfillear grupoMercadoId del detalle (desde el padre) ANTES de SET NOT NULL.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1) Solicitud: notas de calidad/condición → multiselección ────────────────

CREATE TABLE "solicitud_inspeccion_notas_calidad" (
    "id" SERIAL NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "notaCalidadId" INTEGER NOT NULL,

    CONSTRAINT "solicitud_inspeccion_notas_calidad_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "solicitud_inspeccion_notas_condicion" (
    "id" SERIAL NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "notaCondicionId" INTEGER NOT NULL,

    CONSTRAINT "solicitud_inspeccion_notas_condicion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "solicitud_inspeccion_notas_calidad_solicitudId_notaCalidadI_key" ON "solicitud_inspeccion_notas_calidad"("solicitudId", "notaCalidadId");
CREATE UNIQUE INDEX "solicitud_inspeccion_notas_condicion_solicitudId_notaCondic_key" ON "solicitud_inspeccion_notas_condicion"("solicitudId", "notaCondicionId");

ALTER TABLE "solicitud_inspeccion_notas_calidad" ADD CONSTRAINT "solicitud_inspeccion_notas_calidad_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitudes_inspeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "solicitud_inspeccion_notas_calidad" ADD CONSTRAINT "solicitud_inspeccion_notas_calidad_notaCalidadId_fkey" FOREIGN KEY ("notaCalidadId") REFERENCES "notas_calidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitud_inspeccion_notas_condicion" ADD CONSTRAINT "solicitud_inspeccion_notas_condicion_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitudes_inspeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "solicitud_inspeccion_notas_condicion" ADD CONSTRAINT "solicitud_inspeccion_notas_condicion_notaCondicionId_fkey" FOREIGN KEY ("notaCondicionId") REFERENCES "notas_condicion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migrar datos existentes (valor único -> una fila en la tabla puente).
INSERT INTO "solicitud_inspeccion_notas_calidad" ("solicitudId", "notaCalidadId")
SELECT "id", "notaCalidadId" FROM "solicitudes_inspeccion" WHERE "notaCalidadId" IS NOT NULL;

INSERT INTO "solicitud_inspeccion_notas_condicion" ("solicitudId", "notaCondicionId")
SELECT "id", "notaCondicionId" FROM "solicitudes_inspeccion" WHERE "notaCondicionId" IS NOT NULL;

-- Recién ahora dropear las columnas singulares (DROP COLUMN elimina sus FKs).
ALTER TABLE "solicitudes_inspeccion" DROP COLUMN "notaCalidadId",
DROP COLUMN "notaCondicionId";

-- ── 2) MercadoPais → N:M real por empresa ────────────────────────────────────

DROP INDEX "mercado_paises_empresaId_paisId_key";
CREATE INDEX "mercado_paises_empresaId_paisId_idx" ON "mercado_paises"("empresaId", "paisId");
CREATE UNIQUE INDEX "mercado_paises_empresaId_mercadoId_paisId_key" ON "mercado_paises"("empresaId", "mercadoId", "paisId");

-- ── 3) Instructivo de Embalaje ───────────────────────────────────────────────

-- Cabecera: agregar Exportador (nullable).
ALTER TABLE "instructivos_embalaje" ADD COLUMN "exportadorId" INTEGER;
CREATE INDEX "instructivos_embalaje_exportadorId_idx" ON "instructivos_embalaje"("exportadorId");
ALTER TABLE "instructivos_embalaje" ADD CONSTRAINT "instructivos_embalaje_empresaId_exportadorId_fkey" FOREIGN KEY ("empresaId", "exportadorId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Detalle: agregar columnas nuevas (grupoMercadoId temporalmente NULLABLE para backfill).
ALTER TABLE "instructivo_embalaje_detalle" ADD COLUMN "grupoMercadoId" INTEGER,
ADD COLUMN "etiquetaId" INTEGER,
ADD COLUMN "observaciones" TEXT;

-- Backfill: cada línea hereda el grupo de mercado que tenía la cabecera.
UPDATE "instructivo_embalaje_detalle" d
SET "grupoMercadoId" = i."grupoMercadoId"
FROM "instructivos_embalaje" i
WHERE d."instructivoId" = i."id";

-- Ya backfilleado: hacerlo obligatorio.
ALTER TABLE "instructivo_embalaje_detalle" ALTER COLUMN "grupoMercadoId" SET NOT NULL;

CREATE INDEX "instructivo_embalaje_detalle_grupoMercadoId_idx" ON "instructivo_embalaje_detalle"("grupoMercadoId");
CREATE INDEX "instructivo_embalaje_detalle_etiquetaId_idx" ON "instructivo_embalaje_detalle"("etiquetaId");
ALTER TABLE "instructivo_embalaje_detalle" ADD CONSTRAINT "instructivo_embalaje_detalle_grupoMercadoId_fkey" FOREIGN KEY ("grupoMercadoId") REFERENCES "grupos_mercado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "instructivo_embalaje_detalle" ADD CONSTRAINT "instructivo_embalaje_detalle_etiquetaId_fkey" FOREIGN KEY ("etiquetaId") REFERENCES "etiquetas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Cabecera: recién ahora soltar el grupo de mercado (ya migrado al detalle).
DROP INDEX "instructivos_embalaje_grupoMercadoId_idx";
ALTER TABLE "instructivos_embalaje" DROP COLUMN "grupoMercadoId";
