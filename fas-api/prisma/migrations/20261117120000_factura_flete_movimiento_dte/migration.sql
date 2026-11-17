-- Flete/Seguro de la Factura de Exportación como recargo o descuento global del DTE 110.
CREATE TYPE "TipoMovimientoFleteDte" AS ENUM ('RECARGO', 'DESCUENTO');

ALTER TABLE "facturas_exportacion" ADD COLUMN "fleteMovimientoDte" "TipoMovimientoFleteDte";
