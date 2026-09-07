-- CreateEnum
CREATE TYPE "EstadoProformaMaterial" AS ENUM ('BORRADOR', 'ENVIADA_VALIDACION', 'FACTURADA', 'ANULADA');

-- AlterTable
ALTER TABLE "tipos_movimiento" ADD COLUMN     "generaProforma" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "proformas_material" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "numero" TEXT NOT NULL,
    "movimientoId" INTEGER NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "formaPagoId" INTEGER,
    "condicionPagoId" INTEGER,
    "monedaId" INTEGER NOT NULL,
    "observaciones" TEXT,
    "estado" "EstadoProformaMaterial" NOT NULL DEFAULT 'BORRADOR',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,

    CONSTRAINT "proformas_material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proforma_material_linea" (
    "id" SERIAL NOT NULL,
    "proformaMaterialId" INTEGER NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "precioUnitario" DECIMAL(14,4) NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "proforma_material_linea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proforma_material_cuota_pago" (
    "id" SERIAL NOT NULL,
    "proformaMaterialId" INTEGER NOT NULL,
    "fechaReferencia" "FechaReferenciaPago" NOT NULL DEFAULT 'FACTURA',
    "plazoDias" INTEGER NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "proforma_material_cuota_pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proformas_material_movimientoId_key" ON "proformas_material"("movimientoId");

-- CreateIndex
CREATE INDEX "proformas_material_entidadId_idx" ON "proformas_material"("entidadId");

-- CreateIndex
CREATE INDEX "proformas_material_condicionPagoId_idx" ON "proformas_material"("condicionPagoId");

-- CreateIndex
CREATE INDEX "proformas_material_empresaId_idx" ON "proformas_material"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "proformas_material_empresaId_id_key" ON "proformas_material"("empresaId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "proformas_material_empresaId_movimientoId_key" ON "proformas_material"("empresaId", "movimientoId");

-- CreateIndex
CREATE INDEX "proforma_material_linea_proformaMaterialId_idx" ON "proforma_material_linea"("proformaMaterialId");

-- CreateIndex
CREATE INDEX "proforma_material_linea_articuloId_idx" ON "proforma_material_linea"("articuloId");

-- CreateIndex
CREATE INDEX "proforma_material_cuota_pago_proformaMaterialId_idx" ON "proforma_material_cuota_pago"("proformaMaterialId");

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_empresaId_id_key" ON "movimientos"("empresaId", "id");

-- AddForeignKey
ALTER TABLE "proformas_material" ADD CONSTRAINT "proformas_material_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proformas_material" ADD CONSTRAINT "proformas_material_empresaId_movimientoId_fkey" FOREIGN KEY ("empresaId", "movimientoId") REFERENCES "movimientos"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proformas_material" ADD CONSTRAINT "proformas_material_empresaId_entidadId_fkey" FOREIGN KEY ("empresaId", "entidadId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proformas_material" ADD CONSTRAINT "proformas_material_empresaId_formaPagoId_fkey" FOREIGN KEY ("empresaId", "formaPagoId") REFERENCES "formas_pago"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proformas_material" ADD CONSTRAINT "proformas_material_empresaId_condicionPagoId_fkey" FOREIGN KEY ("empresaId", "condicionPagoId") REFERENCES "condiciones_pago"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proformas_material" ADD CONSTRAINT "proformas_material_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "monedas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_material_linea" ADD CONSTRAINT "proforma_material_linea_proformaMaterialId_fkey" FOREIGN KEY ("proformaMaterialId") REFERENCES "proformas_material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_material_linea" ADD CONSTRAINT "proforma_material_linea_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_material_cuota_pago" ADD CONSTRAINT "proforma_material_cuota_pago_proformaMaterialId_fkey" FOREIGN KEY ("proformaMaterialId") REFERENCES "proformas_material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
