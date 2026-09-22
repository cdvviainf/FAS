-- DropIndex
DROP INDEX "embarque_packing_lists_empresaId_embarqueId_key";

-- DropIndex
DROP INDEX "instructivos_hijos_empresaId_embarqueId_plantaId_key";

-- AlterTable
ALTER TABLE "embarque_packing_lists" ADD COLUMN     "eliminadoEn" TIMESTAMP(3),
ADD COLUMN     "eliminadoPor" TEXT;

-- AlterTable
ALTER TABLE "instructivos_hijos" ADD COLUMN     "eliminadoEn" TIMESTAMP(3),
ADD COLUMN     "eliminadoPor" TEXT;

-- CreateIndex
CREATE INDEX "embarque_packing_lists_embarqueId_idx" ON "embarque_packing_lists"("embarqueId");

-- CreateIndex
CREATE INDEX "embarque_packing_lists_eliminadoEn_idx" ON "embarque_packing_lists"("eliminadoEn");

-- CreateIndex
CREATE INDEX "instructivos_hijos_eliminadoEn_idx" ON "instructivos_hijos"("eliminadoEn");

-- Índices únicos parciales (solo filas activas) — Prisma no soporta índices
-- parciales en el DSL, mismo patrón que recepciones_empresa_numero_activo_key
-- (ver 20260809100000_empresa_fase3_compras/migration.sql). Soft delete
-- (2026-09-22, decisión de negocio Christian, "Anular Despacho"): una fila
-- soft-deleted puede repetir (empresaId, embarqueId) / (empresaId,
-- embarqueId, plantaId) sin violar la unicidad de negocio (a lo más una
-- ACTIVA).
CREATE UNIQUE INDEX "embarque_packing_lists_empresa_embarque_activo_key" ON "embarque_packing_lists"("empresaId", "embarqueId") WHERE "eliminadoEn" IS NULL;

CREATE UNIQUE INDEX "instructivos_hijos_empresa_embarque_planta_activo_key" ON "instructivos_hijos"("empresaId", "embarqueId", "plantaId") WHERE "eliminadoEn" IS NULL;
