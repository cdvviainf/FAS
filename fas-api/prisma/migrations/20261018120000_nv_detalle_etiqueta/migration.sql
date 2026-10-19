-- Etiqueta (Marca) por línea de Cierre Comercial / Nota de Venta (2026-10-18).
-- Nullable por Cierres históricos; requerida en validación para líneas nuevas
-- (FIJA se autocompleta, DINÁMICA se elige). Mismo patrón que
-- orden_compra_linea.etiquetaId e instructivo_embalaje_detalle.etiquetaId.

ALTER TABLE "notas_venta_detalle" ADD COLUMN "etiquetaId" INTEGER;

CREATE INDEX "notas_venta_detalle_etiquetaId_idx" ON "notas_venta_detalle"("etiquetaId");

ALTER TABLE "notas_venta_detalle"
  ADD CONSTRAINT "notas_venta_detalle_etiquetaId_fkey"
  FOREIGN KEY ("etiquetaId") REFERENCES "etiquetas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
