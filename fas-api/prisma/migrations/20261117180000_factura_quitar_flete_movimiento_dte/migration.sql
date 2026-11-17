-- El recargo/descuento del Flete/Seguro en el DTE 110 se reemplaza por el on/off
-- fleteSumaAlPrecio (2026-11-17): se elimina la columna y su enum.
ALTER TABLE "facturas_exportacion" DROP COLUMN IF EXISTS "fleteMovimientoDte";
DROP TYPE IF EXISTS "TipoMovimientoFleteDte";
