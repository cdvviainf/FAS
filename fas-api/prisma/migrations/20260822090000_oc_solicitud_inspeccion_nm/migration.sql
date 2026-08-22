-- Etapa 2 — OC ↔ Solicitud de Inspección pasa de FK singular a N:M
-- (compras.md §4.2, decisión de negocio 2026-08-22): una OC puede tener
-- varias Solicitudes; cada Solicitud pertenece como máximo a una OC — impuesto
-- por el @@unique(empresaId, solicitudInspeccionId) de abajo.
--
-- Tabla mapeada como "oc_solicitudes_inspeccion" (no
-- "orden_compra_solicitudes_inspeccion") a propósito: con el nombre largo,
-- los nombres de constraint FK/índice superaban los 63 bytes del límite de
-- identificador de Postgres.

-- CreateTable
CREATE TABLE "oc_solicitudes_inspeccion" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "ordenCompraId" INTEGER NOT NULL,
    "solicitudInspeccionId" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,

    CONSTRAINT "oc_solicitudes_inspeccion_pkey" PRIMARY KEY ("id")
);

-- Backfill: cada OC con solicitudInspeccionId no nulo genera exactamente 1
-- fila en la tabla puente. creadoPor toma el creadoPor de la propia OC (no
-- hay otro dato disponible sobre quién hizo el vínculo original).
INSERT INTO "oc_solicitudes_inspeccion" ("empresaId", "ordenCompraId", "solicitudInspeccionId", "creadoEn", "creadoPor")
SELECT "empresaId", "id", "solicitudInspeccionId", "creadoEn", "creadoPor"
FROM "ordenes_compra"
WHERE "solicitudInspeccionId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "ordenes_compra" DROP CONSTRAINT "ordenes_compra_empresaId_solicitudInspeccionId_fkey";

-- AlterTable
ALTER TABLE "ordenes_compra" DROP COLUMN "solicitudInspeccionId";

-- CreateIndex
CREATE UNIQUE INDEX "oc_solicitudes_inspeccion_empresaId_solicitudInspeccionId_key" ON "oc_solicitudes_inspeccion"("empresaId", "solicitudInspeccionId");

-- CreateIndex
CREATE INDEX "oc_solicitudes_inspeccion_empresaId_idx" ON "oc_solicitudes_inspeccion"("empresaId");

-- CreateIndex
CREATE INDEX "oc_solicitudes_inspeccion_ordenCompraId_idx" ON "oc_solicitudes_inspeccion"("ordenCompraId");

-- AddForeignKey
ALTER TABLE "oc_solicitudes_inspeccion" ADD CONSTRAINT "oc_solicitudes_inspeccion_empresaId_ordenCompraId_fkey" FOREIGN KEY ("empresaId", "ordenCompraId") REFERENCES "ordenes_compra"("empresaId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oc_solicitudes_inspeccion" ADD CONSTRAINT "oc_solicitudes_inspeccion_empresaId_solicitudInspeccionId_fkey" FOREIGN KEY ("empresaId", "solicitudInspeccionId") REFERENCES "solicitudes_inspeccion"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
