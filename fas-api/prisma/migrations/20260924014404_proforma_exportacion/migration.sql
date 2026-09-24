-- CreateEnum
CREATE TYPE "EstadoProforma" AS ENUM ('EMITIDA', 'ANULADA');

-- CreateEnum
CREATE TYPE "DimensionProforma" AS ENUM ('VARIEDAD', 'ARTICULO', 'CALIBRE', 'CATEGORIA', 'MARCA');

-- CreateTable
CREATE TABLE "proformas" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "embarqueId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "monedaId" INTEGER NOT NULL,
    "condicionPagoId" INTEGER,
    "idioma" TEXT NOT NULL DEFAULT 'EN',
    "dimensionesAgrupacion" "DimensionProforma"[],
    "montoTotal" DECIMAL(14,2) NOT NULL,
    "estado" "EstadoProforma" NOT NULL DEFAULT 'EMITIDA',
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3),
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "proformas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proforma_lineas" (
    "id" SERIAL NOT NULL,
    "proformaId" INTEGER NOT NULL,
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

    CONSTRAINT "proforma_lineas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proformas_empresaId_embarqueId_idx" ON "proformas"("empresaId", "embarqueId");

-- A lo más una Proforma ACTIVA por Embarque (CB2) — índice único parcial, no
-- representable en el DSL de Prisma (mismo patrón que
-- embarque_packing_lists/instructivos_hijos): permite reemitir tras "Anular"
-- (soft delete) sin perder el historial de la anterior.
CREATE UNIQUE INDEX "proformas_empresa_embarque_activo_key" ON "proformas"("empresaId", "embarqueId") WHERE "eliminadoEn" IS NULL;

-- CreateIndex
CREATE INDEX "proformas_clienteId_idx" ON "proformas"("clienteId");

-- CreateIndex
CREATE INDEX "proforma_lineas_proformaId_idx" ON "proforma_lineas"("proformaId");

-- AddForeignKey
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_empresaId_embarqueId_fkey" FOREIGN KEY ("empresaId", "embarqueId") REFERENCES "embarques"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_empresaId_clienteId_fkey" FOREIGN KEY ("empresaId", "clienteId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "monedas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_empresaId_condicionPagoId_fkey" FOREIGN KEY ("empresaId", "condicionPagoId") REFERENCES "condiciones_pago"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_lineas" ADD CONSTRAINT "proforma_lineas_proformaId_fkey" FOREIGN KEY ("proformaId") REFERENCES "proformas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_lineas" ADD CONSTRAINT "proforma_lineas_especieId_fkey" FOREIGN KEY ("especieId") REFERENCES "especies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_lineas" ADD CONSTRAINT "proforma_lineas_variedadId_fkey" FOREIGN KEY ("variedadId") REFERENCES "variedades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_lineas" ADD CONSTRAINT "proforma_lineas_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "articulos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_lineas" ADD CONSTRAINT "proforma_lineas_calibreId_fkey" FOREIGN KEY ("calibreId") REFERENCES "calibres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_lineas" ADD CONSTRAINT "proforma_lineas_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_lineas" ADD CONSTRAINT "proforma_lineas_etiquetaId_fkey" FOREIGN KEY ("etiquetaId") REFERENCES "etiquetas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

