-- Vínculo OrdenCompraLinea → NotaVentaDetalle (2026-08-23): permite tomar
-- una línea del Cierre Comercial (completa o parcial, en cajas) directamente
-- al armar una OC, en vez de recapturar especie/variedad/categoría/artículo
-- a mano. Nullable — sigue existiendo la línea 100% manual. Sin unicidad:
-- una línea del Cierre puede repartirse entre varias OrdenCompraLinea.
-- onDelete RESTRICT: eliminar la línea del Cierre con cajas ya comprometidas
-- se bloquea a nivel de aplicación (notas-venta.service.ts); esta FK es la
-- defensa de última instancia si algo se salta esa validación.

-- AlterTable
ALTER TABLE "orden_compra_linea" ADD COLUMN "notaVentaDetalleId" INTEGER;

-- CreateIndex
CREATE INDEX "orden_compra_linea_notaVentaDetalleId_idx" ON "orden_compra_linea"("notaVentaDetalleId");

-- AddForeignKey
ALTER TABLE "orden_compra_linea" ADD CONSTRAINT "orden_compra_linea_notaVentaDetalleId_fkey" FOREIGN KEY ("notaVentaDetalleId") REFERENCES "notas_venta_detalle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
