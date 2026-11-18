-- Contrato de Productor: la Condición de Pago pasa de la cabecera a cada línea
-- (2026-11-18). Las líneas existentes heredan la condición de su contrato.

ALTER TABLE "productor_contrato_linea" ADD COLUMN IF NOT EXISTS "condicionPagoId" INTEGER;

UPDATE "productor_contrato_linea" l
SET "condicionPagoId" = c."condicionPagoId"
FROM "productor_contratos" c
WHERE l."contratoId" = c."id"
  AND l."condicionPagoId" IS NULL
  AND c."condicionPagoId" IS NOT NULL;

ALTER TABLE "productor_contrato_linea"
  ADD CONSTRAINT "productor_contrato_linea_condicionPagoId_fkey"
  FOREIGN KEY ("condicionPagoId") REFERENCES "condiciones_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "productor_contrato_linea_condicionPagoId_idx" ON "productor_contrato_linea"("condicionPagoId");

-- Cabecera: se elimina la columna (y su FK compuesta).
ALTER TABLE "productor_contratos" DROP CONSTRAINT IF EXISTS "productor_contratos_empresaId_condicionPagoId_fkey";
ALTER TABLE "productor_contratos" DROP CONSTRAINT IF EXISTS "productor_contratos_condicionPagoId_fkey";
ALTER TABLE "productor_contratos" DROP COLUMN IF EXISTS "condicionPagoId";
