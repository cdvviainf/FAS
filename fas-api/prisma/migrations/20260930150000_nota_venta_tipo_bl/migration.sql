-- Tipo de BL en el Cierre Comercial (NotaVenta) — se propone como valor por
-- defecto al generar cada Embarque (Solicitud de Reserva), editable por
-- contenedor (Embarque.tipoBlId, ya existente).

-- AlterTable
ALTER TABLE "notas_venta" ADD COLUMN "tipoBlId" INTEGER;

-- AddForeignKey
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_empresaId_tipoBlId_fkey" FOREIGN KEY ("empresaId", "tipoBlId") REFERENCES "parametros"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
