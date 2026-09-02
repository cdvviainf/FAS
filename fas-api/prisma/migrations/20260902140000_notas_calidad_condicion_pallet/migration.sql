-- AlterTable
ALTER TABLE "pallets" ADD COLUMN     "completo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notaCalidadId" INTEGER,
ADD COLUMN     "notaCondicionId" INTEGER;

-- CreateTable
CREATE TABLE "notas_calidad" (
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

    CONSTRAINT "notas_calidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_calidad_especie" (
    "id" SERIAL NOT NULL,
    "notaCalidadId" INTEGER NOT NULL,
    "especieId" INTEGER NOT NULL,

    CONSTRAINT "notas_calidad_especie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_condicion" (
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

    CONSTRAINT "notas_condicion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_condicion_especie" (
    "id" SERIAL NOT NULL,
    "notaCondicionId" INTEGER NOT NULL,
    "especieId" INTEGER NOT NULL,

    CONSTRAINT "notas_condicion_especie_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notas_calidad_empresaId_idx" ON "notas_calidad"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "notas_calidad_empresaId_id_key" ON "notas_calidad"("empresaId", "id");

-- CreateIndex
CREATE INDEX "notas_calidad_especie_notaCalidadId_idx" ON "notas_calidad_especie"("notaCalidadId");

-- CreateIndex
CREATE UNIQUE INDEX "notas_calidad_especie_notaCalidadId_especieId_key" ON "notas_calidad_especie"("notaCalidadId", "especieId");

-- CreateIndex
CREATE INDEX "notas_condicion_empresaId_idx" ON "notas_condicion"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "notas_condicion_empresaId_id_key" ON "notas_condicion"("empresaId", "id");

-- CreateIndex
CREATE INDEX "notas_condicion_especie_notaCondicionId_idx" ON "notas_condicion_especie"("notaCondicionId");

-- CreateIndex
CREATE UNIQUE INDEX "notas_condicion_especie_notaCondicionId_especieId_key" ON "notas_condicion_especie"("notaCondicionId", "especieId");

-- CreateIndex
CREATE INDEX "pallets_notaCalidadId_idx" ON "pallets"("notaCalidadId");

-- CreateIndex
CREATE INDEX "pallets_notaCondicionId_idx" ON "pallets"("notaCondicionId");

-- AddForeignKey
ALTER TABLE "notas_calidad" ADD CONSTRAINT "notas_calidad_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_calidad_especie" ADD CONSTRAINT "notas_calidad_especie_notaCalidadId_fkey" FOREIGN KEY ("notaCalidadId") REFERENCES "notas_calidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_calidad_especie" ADD CONSTRAINT "notas_calidad_especie_especieId_fkey" FOREIGN KEY ("especieId") REFERENCES "especies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_condicion" ADD CONSTRAINT "notas_condicion_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_condicion_especie" ADD CONSTRAINT "notas_condicion_especie_notaCondicionId_fkey" FOREIGN KEY ("notaCondicionId") REFERENCES "notas_condicion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_condicion_especie" ADD CONSTRAINT "notas_condicion_especie_especieId_fkey" FOREIGN KEY ("especieId") REFERENCES "especies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pallets" ADD CONSTRAINT "pallets_empresaId_notaCalidadId_fkey" FOREIGN KEY ("empresaId", "notaCalidadId") REFERENCES "notas_calidad"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pallets" ADD CONSTRAINT "pallets_empresaId_notaCondicionId_fkey" FOREIGN KEY ("empresaId", "notaCondicionId") REFERENCES "notas_condicion"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

