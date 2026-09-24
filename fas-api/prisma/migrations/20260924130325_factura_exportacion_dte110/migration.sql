-- CreateEnum
CREATE TYPE "EstadoFacturaExportacion" AS ENUM ('BORRADOR', 'EMITIDA', 'ANULADA');

-- CreateEnum
CREATE TYPE "EstadoCuotaFacturaExportacion" AS ENUM ('PENDIENTE', 'PARCIAL', 'PAGADA', 'VENCIDA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EstadoDocumentoDte" ADD VALUE 'GENERANDO';
ALTER TYPE "EstadoDocumentoDte" ADD VALUE 'GENERADO';

-- AlterTable
ALTER TABLE "documentos_dte" ADD COLUMN     "folio" INTEGER,
ADD COLUMN     "generadoEn" TIMESTAMP(3),
ADD COLUMN     "respuestaGenerar" JSONB;

-- CreateTable
CREATE TABLE "facturas_exportacion" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "embarqueId" INTEGER NOT NULL,
    "proformaId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "monedaId" INTEGER NOT NULL,
    "condicionPagoId" INTEGER,
    "dimensionesAgrupacion" "DimensionProforma"[],
    "montoTotal" DECIMAL(14,2) NOT NULL,
    "estado" "EstadoFacturaExportacion" NOT NULL DEFAULT 'BORRADOR',
    "fechaEmision" TIMESTAMP(3),
    "tipoDte" INTEGER NOT NULL DEFAULT 110,
    "folio" INTEGER,
    "trackIdSii" TEXT,
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emitidoPorId" TEXT,
    "emitidoEn" TIMESTAMP(3),
    "actualizadoEn" TIMESTAMP(3),
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "facturas_exportacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factura_exportacion_lineas" (
    "id" SERIAL NOT NULL,
    "facturaExportacionId" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "especieId" INTEGER NOT NULL,
    "variedadId" INTEGER,
    "articuloId" INTEGER,
    "calibreId" INTEGER,
    "categoriaId" INTEGER,
    "etiquetaId" INTEGER,
    "cantidadCajas" INTEGER NOT NULL,
    "precioUnitario" DECIMAL(14,4) NOT NULL,
    "montoLinea" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "factura_exportacion_lineas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factura_exportacion_cuotas" (
    "id" SERIAL NOT NULL,
    "facturaExportacionId" INTEGER NOT NULL,
    "numeroCuota" INTEGER NOT NULL,
    "fechaReferencia" "FechaReferenciaPago" NOT NULL,
    "plazoDias" INTEGER NOT NULL,
    "montoCuota" DECIMAL(14,2) NOT NULL,
    "fechaVencimiento" TIMESTAMP(3),
    "estado" "EstadoCuotaFacturaExportacion" NOT NULL DEFAULT 'PENDIENTE',

    CONSTRAINT "factura_exportacion_cuotas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "facturas_exportacion_empresaId_embarqueId_idx" ON "facturas_exportacion"("empresaId", "embarqueId");

-- CreateIndex
CREATE INDEX "facturas_exportacion_clienteId_idx" ON "facturas_exportacion"("clienteId");

-- CreateIndex
CREATE INDEX "facturas_exportacion_proformaId_idx" ON "facturas_exportacion"("proformaId");

-- CreateIndex
CREATE INDEX "factura_exportacion_lineas_facturaExportacionId_idx" ON "factura_exportacion_lineas"("facturaExportacionId");

-- CreateIndex
CREATE INDEX "factura_exportacion_cuotas_facturaExportacionId_idx" ON "factura_exportacion_cuotas"("facturaExportacionId");

-- CreateIndex
CREATE UNIQUE INDEX "factura_exportacion_cuotas_facturaExportacionId_numeroCuota_key" ON "factura_exportacion_cuotas"("facturaExportacionId", "numeroCuota");

-- AddForeignKey
ALTER TABLE "facturas_exportacion" ADD CONSTRAINT "facturas_exportacion_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_exportacion" ADD CONSTRAINT "facturas_exportacion_empresaId_embarqueId_fkey" FOREIGN KEY ("empresaId", "embarqueId") REFERENCES "embarques"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_exportacion" ADD CONSTRAINT "facturas_exportacion_proformaId_fkey" FOREIGN KEY ("proformaId") REFERENCES "proformas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_exportacion" ADD CONSTRAINT "facturas_exportacion_empresaId_clienteId_fkey" FOREIGN KEY ("empresaId", "clienteId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_exportacion" ADD CONSTRAINT "facturas_exportacion_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "monedas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_exportacion" ADD CONSTRAINT "facturas_exportacion_empresaId_condicionPagoId_fkey" FOREIGN KEY ("empresaId", "condicionPagoId") REFERENCES "condiciones_pago"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura_exportacion_lineas" ADD CONSTRAINT "factura_exportacion_lineas_facturaExportacionId_fkey" FOREIGN KEY ("facturaExportacionId") REFERENCES "facturas_exportacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura_exportacion_lineas" ADD CONSTRAINT "factura_exportacion_lineas_especieId_fkey" FOREIGN KEY ("especieId") REFERENCES "especies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura_exportacion_lineas" ADD CONSTRAINT "factura_exportacion_lineas_variedadId_fkey" FOREIGN KEY ("variedadId") REFERENCES "variedades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura_exportacion_lineas" ADD CONSTRAINT "factura_exportacion_lineas_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "articulos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura_exportacion_lineas" ADD CONSTRAINT "factura_exportacion_lineas_calibreId_fkey" FOREIGN KEY ("calibreId") REFERENCES "calibres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura_exportacion_lineas" ADD CONSTRAINT "factura_exportacion_lineas_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura_exportacion_lineas" ADD CONSTRAINT "factura_exportacion_lineas_etiquetaId_fkey" FOREIGN KEY ("etiquetaId") REFERENCES "etiquetas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura_exportacion_cuotas" ADD CONSTRAINT "factura_exportacion_cuotas_facturaExportacionId_fkey" FOREIGN KEY ("facturaExportacionId") REFERENCES "facturas_exportacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateIndex (parcial): a lo más una Factura de Exportación ACTIVA por Embarque (CB2)
CREATE UNIQUE INDEX "facturas_exportacion_empresa_embarque_activo_key" ON "facturas_exportacion"("empresaId", "embarqueId") WHERE "eliminadoEn" IS NULL;
