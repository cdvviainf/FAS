/*
  Warnings:

  - `calibreMinId`/`calibreMaxId` (rango único) en `orden_compra_linea` e
    `instructivo_embalaje_detalle` se reemplazan por un multiselect de
    calibres individuales (mismo patrón que `notas_venta_detalle_calibre`).
  - Antes de eliminar las columnas de rango, se hace backfill explotando cada
    rango existente en filas individuales (un registro por cada calibre del
    maestro, de la misma especie, cuyo `orden` cae dentro de
    [calibreMin.orden, calibreMax.orden]) — no se pierde información de
    líneas ya creadas.

*/

-- CreateTable
CREATE TABLE "orden_compra_linea_calibre" (
    "id" SERIAL NOT NULL,
    "ordenCompraLineaId" INTEGER NOT NULL,
    "calibreId" INTEGER NOT NULL,

    CONSTRAINT "orden_compra_linea_calibre_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orden_compra_linea_calibre_ordenCompraLineaId_calibreId_key" ON "orden_compra_linea_calibre"("ordenCompraLineaId", "calibreId");

-- AddForeignKey
ALTER TABLE "orden_compra_linea_calibre" ADD CONSTRAINT "orden_compra_linea_calibre_ordenCompraLineaId_fkey" FOREIGN KEY ("ordenCompraLineaId") REFERENCES "orden_compra_linea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra_linea_calibre" ADD CONSTRAINT "orden_compra_linea_calibre_calibreId_fkey" FOREIGN KEY ("calibreId") REFERENCES "calibres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: explota el rango [calibreMin.orden, calibreMax.orden] de cada
-- línea existente en calibres individuales.
INSERT INTO "orden_compra_linea_calibre" ("ordenCompraLineaId", "calibreId")
SELECT ocl."id", c."id"
FROM "orden_compra_linea" ocl
JOIN "calibres" cmin ON cmin."id" = ocl."calibreMinId"
JOIN "calibres" cmax ON cmax."id" = ocl."calibreMaxId"
JOIN "calibres" c ON c."especieId" = ocl."especieId"
  AND c."orden" BETWEEN cmin."orden" AND cmax."orden"
  AND c."eliminadoEn" IS NULL;

-- DropForeignKey
ALTER TABLE "orden_compra_linea" DROP CONSTRAINT "orden_compra_linea_calibreMinId_fkey";
ALTER TABLE "orden_compra_linea" DROP CONSTRAINT "orden_compra_linea_calibreMaxId_fkey";

-- AlterTable
ALTER TABLE "orden_compra_linea" DROP COLUMN "calibreMinId",
DROP COLUMN "calibreMaxId";

-- CreateTable
CREATE TABLE "instructivo_embalaje_detalle_calibre" (
    "id" SERIAL NOT NULL,
    "detalleId" INTEGER NOT NULL,
    "calibreId" INTEGER NOT NULL,

    CONSTRAINT "instructivo_embalaje_detalle_calibre_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instructivo_embalaje_detalle_calibre_detalleId_calibreId_key" ON "instructivo_embalaje_detalle_calibre"("detalleId", "calibreId");

-- AddForeignKey
ALTER TABLE "instructivo_embalaje_detalle_calibre" ADD CONSTRAINT "instructivo_embalaje_detalle_calibre_detalleId_fkey" FOREIGN KEY ("detalleId") REFERENCES "instructivo_embalaje_detalle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructivo_embalaje_detalle_calibre" ADD CONSTRAINT "instructivo_embalaje_detalle_calibre_calibreId_fkey" FOREIGN KEY ("calibreId") REFERENCES "calibres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: mismo criterio que orden_compra_linea arriba.
INSERT INTO "instructivo_embalaje_detalle_calibre" ("detalleId", "calibreId")
SELECT ied."id", c."id"
FROM "instructivo_embalaje_detalle" ied
JOIN "calibres" cmin ON cmin."id" = ied."calibreMinId"
JOIN "calibres" cmax ON cmax."id" = ied."calibreMaxId"
JOIN "calibres" c ON c."especieId" = ied."especieId"
  AND c."orden" BETWEEN cmin."orden" AND cmax."orden"
  AND c."eliminadoEn" IS NULL;

-- DropForeignKey
ALTER TABLE "instructivo_embalaje_detalle" DROP CONSTRAINT "instructivo_embalaje_detalle_calibreMinId_fkey";
ALTER TABLE "instructivo_embalaje_detalle" DROP CONSTRAINT "instructivo_embalaje_detalle_calibreMaxId_fkey";

-- AlterTable
ALTER TABLE "instructivo_embalaje_detalle" DROP COLUMN "calibreMinId",
DROP COLUMN "calibreMaxId";
