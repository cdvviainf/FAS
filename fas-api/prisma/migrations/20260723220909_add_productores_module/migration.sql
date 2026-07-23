-- CreateEnum
CREATE TYPE "UnidadVolumen" AS ENUM ('KG', 'CAJAS');

-- CreateEnum
CREATE TYPE "NaturalezaMovimientoCC" AS ENUM ('DEBE', 'HABER');

-- CreateEnum
CREATE TYPE "FormaAplicacionConcepto" AS ENUM ('POR_KILO', 'POR_CAJA', 'PORCENTAJE_VENTA', 'MONTO_TOTAL');

-- CreateEnum
CREATE TYPE "NaturalezaConcepto" AS ENUM ('COBRO', 'ABONO');

-- CreateTable
CREATE TABLE "predios" (
    "id" SERIAL NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "codigoCsg" TEXT,
    "nombreCsg" TEXT,
    "codigoSdp" TEXT,
    "codigoGgn" TEXT,
    "direccion" TEXT,
    "comunaId" INTEGER,
    "tipoProduccionId" INTEGER,
    "zonaId" INTEGER,
    "latitud" DECIMAL(10,7),
    "longitud" DECIMAL(10,7),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "predios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productor_contratos" (
    "id" SERIAL NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "temporadaId" INTEGER,
    "pdfNombre" TEXT,
    "pdfMime" TEXT,
    "pdfTamano" INTEGER,
    "fechaInicio" DATE,
    "fechaTermino" DATE,
    "valoresFacturacion" TEXT,
    "condicionesPago" TEXT,
    "condicionesFacturacion" TEXT,
    "volumenComprometido" DECIMAL(14,3),
    "unidadVolumen" "UnidadVolumen",
    "minimoGarantizado" DECIMAL(14,4),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "productor_contratos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productor_contratos_pdf" (
    "contratoId" INTEGER NOT NULL,
    "datos" BYTEA NOT NULL,

    CONSTRAINT "productor_contratos_pdf_pkey" PRIMARY KEY ("contratoId")
);

-- CreateTable
CREATE TABLE "movimientos_cuenta_corriente" (
    "id" SERIAL NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "tipoId" INTEGER NOT NULL,
    "naturaleza" "NaturalezaMovimientoCC" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "glosa" TEXT,
    "monto" DECIMAL(14,4) NOT NULL,
    "monedaId" INTEGER,
    "referencia" TEXT,
    "temporadaId" INTEGER,
    "usuarioId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_cuenta_corriente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conceptos_liquidacion" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "formaAplicacion" "FormaAplicacionConcepto" NOT NULL,
    "naturaleza" "NaturalezaConcepto" NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "conceptos_liquidacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conceptos_liquidacion_especie" (
    "id" SERIAL NOT NULL,
    "conceptoId" INTEGER NOT NULL,
    "especieId" INTEGER NOT NULL,
    "valor" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "conceptos_liquidacion_especie_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "predios_entidadId_idx" ON "predios"("entidadId");

-- CreateIndex
CREATE INDEX "productor_contratos_entidadId_idx" ON "productor_contratos"("entidadId");

-- CreateIndex
CREATE INDEX "movimientos_cuenta_corriente_entidadId_fecha_idx" ON "movimientos_cuenta_corriente"("entidadId", "fecha");

-- CreateIndex
CREATE INDEX "movimientos_cuenta_corriente_tipoId_idx" ON "movimientos_cuenta_corriente"("tipoId");

-- CreateIndex
CREATE INDEX "conceptos_liquidacion_especie_conceptoId_idx" ON "conceptos_liquidacion_especie"("conceptoId");

-- CreateIndex
CREATE UNIQUE INDEX "conceptos_liquidacion_especie_conceptoId_especieId_key" ON "conceptos_liquidacion_especie"("conceptoId", "especieId");

-- AddForeignKey
ALTER TABLE "predios" ADD CONSTRAINT "predios_entidadId_fkey" FOREIGN KEY ("entidadId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predios" ADD CONSTRAINT "predios_comunaId_fkey" FOREIGN KEY ("comunaId") REFERENCES "comunas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predios" ADD CONSTRAINT "predios_tipoProduccionId_fkey" FOREIGN KEY ("tipoProduccionId") REFERENCES "tipos_produccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predios" ADD CONSTRAINT "predios_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "zonas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productor_contratos" ADD CONSTRAINT "productor_contratos_entidadId_fkey" FOREIGN KEY ("entidadId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productor_contratos" ADD CONSTRAINT "productor_contratos_temporadaId_fkey" FOREIGN KEY ("temporadaId") REFERENCES "temporadas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productor_contratos_pdf" ADD CONSTRAINT "productor_contratos_pdf_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "productor_contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_cuenta_corriente" ADD CONSTRAINT "movimientos_cuenta_corriente_entidadId_fkey" FOREIGN KEY ("entidadId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_cuenta_corriente" ADD CONSTRAINT "movimientos_cuenta_corriente_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "conceptos_cta_cte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_cuenta_corriente" ADD CONSTRAINT "movimientos_cuenta_corriente_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "monedas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conceptos_liquidacion_especie" ADD CONSTRAINT "conceptos_liquidacion_especie_conceptoId_fkey" FOREIGN KEY ("conceptoId") REFERENCES "conceptos_liquidacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conceptos_liquidacion_especie" ADD CONSTRAINT "conceptos_liquidacion_especie_especieId_fkey" FOREIGN KEY ("especieId") REFERENCES "especies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
