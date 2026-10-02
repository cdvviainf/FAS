-- Campo de observaciones libres en la Proforma y en la Factura de Exportación.
-- Editable al emitir la Proforma / en BORRADOR la Factura; se muestra en el PDF.
ALTER TABLE "proformas" ADD COLUMN "observaciones" TEXT;
ALTER TABLE "facturas_exportacion" ADD COLUMN "observaciones" TEXT;
