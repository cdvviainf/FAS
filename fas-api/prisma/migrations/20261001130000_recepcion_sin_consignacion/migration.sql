-- Elimina el valor CONSIGNACION del enum OrigenRecepcion (decisión de negocio
-- 2026-10-01: una Recepción es siempre COMPRA —con OC— o PROCESO). Postgres no
-- permite quitar un valor de un enum en sitio, así que se recrea el tipo y se
-- re-apunta cada columna que lo usa (recepciones.origen y pallets.origen).

-- Reclasificación de data histórica: la consignación era "recepción sin OC", que
-- ahora es exactamente PROCESO. La fruta/pallets consignados existentes se
-- re-apuntan a PROCESO (preserva los registros; solo cambia la etiqueta de
-- origen). Se hace ANTES de recrear el enum, mientras el tipo viejo aún admite
-- el valor 'CONSIGNACION'. (Antes esta migración abortaba si encontraba filas
-- CONSIGNACION; el demo sí tenía, por eso falló — ahora se convierten.)
UPDATE "recepciones" SET "origen" = 'PROCESO' WHERE "origen" = 'CONSIGNACION';
UPDATE "pallets" SET "origen" = 'PROCESO' WHERE "origen" = 'CONSIGNACION';

ALTER TYPE "OrigenRecepcion" RENAME TO "OrigenRecepcion_old";
CREATE TYPE "OrigenRecepcion" AS ENUM ('COMPRA', 'PROCESO');
ALTER TABLE "recepciones" ALTER COLUMN "origen" TYPE "OrigenRecepcion" USING ("origen"::text::"OrigenRecepcion");
ALTER TABLE "pallets" ALTER COLUMN "origen" TYPE "OrigenRecepcion" USING ("origen"::text::"OrigenRecepcion");
DROP TYPE "OrigenRecepcion_old";
