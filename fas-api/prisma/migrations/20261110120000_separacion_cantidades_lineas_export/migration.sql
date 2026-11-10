-- "Separar cantidades" en Proforma y Factura de Exportación (2026-11-10).
ALTER TABLE "proforma_lineas"
  ADD COLUMN "separacionDescripcion" TEXT,
  ADD COLUMN "separacionPrecioUnitario" DECIMAL(14,4);

ALTER TABLE "factura_exportacion_lineas"
  ADD COLUMN "separacionDescripcion" TEXT,
  ADD COLUMN "separacionPrecioUnitario" DECIMAL(14,4);

ALTER TABLE "proforma_lineas" ADD CONSTRAINT "proforma_lineas_separacion_chk"
  CHECK (("separacionDescripcion" IS NULL) = ("separacionPrecioUnitario" IS NULL));
ALTER TABLE "factura_exportacion_lineas" ADD CONSTRAINT "factura_exportacion_lineas_separacion_chk"
  CHECK (("separacionDescripcion" IS NULL) = ("separacionPrecioUnitario" IS NULL));
