-- DropForeignKey
ALTER TABLE "notas_venta" DROP CONSTRAINT "notas_venta_compradorId_fkey";

-- Comprador pasa de ser una Entidad completa a un Contacto de la Entidad
-- Cliente (decisión de negocio, Christian, 2026-07-30). No hay backfill
-- posible: un id de Entidad no corresponde a ningún id de EntidadContacto,
-- así que los Cierres Comerciales existentes pierden el Comprador asignado
-- y quedan para reasignar manualmente.

-- AlterTable
ALTER TABLE "notas_venta" DROP COLUMN "compradorId";
ALTER TABLE "notas_venta" ADD COLUMN "compradorContactoId" INTEGER;

-- AddForeignKey
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_compradorContactoId_fkey" FOREIGN KEY ("compradorContactoId") REFERENCES "entidad_contactos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
