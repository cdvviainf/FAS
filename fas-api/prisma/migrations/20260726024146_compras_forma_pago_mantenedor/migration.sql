-- CreateTable
CREATE TABLE "formas_pago" (
    "id" SERIAL NOT NULL,
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

    CONSTRAINT "formas_pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ordenes_compra_formaPagoId_idx" ON "ordenes_compra"("formaPagoId");

-- AddForeignKey
ALTER TABLE "ordenes_compra" ADD CONSTRAINT "ordenes_compra_formaPagoId_fkey" FOREIGN KEY ("formaPagoId") REFERENCES "formas_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;
