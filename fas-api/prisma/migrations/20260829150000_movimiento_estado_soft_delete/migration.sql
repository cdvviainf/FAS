-- CreateEnum
CREATE TYPE "EstadoMovimiento" AS ENUM ('BORRADOR', 'CONFIRMADO');

-- AlterTable
-- Backfill: las filas existentes ya tenían su efecto de PMP/saldo aplicado
-- bajo el régimen anterior (todo Movimiento nacía completo) — deben quedar
-- CONFIRMADO, no BORRADOR. El default se agrega primero como CONFIRMADO
-- para que el backfill sea automático, y luego se cambia a BORRADOR para
-- que las filas nuevas nazcan como borrador editable.
ALTER TABLE "movimientos"
  ADD COLUMN "estado" "EstadoMovimiento" NOT NULL DEFAULT 'CONFIRMADO',
  ADD COLUMN "eliminadoEn" TIMESTAMP(3),
  ADD COLUMN "eliminadoPor" TEXT;

ALTER TABLE "movimientos" ALTER COLUMN "estado" SET DEFAULT 'BORRADOR';

-- CreateIndex
CREATE INDEX "movimientos_estado_idx" ON "movimientos"("estado");
