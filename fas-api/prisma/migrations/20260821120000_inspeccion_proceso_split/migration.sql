-- Etapa 1A — Split de inspecciones (2026-08-21).
--
-- La Solicitud de Inspección pasa a ser SOLO de compra: se elimina
-- `tipoInspeccion` y el enum `TipoInspeccion`. El Instructivo de Embalaje se
-- convierte en la Inspección de Proceso: gana ciclo de vida (estadoInspeccion
-- PENDIENTE→NOTIFICADA→APROBADA→CERRADA, RECHAZADA terminal) y una tabla hija
-- de folios (números de pallet) aprobados, únicos por empresa.
--
-- NOTA (deuda pre-existente, fuera de alcance): `prisma migrate diff` contra el
-- historial también reporta drift no relacionado con este cambio — FKs que se
-- recrean idénticas por reordenamiento de campos, una FK faltante en
-- "mercados", el índice único "instructivos_embalaje_empresaId_numero_key" y el
-- índice "ordenes_compra_incotermId_idx" que están en la BD pero no en
-- schema.prisma. Se excluyó deliberadamente para no tocar nada fuera del
-- alcance de esta migración. Queda como deuda a revisar aparte.

-- CreateEnum
CREATE TYPE "InspeccionProcesoEstado" AS ENUM ('PENDIENTE', 'NOTIFICADA', 'APROBADA', 'RECHAZADA', 'CERRADA');

-- CreateEnum
CREATE TYPE "EstadoFolioInspeccion" AS ENUM ('APROBADO', 'RECEPCIONADO');

-- AlterTable
ALTER TABLE "instructivos_embalaje" ADD COLUMN     "comentarioInspeccion" TEXT,
ADD COLUMN     "estadoInspeccion" "InspeccionProcesoEstado" NOT NULL DEFAULT 'PENDIENTE',
ADD COLUMN     "inspeccionadoEn" TIMESTAMP(3),
ADD COLUMN     "inspeccionadoPor" TEXT,
ADD COLUMN     "notificadaEn" TIMESTAMP(3);

-- Guarda de integridad (FAS-INSP-1A-001, QA ronda 1): la Solicitud de
-- Inspección pasa a ser exclusivamente de compra. Si quedara alguna solicitud
-- histórica activa con tipoInspeccion = 'PROCESO' sin resolver, se aborta la
-- migración en vez de perder el discriminador en silencio (quedaría expuesta
-- como si fuera de compra, incluso elegible para habilitar una OC) — exige
-- resolverla explícitamente (soft delete o revisión caso a caso) y reintentar.
DO $$
DECLARE
  procesos_pendientes INTEGER;
BEGIN
  SELECT COUNT(*) INTO procesos_pendientes
  FROM "solicitudes_inspeccion"
  WHERE "tipoInspeccion" = 'PROCESO' AND "eliminadoEn" IS NULL;

  IF procesos_pendientes > 0 THEN
    RAISE EXCEPTION 'Existen % solicitud(es) de inspección tipo PROCESO activas sin resolver. Resuélvalas (soft delete o revisión manual) antes de aplicar esta migración.', procesos_pendientes;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "solicitudes_inspeccion" DROP COLUMN "tipoInspeccion";

-- DropEnum
DROP TYPE "TipoInspeccion";

-- CreateTable
CREATE TABLE "instructivo_embalaje_folios" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "instructivoId" INTEGER NOT NULL,
    "folio" TEXT NOT NULL,
    "estado" "EstadoFolioInspeccion" NOT NULL DEFAULT 'APROBADO',
    "palletId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,

    CONSTRAINT "instructivo_embalaje_folios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "instructivo_embalaje_folios_empresaId_idx" ON "instructivo_embalaje_folios"("empresaId");

-- CreateIndex
CREATE INDEX "instructivo_embalaje_folios_instructivoId_idx" ON "instructivo_embalaje_folios"("instructivoId");

-- CreateIndex
CREATE UNIQUE INDEX "instructivo_embalaje_folios_empresaId_folio_key" ON "instructivo_embalaje_folios"("empresaId", "folio");

-- CreateIndex
CREATE UNIQUE INDEX "instructivo_embalaje_folios_empresaId_id_key" ON "instructivo_embalaje_folios"("empresaId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "instructivos_embalaje_empresaId_id_key" ON "instructivos_embalaje"("empresaId", "id");

-- AddForeignKey
ALTER TABLE "instructivo_embalaje_folios" ADD CONSTRAINT "instructivo_embalaje_folios_empresaId_instructivoId_fkey" FOREIGN KEY ("empresaId", "instructivoId") REFERENCES "instructivos_embalaje"("empresaId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
