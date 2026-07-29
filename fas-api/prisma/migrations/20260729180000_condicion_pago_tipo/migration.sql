-- CreateEnum
CREATE TYPE "TipoCondicionPago" AS ENUM ('COMPRA', 'VENTA');

-- AlterTable
-- La tabla condiciones_pago está vacía en todos los ambientes (mantenedor
-- nuevo, sin datos productivos aún) — se agrega NOT NULL sin default ni
-- backfill.
ALTER TABLE "condiciones_pago" ADD COLUMN "tipo" "TipoCondicionPago" NOT NULL;
