-- CreateEnum
CREATE TYPE "TipoInspeccion" AS ENUM ('COMPRA', 'PROCESO');

-- AlterTable: agregar nullable primero para no romper filas existentes.
ALTER TABLE "solicitudes_inspeccion" ADD COLUMN "tipoInspeccion" "TipoInspeccion";

-- Backfill: las solicitudes creadas antes de este cambio no tenían tipo fijo
-- (motivo era un catálogo abierto) — quedan como COMPRA por defecto; revisar
-- manualmente si corresponden a Proceso (decisión de negocio, Christian,
-- 2026-07-30 — reemplaza el mantenedor MotivoInspeccion por este enum fijo).
UPDATE "solicitudes_inspeccion" SET "tipoInspeccion" = 'COMPRA' WHERE "tipoInspeccion" IS NULL;

-- Ahora sí, obligatorio
ALTER TABLE "solicitudes_inspeccion" ALTER COLUMN "tipoInspeccion" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "solicitudes_inspeccion" DROP CONSTRAINT "solicitudes_inspeccion_motivoId_fkey";

-- AlterTable
ALTER TABLE "solicitudes_inspeccion" DROP COLUMN "motivoId";

-- DropTable: MotivoInspeccion queda reemplazado por el enum TipoInspeccion.
DROP TABLE "motivos_inspeccion";
