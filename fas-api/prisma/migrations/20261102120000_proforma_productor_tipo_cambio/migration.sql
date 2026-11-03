-- Tipo de cambio de la Proforma a Productor: CLP por 1 unidad de la moneda, para
-- convertir la Factura Nacional a CLP cuando la proforma no está en CLP.
ALTER TABLE "proformas_productor" ADD COLUMN "tipoCambio" DECIMAL(14,4);
