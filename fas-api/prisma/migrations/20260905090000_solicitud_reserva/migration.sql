-- CreateEnum
CREATE TYPE "EstadoReservaEmbarque" AS ENUM ('PENDIENTE', 'SOLICITADA', 'CONFIRMADA');

-- AlterTable
ALTER TABLE "embarques" ADD COLUMN     "estadoReserva" "EstadoReservaEmbarque" NOT NULL DEFAULT 'PENDIENTE';

-- CreateTable
CREATE TABLE "solicitudes_reserva" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "embarqueId" INTEGER NOT NULL,
    "referenciaFas" TEXT NOT NULL,
    "payloadEnviado" JSONB NOT NULL,
    "numeroBooking" TEXT,
    "naviera" TEXT,
    "nave" TEXT,
    "numeroContenedor" TEXT,
    "fechaZarpe" TIMESTAMP(3),
    "fechaRetiroPlanta" TIMESTAMP(3),
    "payloadRespuesta" JSONB,
    "enviadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoPor" TEXT NOT NULL,
    "confirmadoEn" TIMESTAMP(3),

    CONSTRAINT "solicitudes_reserva_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitudes_reserva_empresaId_idx" ON "solicitudes_reserva"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "solicitudes_reserva_empresaId_embarqueId_key" ON "solicitudes_reserva"("empresaId", "embarqueId");

-- CreateIndex
CREATE UNIQUE INDEX "solicitudes_reserva_empresaId_referenciaFas_key" ON "solicitudes_reserva"("empresaId", "referenciaFas");

-- AddForeignKey
ALTER TABLE "solicitudes_reserva" ADD CONSTRAINT "solicitudes_reserva_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_reserva" ADD CONSTRAINT "solicitudes_reserva_empresaId_embarqueId_fkey" FOREIGN KEY ("empresaId", "embarqueId") REFERENCES "embarques"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
