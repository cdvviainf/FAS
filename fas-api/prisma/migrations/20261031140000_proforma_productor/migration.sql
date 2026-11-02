-- Proforma a Productores (servicios), 2026-10-31. Análoga a la Proforma de
-- Venta de Materiales pero con líneas de SERVICIO ingresadas a mano. Genera una
-- Factura Nacional (origen PROFORMA_PRODUCTOR).

-- CreateEnum
CREATE TYPE "EstadoProformaProductor" AS ENUM ('BORRADOR', 'ENVIADA_VALIDACION', 'FACTURADA', 'ANULADA');

-- CreateTable
CREATE TABLE "proformas_productor" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "numero" TEXT NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "formaPagoId" INTEGER,
    "condicionPagoId" INTEGER,
    "monedaId" INTEGER NOT NULL,
    "observaciones" TEXT,
    "estado" "EstadoProformaProductor" NOT NULL DEFAULT 'BORRADOR',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,

    CONSTRAINT "proformas_productor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proforma_productor_linea" (
    "id" SERIAL NOT NULL,
    "proformaProductorId" INTEGER NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "precioUnitario" DECIMAL(14,4) NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "exento" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "proforma_productor_linea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proforma_productor_cuota_pago" (
    "id" SERIAL NOT NULL,
    "proformaProductorId" INTEGER NOT NULL,
    "fechaReferencia" "FechaReferenciaPago" NOT NULL DEFAULT 'FACTURA',
    "plazoDias" INTEGER NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "proforma_productor_cuota_pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proformas_productor_entidadId_idx" ON "proformas_productor"("entidadId");

-- CreateIndex
CREATE INDEX "proformas_productor_condicionPagoId_idx" ON "proformas_productor"("condicionPagoId");

-- CreateIndex
CREATE INDEX "proformas_productor_empresaId_idx" ON "proformas_productor"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "proformas_productor_empresaId_id_key" ON "proformas_productor"("empresaId", "id");

-- CreateIndex
CREATE INDEX "proforma_productor_linea_proformaProductorId_idx" ON "proforma_productor_linea"("proformaProductorId");

-- CreateIndex
CREATE INDEX "proforma_productor_linea_articuloId_idx" ON "proforma_productor_linea"("articuloId");

-- CreateIndex
CREATE INDEX "proforma_productor_cuota_pago_proformaProductorId_idx" ON "proforma_productor_cuota_pago"("proformaProductorId");

-- AddForeignKey
ALTER TABLE "proformas_productor" ADD CONSTRAINT "proformas_productor_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proformas_productor" ADD CONSTRAINT "proformas_productor_empresaId_entidadId_fkey" FOREIGN KEY ("empresaId", "entidadId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proformas_productor" ADD CONSTRAINT "proformas_productor_empresaId_formaPagoId_fkey" FOREIGN KEY ("empresaId", "formaPagoId") REFERENCES "formas_pago"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proformas_productor" ADD CONSTRAINT "proformas_productor_empresaId_condicionPagoId_fkey" FOREIGN KEY ("empresaId", "condicionPagoId") REFERENCES "condiciones_pago"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proformas_productor" ADD CONSTRAINT "proformas_productor_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "monedas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_productor_linea" ADD CONSTRAINT "proforma_productor_linea_proformaProductorId_fkey" FOREIGN KEY ("proformaProductorId") REFERENCES "proformas_productor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_productor_linea" ADD CONSTRAINT "proforma_productor_linea_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_productor_cuota_pago" ADD CONSTRAINT "proforma_productor_cuota_pago_proformaProductorId_fkey" FOREIGN KEY ("proformaProductorId") REFERENCES "proformas_productor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Factura Nacional: origen PROFORMA_PRODUCTOR.
ALTER TABLE "facturas_nacional" ADD COLUMN "proformaProductorId" INTEGER;

-- CreateIndex
CREATE INDEX "facturas_nacional_proformaProductorId_idx" ON "facturas_nacional"("proformaProductorId");

-- A lo más una Factura Nacional activa por Proforma a Productores (espeja el
-- índice parcial de proformaMaterialId / embarqueId).
CREATE UNIQUE INDEX "facturas_nacional_proforma_productor_activo_key"
  ON "facturas_nacional"("empresaId", "proformaProductorId")
  WHERE "eliminadoEn" IS NULL AND "proformaProductorId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "facturas_nacional"
  ADD CONSTRAINT "facturas_nacional_empresaId_proformaProductorId_fkey"
  FOREIGN KEY ("empresaId", "proformaProductorId") REFERENCES "proformas_productor"("empresaId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
