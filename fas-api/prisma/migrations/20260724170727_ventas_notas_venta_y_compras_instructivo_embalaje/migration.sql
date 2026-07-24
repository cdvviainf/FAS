/*
  Warnings:

  - You are about to drop the `Cobranza` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DocumentoDTE` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NotaVenta` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NotaVentaItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Cobranza" DROP CONSTRAINT "Cobranza_notaVentaId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentoDTE" DROP CONSTRAINT "DocumentoDTE_notaVentaId_fkey";

-- DropForeignKey
ALTER TABLE "NotaVenta" DROP CONSTRAINT "NotaVenta_clienteId_fkey";

-- DropForeignKey
ALTER TABLE "NotaVentaItem" DROP CONSTRAINT "NotaVentaItem_loteId_fkey";

-- DropForeignKey
ALTER TABLE "NotaVentaItem" DROP CONSTRAINT "NotaVentaItem_notaVentaId_fkey";

-- DropTable
DROP TABLE "Cobranza";

-- DropTable
DROP TABLE "DocumentoDTE";

-- DropTable
DROP TABLE "NotaVenta";

-- DropTable
DROP TABLE "NotaVentaItem";

-- DropEnum
DROP TYPE "CobranzaEstado";

-- DropEnum
DROP TYPE "DteEstado";

-- DropEnum
DROP TYPE "NvEstado";

-- CreateTable
CREATE TABLE "notas_venta" (
    "id" SERIAL NOT NULL,
    "folio" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "compradorId" INTEGER,
    "notifyId" INTEGER,
    "clienteFinalId" INTEGER,
    "tipoEmbarqueId" INTEGER NOT NULL,
    "mercadoId" INTEGER NOT NULL,
    "paisDestinoId" INTEGER NOT NULL,
    "puertoDestinoId" INTEGER,
    "direccionId" INTEGER,
    "direccionDetalle" TEXT,
    "modalidadVentaId" INTEGER,
    "clausulaVentaId" INTEGER,
    "tipoFleteId" INTEGER,
    "formaPagoId" INTEGER,
    "saldoPagoId" INTEGER,
    "monedaId" INTEGER NOT NULL,
    "observaciones" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "notas_venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_venta_detalle" (
    "id" SERIAL NOT NULL,
    "notaVentaId" INTEGER NOT NULL,
    "fechaCompromiso" TIMESTAMP(3) NOT NULL,
    "especieId" INTEGER NOT NULL,
    "variedadId" INTEGER NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "categoriaId" INTEGER,
    "tipoPalletId" INTEGER,
    "cantidadPallets" INTEGER NOT NULL,
    "cajasPorPallet" INTEGER NOT NULL,
    "cajas" INTEGER NOT NULL,
    "precio" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "notas_venta_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_venta_detalle_calibre" (
    "id" SERIAL NOT NULL,
    "detalleId" INTEGER NOT NULL,
    "calibreId" INTEGER NOT NULL,

    CONSTRAINT "notas_venta_detalle_calibre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructivos_embalaje" (
    "id" SERIAL NOT NULL,
    "numero" INTEGER NOT NULL,
    "notaVentaId" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,

    CONSTRAINT "instructivos_embalaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructivo_embalaje_detalle" (
    "id" SERIAL NOT NULL,
    "instructivoId" INTEGER NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "especieId" INTEGER NOT NULL,
    "variedadId" INTEGER NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    "calibreMinId" INTEGER NOT NULL,
    "calibreMaxId" INTEGER NOT NULL,
    "cantidadPallets" INTEGER NOT NULL,
    "cajasPorPallet" INTEGER NOT NULL,

    CONSTRAINT "instructivo_embalaje_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notas_venta_folio_key" ON "notas_venta"("folio");

-- CreateIndex
CREATE INDEX "notas_venta_clienteId_idx" ON "notas_venta"("clienteId");

-- CreateIndex
CREATE INDEX "notas_venta_fecha_idx" ON "notas_venta"("fecha");

-- CreateIndex
CREATE INDEX "notas_venta_detalle_notaVentaId_idx" ON "notas_venta_detalle"("notaVentaId");

-- CreateIndex
CREATE UNIQUE INDEX "notas_venta_detalle_calibre_detalleId_calibreId_key" ON "notas_venta_detalle_calibre"("detalleId", "calibreId");

-- CreateIndex
CREATE UNIQUE INDEX "instructivos_embalaje_numero_key" ON "instructivos_embalaje"("numero");

-- CreateIndex
CREATE INDEX "instructivos_embalaje_notaVentaId_idx" ON "instructivos_embalaje"("notaVentaId");

-- CreateIndex
CREATE INDEX "instructivo_embalaje_detalle_instructivoId_idx" ON "instructivo_embalaje_detalle"("instructivoId");

-- AddForeignKey
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_compradorId_fkey" FOREIGN KEY ("compradorId") REFERENCES "entidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_notifyId_fkey" FOREIGN KEY ("notifyId") REFERENCES "entidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_clienteFinalId_fkey" FOREIGN KEY ("clienteFinalId") REFERENCES "entidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_tipoEmbarqueId_fkey" FOREIGN KEY ("tipoEmbarqueId") REFERENCES "tipos_embarque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_mercadoId_fkey" FOREIGN KEY ("mercadoId") REFERENCES "mercados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_paisDestinoId_fkey" FOREIGN KEY ("paisDestinoId") REFERENCES "paises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_puertoDestinoId_fkey" FOREIGN KEY ("puertoDestinoId") REFERENCES "puertos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_direccionId_fkey" FOREIGN KEY ("direccionId") REFERENCES "entidad_direcciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta" ADD CONSTRAINT "notas_venta_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "monedas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta_detalle" ADD CONSTRAINT "notas_venta_detalle_notaVentaId_fkey" FOREIGN KEY ("notaVentaId") REFERENCES "notas_venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta_detalle" ADD CONSTRAINT "notas_venta_detalle_especieId_fkey" FOREIGN KEY ("especieId") REFERENCES "especies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta_detalle" ADD CONSTRAINT "notas_venta_detalle_variedadId_fkey" FOREIGN KEY ("variedadId") REFERENCES "variedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta_detalle" ADD CONSTRAINT "notas_venta_detalle_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta_detalle" ADD CONSTRAINT "notas_venta_detalle_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta_detalle" ADD CONSTRAINT "notas_venta_detalle_tipoPalletId_fkey" FOREIGN KEY ("tipoPalletId") REFERENCES "tipos_pallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta_detalle_calibre" ADD CONSTRAINT "notas_venta_detalle_calibre_detalleId_fkey" FOREIGN KEY ("detalleId") REFERENCES "notas_venta_detalle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_venta_detalle_calibre" ADD CONSTRAINT "notas_venta_detalle_calibre_calibreId_fkey" FOREIGN KEY ("calibreId") REFERENCES "calibres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructivos_embalaje" ADD CONSTRAINT "instructivos_embalaje_notaVentaId_fkey" FOREIGN KEY ("notaVentaId") REFERENCES "notas_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructivo_embalaje_detalle" ADD CONSTRAINT "instructivo_embalaje_detalle_instructivoId_fkey" FOREIGN KEY ("instructivoId") REFERENCES "instructivos_embalaje"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructivo_embalaje_detalle" ADD CONSTRAINT "instructivo_embalaje_detalle_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructivo_embalaje_detalle" ADD CONSTRAINT "instructivo_embalaje_detalle_especieId_fkey" FOREIGN KEY ("especieId") REFERENCES "especies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructivo_embalaje_detalle" ADD CONSTRAINT "instructivo_embalaje_detalle_variedadId_fkey" FOREIGN KEY ("variedadId") REFERENCES "variedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructivo_embalaje_detalle" ADD CONSTRAINT "instructivo_embalaje_detalle_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructivo_embalaje_detalle" ADD CONSTRAINT "instructivo_embalaje_detalle_calibreMinId_fkey" FOREIGN KEY ("calibreMinId") REFERENCES "calibres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructivo_embalaje_detalle" ADD CONSTRAINT "instructivo_embalaje_detalle_calibreMaxId_fkey" FOREIGN KEY ("calibreMaxId") REFERENCES "calibres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
