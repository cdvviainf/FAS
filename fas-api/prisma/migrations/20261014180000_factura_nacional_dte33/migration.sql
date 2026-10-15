-- Facturación Nacional (DTE 33/34) desde Proforma de Materiales (2026-10-14).

-- CreateEnum
CREATE TYPE "EstadoFacturaNacional" AS ENUM ('BORRADOR', 'APROBADA', 'RECHAZADA', 'ANULADA');
CREATE TYPE "OrigenFacturaNacional" AS ENUM ('PROFORMA_MATERIAL', 'PROFORMA_PRODUCTOR', 'VENTA_NACIONAL');

-- CreateTable
CREATE TABLE "facturas_nacional" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "origenClase" "OrigenFacturaNacional" NOT NULL DEFAULT 'PROFORMA_MATERIAL',
    "proformaMaterialId" INTEGER,
    "codigo" TEXT NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "monedaId" INTEGER NOT NULL,
    "condicionPagoId" INTEGER,
    "montoNeto" DECIMAL(14,2) NOT NULL,
    "montoExento" DECIMAL(14,2) NOT NULL,
    "montoIva" DECIMAL(14,2) NOT NULL,
    "montoTotal" DECIMAL(14,2) NOT NULL,
    "idioma" TEXT NOT NULL DEFAULT 'ES',
    "estado" "EstadoFacturaNacional" NOT NULL DEFAULT 'BORRADOR',
    "fechaDocumento" TIMESTAMP(3),
    "fechaEmision" TIMESTAMP(3),
    "observaciones" TEXT,
    "errorMensajeSii" TEXT,
    "tipoDte" INTEGER NOT NULL DEFAULT 33,
    "folio" INTEGER,
    "trackIdSii" TEXT,
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emitidoPorId" TEXT,
    "emitidoEn" TIMESTAMP(3),
    "actualizadoEn" TIMESTAMP(3),
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "facturas_nacional_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "factura_nacional_lineas" (
    "id" SERIAL NOT NULL,
    "facturaNacionalId" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "articuloId" INTEGER,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "precioUnitario" DECIMAL(14,4) NOT NULL,
    "exento" BOOLEAN NOT NULL DEFAULT false,
    "montoLinea" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "factura_nacional_lineas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "facturas_nacional_empresaId_idx" ON "facturas_nacional"("empresaId");
CREATE INDEX "facturas_nacional_clienteId_idx" ON "facturas_nacional"("clienteId");
CREATE INDEX "facturas_nacional_proformaMaterialId_idx" ON "facturas_nacional"("proformaMaterialId");
-- A lo más una Factura activa por Proforma de Materiales.
CREATE UNIQUE INDEX "facturas_nacional_proforma_material_activo_key" ON "facturas_nacional"("empresaId", "proformaMaterialId") WHERE "eliminadoEn" IS NULL AND "proformaMaterialId" IS NOT NULL;
CREATE INDEX "factura_nacional_lineas_facturaNacionalId_idx" ON "factura_nacional_lineas"("facturaNacionalId");

-- AddForeignKey
ALTER TABLE "facturas_nacional" ADD CONSTRAINT "facturas_nacional_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "facturas_nacional" ADD CONSTRAINT "facturas_nacional_proformaMaterialId_fkey" FOREIGN KEY ("proformaMaterialId") REFERENCES "proformas_material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "facturas_nacional" ADD CONSTRAINT "facturas_nacional_empresaId_clienteId_fkey" FOREIGN KEY ("empresaId", "clienteId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "facturas_nacional" ADD CONSTRAINT "facturas_nacional_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "monedas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "facturas_nacional" ADD CONSTRAINT "facturas_nacional_empresaId_condicionPagoId_fkey" FOREIGN KEY ("empresaId", "condicionPagoId") REFERENCES "condiciones_pago"("empresaId", "id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "factura_nacional_lineas" ADD CONSTRAINT "factura_nacional_lineas_facturaNacionalId_fkey" FOREIGN KEY ("facturaNacionalId") REFERENCES "facturas_nacional"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "factura_nacional_lineas" ADD CONSTRAINT "factura_nacional_lineas_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
