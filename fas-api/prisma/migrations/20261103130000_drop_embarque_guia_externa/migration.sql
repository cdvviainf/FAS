-- Elimina la Guía de Despacho emitida por un tercero a nivel de Embarque
-- (reemplazada por la guía por-pallet del Packing List). Se dropean el índice
-- único parcial, el índice, la FK y las 3 columnas.
DROP INDEX IF EXISTS "embarques_empresa_guia_externa_emisor_numero_key";
DROP INDEX IF EXISTS "embarques_guiaExternaEmisorId_idx";
ALTER TABLE "embarques" DROP CONSTRAINT IF EXISTS "embarques_empresaId_guiaExternaEmisorId_fkey";
ALTER TABLE "embarques" DROP COLUMN IF EXISTS "guiaExternaNumero";
ALTER TABLE "embarques" DROP COLUMN IF EXISTS "guiaExternaEmisorId";
ALTER TABLE "embarques" DROP COLUMN IF EXISTS "guiaExternaFecha";
