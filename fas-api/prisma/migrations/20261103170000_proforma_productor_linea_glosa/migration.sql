-- ProformaProductorLinea: el detalle deja de referenciar un Artículo SERVICIO y
-- pasa a texto libre (glosa). La clasificación queda en el Concepto de Cta. Cte.
-- de la cabecera. Se hace backfill de glosa con la descripción del artículo
-- actual antes de soltar la columna, para no perder las proformas existentes.

-- 1) Nueva columna glosa (nullable para el backfill).
ALTER TABLE "proforma_productor_linea" ADD COLUMN "glosa" TEXT;

-- 2) Backfill desde la descripción del artículo referenciado.
UPDATE "proforma_productor_linea" pl
   SET "glosa" = a."descripcion"
  FROM "articulos" a
 WHERE a."id" = pl."articuloId";

-- 3) Red de seguridad por si quedó alguna fila sin artículo.
UPDATE "proforma_productor_linea" SET "glosa" = '' WHERE "glosa" IS NULL;

-- 4) glosa obligatoria.
ALTER TABLE "proforma_productor_linea" ALTER COLUMN "glosa" SET NOT NULL;

-- 5) Soltar índice, FK y columna articuloId.
DROP INDEX IF EXISTS "proforma_productor_linea_articuloId_idx";
ALTER TABLE "proforma_productor_linea" DROP CONSTRAINT IF EXISTS "proforma_productor_linea_articuloId_fkey";
ALTER TABLE "proforma_productor_linea" DROP COLUMN "articuloId";
