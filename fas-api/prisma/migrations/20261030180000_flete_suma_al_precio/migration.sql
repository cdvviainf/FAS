-- Flag "el flete se suma al precio de venta" (en vez de restar) en Proforma y
-- Factura de Exportación. Default false = comportamiento histórico (resta).
ALTER TABLE "proformas" ADD COLUMN "fleteSumaAlPrecio" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "facturas_exportacion" ADD COLUMN "fleteSumaAlPrecio" BOOLEAN NOT NULL DEFAULT false;
