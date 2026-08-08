/*
  Warnings:

  - You are about to drop the column `etiqueta` on the `articulos` table. All
    the data in the column will be lost (texto libre, sin forma automática de
    mapear a un código de mantenedor — decisión aceptada, sistema en
    desarrollo).
  - A new required relation could be inferred by the columns
    `empresaId`/`etiquetaId` on `articulos`, but it is optional (solo se
    exige a nivel de aplicación cuando `tipo = EMBALAJE`).

*/
-- CreateTable
CREATE TABLE "etiquetas" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "descripcionExtranjera" TEXT,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "etiquetas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "etiquetas_empresaId_id_key" ON "etiquetas"("empresaId", "id");

-- CreateIndex
CREATE INDEX "etiquetas_empresaId_idx" ON "etiquetas"("empresaId");

-- CreateIndex (R2/G2, mantenedores-generales.md — código único entre no eliminados)
CREATE UNIQUE INDEX "etiquetas_empresa_codigo_activo_key" ON "etiquetas"("empresaId", "codigo") WHERE "eliminadoEn" IS NULL;

-- AddForeignKey
ALTER TABLE "etiquetas" ADD CONSTRAINT "etiquetas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: articulos.etiqueta (texto libre) -> articulos.etiquetaId (FK)
ALTER TABLE "articulos" DROP COLUMN "etiqueta",
ADD COLUMN "etiquetaId" INTEGER;

-- AddForeignKey
ALTER TABLE "articulos" ADD CONSTRAINT "articulos_empresaId_etiquetaId_fkey" FOREIGN KEY ("empresaId", "etiquetaId") REFERENCES "etiquetas"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;
