-- AlterTable: agregar como nullable primero, para poder backfillear sin
-- fallar en ambientes que ya tengan filas (FAS-PMQ-R1-001).
ALTER TABLE "entidad_direcciones" ADD COLUMN     "descripcion" TEXT;

-- DataMigration: backfill determinista para filas existentes — usa el
-- código corto ya cargado como descripción provisoria (el usuario puede
-- editarla después).
UPDATE "entidad_direcciones" SET "descripcion" = "codigo" WHERE "descripcion" IS NULL;

-- AlterTable: recién ahora se exige NOT NULL, con todas las filas cubiertas.
ALTER TABLE "entidad_direcciones" ALTER COLUMN "descripcion" SET NOT NULL;
