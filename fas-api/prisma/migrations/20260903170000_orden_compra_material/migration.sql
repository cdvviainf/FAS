-- Orden de Compra de Materiales (materiales.md §4.9, R19-R23)

-- CreateEnum
CREATE TYPE "EstadoOrdenCompraMaterial" AS ENUM ('BORRADOR', 'EMITIDA', 'RECEPCIONADA');

-- AlterTable
ALTER TABLE "movimientos" ADD COLUMN     "ordenCompraMaterialId" INTEGER;

-- CreateTable
CREATE TABLE "ordenes_compra_material" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "numero" TEXT NOT NULL,
    "entidadProveedorId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "formaPagoId" INTEGER,
    "condicionPagoId" INTEGER,
    "monedaId" INTEGER NOT NULL,
    "observaciones" TEXT,
    "estado" "EstadoOrdenCompraMaterial" NOT NULL DEFAULT 'BORRADOR',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "ordenes_compra_material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orden_compra_material_linea" (
    "id" SERIAL NOT NULL,
    "ordenCompraMaterialId" INTEGER NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "precioUnitario" DECIMAL(14,4) NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "orden_compra_material_linea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orden_compra_material_cuota_pago" (
    "id" SERIAL NOT NULL,
    "ordenCompraMaterialId" INTEGER NOT NULL,
    "fechaReferencia" "FechaReferenciaPago" NOT NULL DEFAULT 'FACTURA',
    "plazoDias" INTEGER NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "orden_compra_material_cuota_pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ordenes_compra_material_entidadProveedorId_idx" ON "ordenes_compra_material"("entidadProveedorId");

-- CreateIndex
CREATE INDEX "ordenes_compra_material_condicionPagoId_idx" ON "ordenes_compra_material"("condicionPagoId");

-- CreateIndex
CREATE INDEX "ordenes_compra_material_empresaId_idx" ON "ordenes_compra_material"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_compra_material_empresaId_id_key" ON "ordenes_compra_material"("empresaId", "id");

-- CreateIndex
CREATE INDEX "orden_compra_material_linea_ordenCompraMaterialId_idx" ON "orden_compra_material_linea"("ordenCompraMaterialId");

-- CreateIndex
CREATE INDEX "orden_compra_material_linea_articuloId_idx" ON "orden_compra_material_linea"("articuloId");

-- CreateIndex
CREATE INDEX "orden_compra_material_cuota_pago_ordenCompraMaterialId_idx" ON "orden_compra_material_cuota_pago"("ordenCompraMaterialId");

-- CreateIndex
CREATE INDEX "movimientos_ordenCompraMaterialId_idx" ON "movimientos"("ordenCompraMaterialId");

-- CreateIndex (R22 — a lo más un Movimiento activo por OC, mismo patrón que recepciones_ordenCompraId_activa_key)
CREATE UNIQUE INDEX "movimientos_ordenCompraMaterialId_activa_key" ON "movimientos"("ordenCompraMaterialId") WHERE "eliminadoEn" IS NULL;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_empresaId_ordenCompraMaterialId_fkey" FOREIGN KEY ("empresaId", "ordenCompraMaterialId") REFERENCES "ordenes_compra_material"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra_material" ADD CONSTRAINT "ordenes_compra_material_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra_material" ADD CONSTRAINT "ordenes_compra_material_empresaId_entidadProveedorId_fkey" FOREIGN KEY ("empresaId", "entidadProveedorId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra_material" ADD CONSTRAINT "ordenes_compra_material_empresaId_formaPagoId_fkey" FOREIGN KEY ("empresaId", "formaPagoId") REFERENCES "formas_pago"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra_material" ADD CONSTRAINT "ordenes_compra_material_empresaId_condicionPagoId_fkey" FOREIGN KEY ("empresaId", "condicionPagoId") REFERENCES "condiciones_pago"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_compra_material" ADD CONSTRAINT "ordenes_compra_material_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "monedas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra_material_linea" ADD CONSTRAINT "orden_compra_material_linea_ordenCompraMaterialId_fkey" FOREIGN KEY ("ordenCompraMaterialId") REFERENCES "ordenes_compra_material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra_material_linea" ADD CONSTRAINT "orden_compra_material_linea_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_compra_material_cuota_pago" ADD CONSTRAINT "orden_compra_material_cuota_pago_ordenCompraMaterialId_fkey" FOREIGN KEY ("ordenCompraMaterialId") REFERENCES "ordenes_compra_material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
