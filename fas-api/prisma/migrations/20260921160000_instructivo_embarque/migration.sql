-- Instructivo de Embarque (2026-09-21, ventas.md R11 + gap analysis contra
-- el "Instructivo de Embarque (AGA)" real del cliente). Ningún valor de
-- TipoEntidad nuevo — NAVIERA/AGENTE_ADUANA/COMPANIA_EMBARQUE/PLANTA ya
-- existían en el enum, sin uso hasta ahora.

-- AlterTable — Embarque gana los campos compartidos del Instructivo y
-- reemplaza el texto libre navieraManual por una Entidad seleccionable
-- (navieraId) — mismo dato, ya no duplicado entre reserva manual e
-- Instructivo.
ALTER TABLE "embarques"
  DROP COLUMN "navieraManual",
  ADD COLUMN "puertoZarpeId" INTEGER,
  ADD COLUMN "voyageNumber" TEXT,
  ADD COLUMN "deposito" TEXT,
  ADD COLUMN "awbBl" TEXT,
  ADD COLUMN "cutoffDate" TIMESTAMP(3),
  ADD COLUMN "tipoBultos" TEXT,
  ADD COLUMN "agenteAduanaId" INTEGER,
  ADD COLUMN "embarcadorId" INTEGER,
  ADD COLUMN "navieraId" INTEGER;

-- CreateTable
CREATE TABLE "instructivos_hijos" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "embarqueId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "secuencia" INTEGER NOT NULL,
    "plantaId" INTEGER NOT NULL,
    "fechaCargaPlanta" TIMESTAMP(3),
    "stackingDesde" TIMESTAMP(3),
    "stackingHasta" TIMESTAMP(3),
    "observaciones" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,

    CONSTRAINT "instructivos_hijos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "embarques_puertoZarpeId_idx" ON "embarques"("puertoZarpeId");
CREATE INDEX "embarques_agenteAduanaId_idx" ON "embarques"("agenteAduanaId");
CREATE INDEX "embarques_embarcadorId_idx" ON "embarques"("embarcadorId");
CREATE INDEX "embarques_navieraId_idx" ON "embarques"("navieraId");

CREATE INDEX "instructivos_hijos_embarqueId_idx" ON "instructivos_hijos"("embarqueId");
CREATE INDEX "instructivos_hijos_plantaId_idx" ON "instructivos_hijos"("plantaId");
CREATE UNIQUE INDEX "instructivos_hijos_empresaId_embarqueId_plantaId_key" ON "instructivos_hijos"("empresaId", "embarqueId", "plantaId");
CREATE UNIQUE INDEX "instructivos_hijos_empresaId_codigo_key" ON "instructivos_hijos"("empresaId", "codigo");

-- AddForeignKey
ALTER TABLE "embarques" ADD CONSTRAINT "embarques_empresaId_puertoZarpeId_fkey" FOREIGN KEY ("empresaId", "puertoZarpeId") REFERENCES "puertos"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "embarques" ADD CONSTRAINT "embarques_empresaId_agenteAduanaId_fkey" FOREIGN KEY ("empresaId", "agenteAduanaId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "embarques" ADD CONSTRAINT "embarques_empresaId_embarcadorId_fkey" FOREIGN KEY ("empresaId", "embarcadorId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "embarques" ADD CONSTRAINT "embarques_empresaId_navieraId_fkey" FOREIGN KEY ("empresaId", "navieraId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "instructivos_hijos" ADD CONSTRAINT "instructivos_hijos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "instructivos_hijos" ADD CONSTRAINT "instructivos_hijos_empresaId_embarqueId_fkey" FOREIGN KEY ("empresaId", "embarqueId") REFERENCES "embarques"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "instructivos_hijos" ADD CONSTRAINT "instructivos_hijos_empresaId_plantaId_fkey" FOREIGN KEY ("empresaId", "plantaId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
