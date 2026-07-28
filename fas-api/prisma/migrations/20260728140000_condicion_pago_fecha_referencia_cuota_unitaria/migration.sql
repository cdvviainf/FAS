-- CreateEnum
CREATE TYPE "FechaReferenciaPago" AS ENUM ('FACTURA', 'ZARPE', 'ENVIO_DOCUMENTOS');

-- CreateEnum
CREATE TYPE "TipoValorCuota" AS ENUM ('PORCENTAJE', 'MONTO_UNITARIO');

-- AlterTable
ALTER TABLE "condicion_pago_cuota" ADD COLUMN     "fechaReferencia" "FechaReferenciaPago" NOT NULL DEFAULT 'FACTURA',
ADD COLUMN     "monedaId" INTEGER,
ADD COLUMN     "tipoValor" "TipoValorCuota" NOT NULL DEFAULT 'PORCENTAJE',
ADD COLUMN     "unidadId" INTEGER,
ADD COLUMN     "valorUnitario" DECIMAL(14,4),
ALTER COLUMN "porcentaje" DROP NOT NULL;

-- AlterTable
ALTER TABLE "nota_venta_cuota_pago" ADD COLUMN     "fechaReferencia" "FechaReferenciaPago" NOT NULL DEFAULT 'FACTURA',
ADD COLUMN     "monedaId" INTEGER,
ADD COLUMN     "montoCalculado" DECIMAL(14,4),
ADD COLUMN     "tipoValor" "TipoValorCuota" NOT NULL DEFAULT 'PORCENTAJE',
ADD COLUMN     "unidadId" INTEGER,
ADD COLUMN     "valorUnitario" DECIMAL(14,4),
ALTER COLUMN "porcentaje" DROP NOT NULL;

-- AlterTable
ALTER TABLE "orden_compra_cuota_pago" ADD COLUMN     "fechaReferencia" "FechaReferenciaPago" NOT NULL DEFAULT 'FACTURA',
ADD COLUMN     "monedaId" INTEGER,
ADD COLUMN     "montoCalculado" DECIMAL(14,4),
ADD COLUMN     "tipoValor" "TipoValorCuota" NOT NULL DEFAULT 'PORCENTAJE',
ADD COLUMN     "unidadId" INTEGER,
ADD COLUMN     "valorUnitario" DECIMAL(14,4),
ALTER COLUMN "porcentaje" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "nota_venta_cuota_pago" ADD CONSTRAINT "nota_venta_cuota_pago_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "monedas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota_venta_cuota_pago" ADD CONSTRAINT "nota_venta_cuota_pago_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidades_medida"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condicion_pago_cuota" ADD CONSTRAINT "condicion_pago_cuota_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "monedas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condicion_pago_cuota" ADD CONSTRAINT "condicion_pago_cuota_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidades_medida"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra_cuota_pago" ADD CONSTRAINT "orden_compra_cuota_pago_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "monedas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra_cuota_pago" ADD CONSTRAINT "orden_compra_cuota_pago_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidades_medida"("id") ON DELETE SET NULL ON UPDATE CASCADE;
