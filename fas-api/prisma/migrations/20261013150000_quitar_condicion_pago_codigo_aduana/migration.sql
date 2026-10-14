-- Revierte CondicionPago.codigoAduana (2026-10-13): el "FmaPagExp" no es una
-- propiedad del plazo/condición de pago. Según el SII (Formato DTE v2.5), la
-- Forma de Pago de Exportación es la forma de pago del importador según el DUS
-- (acreditivo/cobranza/anticipo/contado, Tabla de Formas de Pago de Aduanas),
-- un eje distinto de las cuotas del cliente (que ahora se emiten en IdDoc.MntPagos).
-- Se elimina el binding erróneo; FmaPagExp se modelará aparte si se requiere.
ALTER TABLE "condiciones_pago" DROP COLUMN IF EXISTS "codigoAduana";
