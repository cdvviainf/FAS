-- Reclamos (2026-09-08, reclamos.md reconciliado contra el Embarque real).
--
-- Nota: `prisma migrate dev --create-only` generó, además de lo de abajo, un
-- lote grande de DROP/AddForeignKey sobre tablas sin relación con este
-- cambio (articulos, especies, movimientos, notas_venta, ordenes_compra,
-- predios, productor_contratos, recepciones, solicitudes_inspeccion,
-- mercados, instructivo_embalaje_detalle) — drift preexistente entre
-- `schema.prisma` y el historial real de migraciones (no introducido por
-- este cambio), detectado porque la shadow DB de Prisma se reconstruye
-- reproduciendo el historial completo. Se descartó ese ruido a propósito:
-- aplicarlo habría tocado ~15 FKs no relacionadas sin necesidad. Si esas
-- diferencias son reales, se resuelven en una migración aparte y dedicada.

-- CreateEnum
CREATE TYPE "EstadoReclamo" AS ENUM ('INGRESADO', 'VALORIZADO', 'CERRADO');

-- CreateEnum
CREATE TYPE "Procedencia" AS ENUM ('PROCEDENTE', 'IMPROCEDENTE', 'PARCIAL');

-- CreateEnum
CREATE TYPE "TipoCalculoProvision" AS ENUM ('POR_UNIDAD_CAJA', 'POR_PESO_KILO', 'MONTO_FIJO');

-- CreateEnum
CREATE TYPE "EstadoProvision" AS ENUM ('VIGENTE', 'REVERSADA');

-- CreateTable
CREATE TABLE "reclamos" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "embarqueId" INTEGER NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "monedaId" INTEGER NOT NULL,
    "fechaReclamo" DATE,
    "resumenCliente" TEXT,
    "estado" "EstadoReclamo" NOT NULL DEFAULT 'INGRESADO',
    "procedencia" "Procedencia",
    "comentarioCalidad" TEXT,
    "valorConfirmado" DECIMAL(14,4),
    "valorizadoPor" TEXT,
    "fechaValorizacion" TIMESTAMP(3),
    "temporadaId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "reclamos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reclamo_pallet_lineas" (
    "id" SERIAL NOT NULL,
    "reclamoId" INTEGER NOT NULL,
    "palletLineaId" INTEGER NOT NULL,
    "cantidadCajas" INTEGER NOT NULL,

    CONSTRAINT "reclamo_pallet_lineas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reclamo_documentos" (
    "id" SERIAL NOT NULL,
    "reclamoId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "subidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subidoPor" TEXT NOT NULL,

    CONSTRAINT "reclamo_documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reclamo_documentos_contenido" (
    "documentoId" INTEGER NOT NULL,
    "datos" BYTEA NOT NULL,

    CONSTRAINT "reclamo_documentos_contenido_pkey" PRIMARY KEY ("documentoId")
);

-- CreateTable
CREATE TABLE "provisiones" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "reclamoId" INTEGER NOT NULL,
    "tipoCalculo" "TipoCalculoProvision" NOT NULL,
    "valorUnitario" DECIMAL(12,4),
    "cantidadAfectada" DECIMAL(12,2),
    "montoFijo" DECIMAL(12,2),
    "montoCalculado" DECIMAL(12,2) NOT NULL,
    "estado" "EstadoProvision" NOT NULL DEFAULT 'VIGENTE',
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPorId" TEXT NOT NULL,
    "fechaReversa" TIMESTAMP(3),
    "reversadoPorId" TEXT,

    CONSTRAINT "provisiones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reclamos_empresaId_embarqueId_idx" ON "reclamos"("empresaId", "embarqueId");

-- CreateIndex
CREATE INDEX "reclamos_estado_idx" ON "reclamos"("estado");

-- CreateIndex
CREATE INDEX "reclamo_pallet_lineas_palletLineaId_idx" ON "reclamo_pallet_lineas"("palletLineaId");

-- CreateIndex
CREATE UNIQUE INDEX "reclamo_pallet_lineas_reclamoId_palletLineaId_key" ON "reclamo_pallet_lineas"("reclamoId", "palletLineaId");

-- CreateIndex
CREATE INDEX "reclamo_documentos_reclamoId_idx" ON "reclamo_documentos"("reclamoId");

-- CreateIndex
CREATE INDEX "provisiones_empresaId_idx" ON "provisiones"("empresaId");

-- CreateIndex
CREATE INDEX "provisiones_reclamoId_idx" ON "provisiones"("reclamoId");

-- AddForeignKey
ALTER TABLE "reclamos" ADD CONSTRAINT "reclamos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamos" ADD CONSTRAINT "reclamos_empresaId_embarqueId_fkey" FOREIGN KEY ("empresaId", "embarqueId") REFERENCES "embarques"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamos" ADD CONSTRAINT "reclamos_empresaId_clienteId_fkey" FOREIGN KEY ("empresaId", "clienteId") REFERENCES "entidades"("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamos" ADD CONSTRAINT "reclamos_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "monedas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamo_pallet_lineas" ADD CONSTRAINT "reclamo_pallet_lineas_reclamoId_fkey" FOREIGN KEY ("reclamoId") REFERENCES "reclamos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamo_pallet_lineas" ADD CONSTRAINT "reclamo_pallet_lineas_palletLineaId_fkey" FOREIGN KEY ("palletLineaId") REFERENCES "pallet_lineas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamo_documentos" ADD CONSTRAINT "reclamo_documentos_reclamoId_fkey" FOREIGN KEY ("reclamoId") REFERENCES "reclamos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamo_documentos_contenido" ADD CONSTRAINT "reclamo_documentos_contenido_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "reclamo_documentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provisiones" ADD CONSTRAINT "provisiones_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provisiones" ADD CONSTRAINT "provisiones_reclamoId_fkey" FOREIGN KEY ("reclamoId") REFERENCES "reclamos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
