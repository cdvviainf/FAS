-- CreateTable
CREATE TABLE "nota_venta_cuota_pago" (
    "id" SERIAL NOT NULL,
    "notaVentaId" INTEGER NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "plazoDias" INTEGER NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "nota_venta_cuota_pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nota_venta_cuota_pago_notaVentaId_idx" ON "nota_venta_cuota_pago"("notaVentaId");

-- AddForeignKey
ALTER TABLE "nota_venta_cuota_pago" ADD CONSTRAINT "nota_venta_cuota_pago_notaVentaId_fkey" FOREIGN KEY ("notaVentaId") REFERENCES "notas_venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
