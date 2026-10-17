-- Etiqueta por línea de Orden de Compra (2026-10-15). Nullable por OCs
-- históricas; requerida en validación para líneas nuevas. La carga de stock
-- (modo COMPRA) valida la etiqueta del pallet contra esta.

ALTER TABLE "orden_compra_linea" ADD COLUMN "etiquetaId" INTEGER;

CREATE INDEX "orden_compra_linea_etiquetaId_idx" ON "orden_compra_linea"("etiquetaId");

ALTER TABLE "orden_compra_linea"
  ADD CONSTRAINT "orden_compra_linea_etiquetaId_fkey"
  FOREIGN KEY ("etiquetaId") REFERENCES "etiquetas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
