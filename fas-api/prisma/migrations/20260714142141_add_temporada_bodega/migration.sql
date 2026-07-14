-- CreateEnum
CREATE TYPE "TipoBodega" AS ENUM ('MATERIALES', 'EMBARQUE', 'DESPACHO');

-- CreateTable
CREATE TABLE "temporadas" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "descripcionExtranjera" TEXT,
    "fechaInicio" DATE NOT NULL,
    "fechaTermino" DATE NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "temporadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bodegas" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "descripcionExtranjera" TEXT,
    "direccion" TEXT NOT NULL,
    "comunaId" INTEGER NOT NULL,
    "tipos" "TipoBodega"[],
    "latitud" DECIMAL(10,7),
    "longitud" DECIMAL(10,7),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "bodegas_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "bodegas" ADD CONSTRAINT "bodegas_comunaId_fkey" FOREIGN KEY ("comunaId") REFERENCES "comunas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
