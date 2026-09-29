-- Cláusula de venta: flags de Flete/Seguro en Parametro (Incoterm) y montos de
-- Flete/Seguro en Proforma y Factura de Exportación.

-- Parametro: flags (aplican solo a cláusulas de venta; default false)
ALTER TABLE "parametros"
  ADD COLUMN "requiereFlete" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requiereSeguro" BOOLEAN NOT NULL DEFAULT false;

-- Proforma: montos de flete/seguro (nullable; monto cerrado dentro del total)
ALTER TABLE "proformas"
  ADD COLUMN "montoFlete" DECIMAL(14,2),
  ADD COLUMN "montoSeguro" DECIMAL(14,2);

-- Factura de Exportación: montos de flete/seguro (nullable)
ALTER TABLE "facturas_exportacion"
  ADD COLUMN "montoFlete" DECIMAL(14,2),
  ADD COLUMN "montoSeguro" DECIMAL(14,2);
