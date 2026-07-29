-- Guard explícito: esta migración solo es segura si no hay variedades sin
-- grupo asignado (no hacemos backfill automático — asignar un grupo de
-- variedad es una decisión de negocio). Si existen filas con
-- grupoVariedadId NULL, aborta con un diagnóstico claro en vez de fallar
-- silenciosamente en el ALTER COLUMN.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "variedades" WHERE "grupoVariedadId" IS NULL) THEN
    RAISE EXCEPTION 'Migración abortada: existen variedades sin grupoVariedadId. Asigna un Grupo de Variedad a cada una (backfill manual) antes de aplicar esta migración.';
  END IF;
END $$;

-- DropForeignKey
ALTER TABLE "variedades" DROP CONSTRAINT "variedades_grupoVariedadId_fkey";

-- AlterTable
ALTER TABLE "variedades" ALTER COLUMN "grupoVariedadId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "variedades" ADD CONSTRAINT "variedades_grupoVariedadId_fkey" FOREIGN KEY ("grupoVariedadId") REFERENCES "grupos_variedad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
