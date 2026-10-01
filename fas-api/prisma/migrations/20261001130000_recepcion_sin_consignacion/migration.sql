-- Elimina el valor CONSIGNACION del enum OrigenRecepcion (decisión de negocio
-- 2026-10-01: una Recepción es siempre COMPRA —con OC— o PROCESO). No hay data
-- histórica en CONSIGNACION. Postgres no permite quitar un valor de un enum en
-- sitio, así que se recrea el tipo y se re-apunta cada columna que lo usa
-- (recepciones.origen y pallets.origen).

-- Barrera: si quedara alguna fila en CONSIGNACION, abortar en vez de romper el
-- cast (no debería haber ninguna).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "recepciones" WHERE "origen" = 'CONSIGNACION')
     OR EXISTS (SELECT 1 FROM "pallets" WHERE "origen" = 'CONSIGNACION') THEN
    RAISE EXCEPTION 'Existen filas con origen CONSIGNACION; migración abortada';
  END IF;
END $$;

ALTER TYPE "OrigenRecepcion" RENAME TO "OrigenRecepcion_old";
CREATE TYPE "OrigenRecepcion" AS ENUM ('COMPRA', 'PROCESO');
ALTER TABLE "recepciones" ALTER COLUMN "origen" TYPE "OrigenRecepcion" USING ("origen"::text::"OrigenRecepcion");
ALTER TABLE "pallets" ALTER COLUMN "origen" TYPE "OrigenRecepcion" USING ("origen"::text::"OrigenRecepcion");
DROP TYPE "OrigenRecepcion_old";
