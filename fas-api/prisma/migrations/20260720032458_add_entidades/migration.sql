-- CreateEnum
CREATE TYPE "TipoEntidad" AS ENUM ('CLIENTE_NACIONAL', 'CLIENTE_EXTRANJERO', 'NOTIFY', 'CONSIGNATARIO', 'NAVIERA', 'AGENTE_ADUANA', 'COMPANIA_EMBARQUE', 'PROVEEDOR', 'EMPRESA_TRANSPORTE', 'PRODUCTOR', 'EXPORTADORA');

-- CreateTable
CREATE TABLE "entidades" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "descripcionExtranjera" TEXT,
    "razonSocial" TEXT NOT NULL,
    "giro" TEXT,
    "identificador" TEXT,
    "paisId" INTEGER NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "codigoExterno" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "tipos" "TipoEntidad"[],
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "entidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entidad_direcciones" (
    "id" SERIAL NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "paisId" INTEGER NOT NULL,
    "comunaId" INTEGER,
    "direccion" TEXT NOT NULL,
    "esPorDefecto" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "entidad_direcciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entidad_contactos" (
    "id" SERIAL NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "tipo" TEXT,
    "esRepresentanteLegal" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "entidad_contactos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entidades_eliminadoEn_idx" ON "entidades"("eliminadoEn");

-- CreateIndex
CREATE INDEX "entidad_direcciones_entidadId_idx" ON "entidad_direcciones"("entidadId");

-- CreateIndex
CREATE INDEX "entidad_contactos_entidadId_idx" ON "entidad_contactos"("entidadId");

-- AddForeignKey
ALTER TABLE "entidades" ADD CONSTRAINT "entidades_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "paises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entidad_direcciones" ADD CONSTRAINT "entidad_direcciones_entidadId_fkey" FOREIGN KEY ("entidadId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entidad_direcciones" ADD CONSTRAINT "entidad_direcciones_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "paises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entidad_direcciones" ADD CONSTRAINT "entidad_direcciones_comunaId_fkey" FOREIGN KEY ("comunaId") REFERENCES "comunas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entidad_contactos" ADD CONSTRAINT "entidad_contactos_entidadId_fkey" FOREIGN KEY ("entidadId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
