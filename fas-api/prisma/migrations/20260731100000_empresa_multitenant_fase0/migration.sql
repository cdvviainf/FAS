-- Fase 0 multi-empresa: modelo de Empresa + membresía de usuarios.
-- Puramente aditivo — no toca datos existentes ni agrega columnas NOT NULL
-- sobre tablas pobladas (empresaPredeterminadaId es nullable). El scoping por
-- empresaId del resto del schema llega en la fase de tenancy.

-- CreateTable
CREATE TABLE "empresas" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "nombreFantasia" TEXT,
    "rut" TEXT,
    "giro" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresa_direcciones" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "paisId" INTEGER NOT NULL,
    "comunaId" INTEGER,
    "direccion" TEXT NOT NULL,
    "esPorDefecto" BOOLEAN NOT NULL DEFAULT false,
    "latitud" DECIMAL(10,7),
    "longitud" DECIMAL(10,7),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "empresa_direcciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresa_contactos" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rut" TEXT,
    "whatsapp" TEXT,
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

    CONSTRAINT "empresa_contactos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_empresas" (
    "id" SERIAL NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,

    CONSTRAINT "usuario_empresas_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN "empresaPredeterminadaId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "empresas_codigo_key" ON "empresas"("codigo");

-- CreateIndex
CREATE INDEX "empresa_direcciones_empresaId_idx" ON "empresa_direcciones"("empresaId");

-- CreateIndex
CREATE INDEX "empresa_contactos_empresaId_idx" ON "empresa_contactos"("empresaId");

-- CreateIndex
CREATE INDEX "usuario_empresas_empresaId_idx" ON "usuario_empresas"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_empresas_usuarioId_empresaId_key" ON "usuario_empresas"("usuarioId", "empresaId");

-- CreateIndex
CREATE INDEX "usuarios_empresaPredeterminadaId_idx" ON "usuarios"("empresaPredeterminadaId");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empresaPredeterminadaId_fkey" FOREIGN KEY ("empresaPredeterminadaId") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresa_direcciones" ADD CONSTRAINT "empresa_direcciones_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresa_direcciones" ADD CONSTRAINT "empresa_direcciones_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "paises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresa_direcciones" ADD CONSTRAINT "empresa_direcciones_comunaId_fkey" FOREIGN KEY ("comunaId") REFERENCES "comunas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresa_contactos" ADD CONSTRAINT "empresa_contactos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_empresas" ADD CONSTRAINT "usuario_empresas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_empresas" ADD CONSTRAINT "usuario_empresas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
