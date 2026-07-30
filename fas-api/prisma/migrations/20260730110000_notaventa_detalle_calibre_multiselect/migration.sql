-- CreateTable
CREATE TABLE "notas_venta_detalle_calibre" (
    "id" SERIAL NOT NULL,
    "notaVentaDetalleId" INTEGER NOT NULL,
    "calibreId" INTEGER NOT NULL,

    CONSTRAINT "notas_venta_detalle_calibre_pkey" PRIMARY KEY ("id")
);

-- Backfill: expandir el rango calibreInicioId..calibreFinId (por "orden",
-- dentro de la misma especie) a filas individuales del nuevo multiselect,
-- para las líneas de detalle creadas antes de este cambio (decisión de
-- negocio, Christian, 2026-07-30 — reemplaza el rango por multiselect).
INSERT INTO "notas_venta_detalle_calibre" ("notaVentaDetalleId", "calibreId")
SELECT d.id, c.id
FROM "notas_venta_detalle" d
JOIN "calibres" ci ON ci.id = d."calibreInicioId"
JOIN "calibres" cf ON cf.id = d."calibreFinId"
JOIN "calibres" c ON c."especieId" = d."especieId" AND c."orden" BETWEEN ci."orden" AND cf."orden";

-- DropForeignKey
ALTER TABLE "notas_venta_detalle" DROP CONSTRAINT "notas_venta_detalle_calibreFinId_fkey";
ALTER TABLE "notas_venta_detalle" DROP CONSTRAINT "notas_venta_detalle_calibreInicioId_fkey";

-- AlterTable
ALTER TABLE "notas_venta_detalle" DROP COLUMN "calibreFinId";
ALTER TABLE "notas_venta_detalle" DROP COLUMN "calibreInicioId";

-- CreateIndex
CREATE UNIQUE INDEX "notas_venta_detalle_calibre_notaVentaDetalleId_calibreId_key" ON "notas_venta_detalle_calibre"("notaVentaDetalleId", "calibreId");

-- AddForeignKey
ALTER TABLE "notas_venta_detalle_calibre" ADD CONSTRAINT "notas_venta_detalle_calibre_notaVentaDetalleId_fkey" FOREIGN KEY ("notaVentaDetalleId") REFERENCES "notas_venta_detalle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notas_venta_detalle_calibre" ADD CONSTRAINT "notas_venta_detalle_calibre_calibreId_fkey" FOREIGN KEY ("calibreId") REFERENCES "calibres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
