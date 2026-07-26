/*
  Warnings:

  - You are about to drop the column `condicionesFacturacion` on the `productor_contratos` table. All the data in the column will be lost.
  - You are about to drop the column `condicionesPago` on the `productor_contratos` table. All the data in the column will be lost.
  - You are about to drop the column `minimoGarantizado` on the `productor_contratos` table. All the data in the column will be lost.
  - You are about to drop the column `pdfMime` on the `productor_contratos` table. All the data in the column will be lost.
  - You are about to drop the column `pdfNombre` on the `productor_contratos` table. All the data in the column will be lost.
  - You are about to drop the column `pdfTamano` on the `productor_contratos` table. All the data in the column will be lost.
  - You are about to drop the column `unidadVolumen` on the `productor_contratos` table. All the data in the column will be lost.
  - You are about to drop the column `valoresFacturacion` on the `productor_contratos` table. All the data in the column will be lost.
  - You are about to drop the column `volumenComprometido` on the `productor_contratos` table. All the data in the column will be lost.
  - You are about to drop the `productor_contratos_pdf` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `especieId` to the `productor_contratos` table without a default value. This is not possible if the table is not empty.
  - Made the column `temporadaId` on table `productor_contratos` required. This step will fail if there are existing NULL values in that column.
  - Made the column `fechaInicio` on table `productor_contratos` required. This step will fail if there are existing NULL values in that column.
  - Made the column `fechaTermino` on table `productor_contratos` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "productor_contratos" DROP CONSTRAINT "productor_contratos_temporadaId_fkey";

-- DropForeignKey
ALTER TABLE "productor_contratos_pdf" DROP CONSTRAINT "productor_contratos_pdf_contratoId_fkey";

-- AlterTable
ALTER TABLE "productor_contratos" DROP COLUMN "condicionesFacturacion",
DROP COLUMN "condicionesPago",
DROP COLUMN "minimoGarantizado",
DROP COLUMN "pdfMime",
DROP COLUMN "pdfNombre",
DROP COLUMN "pdfTamano",
DROP COLUMN "unidadVolumen",
DROP COLUMN "valoresFacturacion",
DROP COLUMN "volumenComprometido",
ADD COLUMN     "condicionPagoId" INTEGER,
ADD COLUMN     "especieId" INTEGER NOT NULL,
ALTER COLUMN "temporadaId" SET NOT NULL,
ALTER COLUMN "fechaInicio" SET NOT NULL,
ALTER COLUMN "fechaTermino" SET NOT NULL;

-- DropTable
DROP TABLE "productor_contratos_pdf";

-- DropEnum
DROP TYPE "UnidadVolumen";

-- CreateTable
CREATE TABLE "productor_contrato_linea" (
    "id" SERIAL NOT NULL,
    "contratoId" INTEGER NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "variedadId" INTEGER NOT NULL,
    "calibreDesdeId" INTEGER NOT NULL,
    "calibreHastaId" INTEGER NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    "unidadMedidaId" INTEGER NOT NULL,
    "cantidadComprometida" DECIMAL(14,3) NOT NULL,
    "minimoGarantizado" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "productor_contrato_linea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productor_contrato_adjuntos" (
    "id" SERIAL NOT NULL,
    "contratoId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "subidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subidoPor" TEXT NOT NULL,

    CONSTRAINT "productor_contrato_adjuntos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productor_contrato_adjuntos_contenido" (
    "adjuntoId" INTEGER NOT NULL,
    "datos" BYTEA NOT NULL,

    CONSTRAINT "productor_contrato_adjuntos_contenido_pkey" PRIMARY KEY ("adjuntoId")
);

-- CreateIndex
CREATE INDEX "productor_contrato_linea_contratoId_idx" ON "productor_contrato_linea"("contratoId");

-- CreateIndex
CREATE INDEX "productor_contrato_adjuntos_contratoId_idx" ON "productor_contrato_adjuntos"("contratoId");

-- CreateIndex
CREATE INDEX "productor_contratos_especieId_idx" ON "productor_contratos"("especieId");

-- CreateIndex
CREATE INDEX "productor_contratos_temporadaId_idx" ON "productor_contratos"("temporadaId");

-- AddForeignKey
ALTER TABLE "productor_contratos" ADD CONSTRAINT "productor_contratos_temporadaId_fkey" FOREIGN KEY ("temporadaId") REFERENCES "temporadas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productor_contratos" ADD CONSTRAINT "productor_contratos_especieId_fkey" FOREIGN KEY ("especieId") REFERENCES "especies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productor_contrato_linea" ADD CONSTRAINT "productor_contrato_linea_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "productor_contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productor_contrato_linea" ADD CONSTRAINT "productor_contrato_linea_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productor_contrato_linea" ADD CONSTRAINT "productor_contrato_linea_variedadId_fkey" FOREIGN KEY ("variedadId") REFERENCES "variedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productor_contrato_linea" ADD CONSTRAINT "productor_contrato_linea_calibreDesdeId_fkey" FOREIGN KEY ("calibreDesdeId") REFERENCES "calibres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productor_contrato_linea" ADD CONSTRAINT "productor_contrato_linea_calibreHastaId_fkey" FOREIGN KEY ("calibreHastaId") REFERENCES "calibres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productor_contrato_linea" ADD CONSTRAINT "productor_contrato_linea_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productor_contrato_linea" ADD CONSTRAINT "productor_contrato_linea_unidadMedidaId_fkey" FOREIGN KEY ("unidadMedidaId") REFERENCES "unidades_medida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productor_contrato_adjuntos" ADD CONSTRAINT "productor_contrato_adjuntos_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "productor_contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productor_contrato_adjuntos_contenido" ADD CONSTRAINT "productor_contrato_adjuntos_contenido_adjuntoId_fkey" FOREIGN KEY ("adjuntoId") REFERENCES "productor_contrato_adjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
