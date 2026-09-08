-- Gestor Logístico + Solicitud de Reserva manual (2026-09-07, ventas.md
-- §4.3, generaliza el hardcode a AGL360). No se usa el valor de enum nuevo
-- en esta misma migración (mismo motivo que
-- 20260823090000_recepcion_proceso_origen: Postgres no permite usar un
-- valor de enum recién agregado en la misma transacción en que se agregó).

-- AlterEnum
ALTER TYPE "TipoEntidad" ADD VALUE 'GESTOR_LOGISTICO';

-- AlterTable — Embarque gana el gestor elegido, el flag de reserva manual y
-- los campos de booking tipeados a mano (mismo shape que
-- SolicitudReserva.numeroBooking/naviera/nave/numeroContenedor/fechaZarpe/
-- fechaRetiroPlanta, con sufijo "Manual" para no colisionar en el include
-- combinado de embarques.repository.ts).
ALTER TABLE "embarques"
  ADD COLUMN "gestorLogisticoId" INTEGER,
  ADD COLUMN "reservaManual" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "numeroBookingManual" TEXT,
  ADD COLUMN "navieraManual" TEXT,
  ADD COLUMN "naveManual" TEXT,
  ADD COLUMN "numeroContenedorManual" TEXT,
  ADD COLUMN "fechaZarpeManual" TIMESTAMP(3),
  ADD COLUMN "fechaRetiroPlantaManual" TIMESTAMP(3);

-- AlterTable — Integracion se puede vincular opcionalmente a un Gestor
-- Logístico (Entidad tipo GESTOR_LOGISTICO): si está vinculada y activa,
-- ese gestor dispara la reserva automática al generar un Embarque.
ALTER TABLE "integraciones" ADD COLUMN "gestorLogisticoId" INTEGER;

-- CreateIndex
CREATE INDEX "embarques_gestorLogisticoId_idx" ON "embarques"("gestorLogisticoId");

-- CreateIndex — unicidad real (empresaId, gestorLogisticoId); NULL múltiple
-- permitido (un gestor sin integración vinculada no colisiona con otro).
CREATE UNIQUE INDEX "integraciones_empresaId_gestorLogisticoId_key" ON "integraciones"("empresaId", "gestorLogisticoId");

-- AddForeignKey — FK compuesta (empresaId, gestorLogisticoId) -> Entidad
-- (empresaId, id), mismo patrón que notifyId/consignatarioId en NotaVenta.
ALTER TABLE "embarques" ADD CONSTRAINT "embarques_empresaId_gestorLogisticoId_fkey" FOREIGN KEY ("empresaId", "gestorLogisticoId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integraciones" ADD CONSTRAINT "integraciones_empresaId_gestorLogisticoId_fkey" FOREIGN KEY ("empresaId", "gestorLogisticoId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
