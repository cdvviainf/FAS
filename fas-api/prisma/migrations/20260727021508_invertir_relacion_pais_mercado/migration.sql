/*
  Warnings:

  - You are about to drop the column `paisId` on the `mercados` table.
  - Antes de eliminarla, se traslada el dato a `paises.mercadoId` (ver
    QAS-MG-MP-001): por cada Mercado existente con `paisId`, el País
    correspondiente hereda `mercadoId = mercado.id`. Si un País estaba
    apuntado por más de un Mercado (posible bajo el modelo anterior, donde
    un País podía tener varios Mercados), solo se conserva una asociación —
    inevitable porque el modelo nuevo exige un único Mercado por País — y
    debe revisarse manualmente en ambientes con datos reales tras aplicar
    esta migración.

*/
-- AlterTable: agrega la columna nueva ANTES de tocar la vieja, para poder
-- usar "mercados"."paisId" como fuente del backfill.
ALTER TABLE "paises" ADD COLUMN     "mercadoId" INTEGER;

-- AddForeignKey
ALTER TABLE "paises" ADD CONSTRAINT "paises_mercadoId_fkey" FOREIGN KEY ("mercadoId") REFERENCES "mercados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DataMigration: backfill paises.mercadoId desde mercados.paisId (QAS-MG-MP-001)
UPDATE "paises" p
SET "mercadoId" = m.id
FROM "mercados" m
WHERE m."paisId" = p.id
  AND p."mercadoId" IS NULL;

-- AlterTable: la regla de negocio exige exactamente un Mercado por País
-- (QAS-MG-MP-002). Si queda algún País sin Mercado tras el backfill (porque
-- nunca estuvo asociado a uno, o porque no existía ningún Mercado en este
-- ambiente), este paso falla intencionalmente: hay que asignarle un Mercado
-- manualmente antes de reintentar el deploy.
ALTER TABLE "paises" ALTER COLUMN "mercadoId" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "mercados" DROP CONSTRAINT "mercados_paisId_fkey";

-- AlterTable
ALTER TABLE "mercados" DROP COLUMN "paisId";
