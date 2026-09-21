-- CreateEnum
CREATE TYPE "EstadoDocumentoDte" AS ENUM ('PENDIENTE', 'TEMPORAL_CREADO', 'ERROR');

-- AlterTable
ALTER TABLE "tipos_movimiento" ADD COLUMN     "indTrasladoSii" INTEGER;

-- CreateTable
CREATE TABLE "documentos_dte" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "origenTipo" TEXT NOT NULL,
    "origenId" INTEGER NOT NULL,
    "tipoDte" INTEGER NOT NULL,
    "estado" "EstadoDocumentoDte" NOT NULL DEFAULT 'PENDIENTE',
    "libredteCodigoTemporal" TEXT,
    "rutEmisor" TEXT NOT NULL,
    "rutReceptor" TEXT NOT NULL,
    "payloadEnviado" JSONB NOT NULL,
    "errorMensaje" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,

    CONSTRAINT "documentos_dte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documentos_dte_empresaId_origenTipo_origenId_key" ON "documentos_dte"("empresaId", "origenTipo", "origenId");

-- AddForeignKey
ALTER TABLE "documentos_dte" ADD CONSTRAINT "documentos_dte_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
