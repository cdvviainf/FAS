-- Generador DTE (2026-11-06): la condición afecto/exento pasa de la línea al tipo
-- de documento. Nueva clase FACTURA_NACIONAL_EXENTA (DTE 34).
-- Va sola en su migración: Postgres no permite usar un valor de enum recién
-- agregado dentro de la misma transacción (el backfill va en la siguiente).
ALTER TYPE "ClaseDocumentoManual" ADD VALUE IF NOT EXISTS 'FACTURA_NACIONAL_EXENTA';
