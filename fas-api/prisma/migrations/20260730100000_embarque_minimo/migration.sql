-- CreateTable
CREATE TABLE "embarques" (
    "id" SERIAL NOT NULL,
    "notaVentaId" INTEGER NOT NULL,
    "numeroInstructivo" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "embarques_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "embarques_numeroInstructivo_key" ON "embarques"("numeroInstructivo");

-- CreateIndex
CREATE INDEX "embarques_notaVentaId_idx" ON "embarques"("notaVentaId");

-- AddForeignKey
ALTER TABLE "embarques" ADD CONSTRAINT "embarques_notaVentaId_fkey" FOREIGN KEY ("notaVentaId") REFERENCES "notas_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
