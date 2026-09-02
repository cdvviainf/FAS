-- CreateTable
CREATE TABLE "recepcion_instructivos_embalaje" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "recepcionId" INTEGER NOT NULL,
    "instructivoId" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,

    CONSTRAINT "recepcion_instructivos_embalaje_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recepcion_instructivos_embalaje_empresaId_idx" ON "recepcion_instructivos_embalaje"("empresaId");

-- CreateIndex
CREATE INDEX "recepcion_instructivos_embalaje_recepcionId_idx" ON "recepcion_instructivos_embalaje"("recepcionId");

-- CreateIndex
CREATE INDEX "recepcion_instructivos_embalaje_instructivoId_idx" ON "recepcion_instructivos_embalaje"("instructivoId");

-- CreateIndex
CREATE UNIQUE INDEX "recepcion_instructivos_embalaje_empresaId_recepcionId_instr_key" ON "recepcion_instructivos_embalaje"("empresaId", "recepcionId", "instructivoId");

-- AddForeignKey
ALTER TABLE "recepcion_instructivos_embalaje" ADD CONSTRAINT "recepcion_instructivos_embalaje_empresaId_recepcionId_fkey" FOREIGN KEY ("empresaId", "recepcionId") REFERENCES "recepciones"("empresaId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepcion_instructivos_embalaje" ADD CONSTRAINT "recepcion_instructivos_embalaje_empresaId_instructivoId_fkey" FOREIGN KEY ("empresaId", "instructivoId") REFERENCES "instructivos_embalaje"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
