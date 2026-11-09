-- Cierre Comercial (2026-11-09): Calidad / Condición "hasta" pasan del
-- encabezado (notas_venta) a cada línea (notas_venta_detalle). Los Cierres
-- existentes copian el valor del encabezado a todas sus líneas.

ALTER TABLE "notas_venta_detalle" ADD COLUMN "notaCalidadHastaId" INTEGER,
ADD COLUMN "notaCondicionHastaId" INTEGER;

UPDATE "notas_venta_detalle" d
SET "notaCalidadHastaId" = nv."notaCalidadHastaId",
    "notaCondicionHastaId" = nv."notaCondicionHastaId"
FROM "notas_venta" nv
WHERE nv.id = d."notaVentaId";

ALTER TABLE "notas_venta_detalle" ADD CONSTRAINT "notas_venta_detalle_notaCalidadHastaId_fkey" FOREIGN KEY ("notaCalidadHastaId") REFERENCES "notas_calidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notas_venta_detalle" ADD CONSTRAINT "notas_venta_detalle_notaCondicionHastaId_fkey" FOREIGN KEY ("notaCondicionHastaId") REFERENCES "notas_condicion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notas_venta" DROP CONSTRAINT "notas_venta_empresaId_notaCalidadHastaId_fkey";
ALTER TABLE "notas_venta" DROP CONSTRAINT "notas_venta_empresaId_notaCondicionHastaId_fkey";
ALTER TABLE "notas_venta" DROP COLUMN "notaCalidadHastaId",
DROP COLUMN "notaCondicionHastaId";
