-- Forma de Pago de Exportación (FmaPagExp) en la Condición de Pago (2026-10-13):
-- código SII de la tabla aduanera; se emite en el bloque Aduana del DTE 110.
ALTER TABLE "condiciones_pago" ADD COLUMN "codigoAduana" TEXT;
