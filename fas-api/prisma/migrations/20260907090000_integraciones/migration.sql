-- CreateEnum
CREATE TYPE "TipoParametroIntegracion" AS ENUM ('TEXTO', 'MAESTRO');

-- CreateEnum
CREATE TYPE "MaestroIntegracion" AS ENUM ('ENTIDAD', 'ESPECIE', 'TIPO_EMBARQUE', 'PUERTO');

-- CreateTable
CREATE TABLE "integraciones" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "url" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "integraciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integracion_parametros" (
    "id" SERIAL NOT NULL,
    "integracionId" INTEGER NOT NULL,
    "idExterno" TEXT NOT NULL,
    "tipo" "TipoParametroIntegracion" NOT NULL DEFAULT 'TEXTO',
    "maestro" "MaestroIntegracion",
    "maestroId" INTEGER,
    "valorLocal" TEXT NOT NULL DEFAULT '',
    "valorExterno" TEXT NOT NULL,
    "sensible" BOOLEAN NOT NULL DEFAULT false,
    "descripcion" TEXT,

    CONSTRAINT "integracion_parametros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integraciones_empresaId_idx" ON "integraciones"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "integraciones_empresaId_codigo_key" ON "integraciones"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "integraciones_empresaId_id_key" ON "integraciones"("empresaId", "id");

-- CreateIndex
CREATE INDEX "integracion_parametros_integracionId_idx" ON "integracion_parametros"("integracionId");

-- CreateIndex
CREATE INDEX "integracion_parametros_integracionId_idExterno_maestro_maes_idx" ON "integracion_parametros"("integracionId", "idExterno", "maestro", "maestroId");

-- CreateIndex
CREATE UNIQUE INDEX "integracion_parametros_integracionId_idExterno_valorLocal_key" ON "integracion_parametros"("integracionId", "idExterno", "valorLocal");

-- AddForeignKey
ALTER TABLE "integraciones" ADD CONSTRAINT "integraciones_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integracion_parametros" ADD CONSTRAINT "integracion_parametros_integracionId_fkey" FOREIGN KEY ("integracionId") REFERENCES "integraciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
