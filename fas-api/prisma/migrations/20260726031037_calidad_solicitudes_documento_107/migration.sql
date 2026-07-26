-- AlterTable
ALTER TABLE "solicitudes_inspeccion" ADD COLUMN     "calificacionId" INTEGER,
ADD COLUMN     "cantidadPallets" INTEGER,
ADD COLUMN     "clienteId" INTEGER,
ADD COLUMN     "fechaDespacho" DATE,
ADD COLUMN     "mercadoId" INTEGER;

-- CreateTable
CREATE TABLE "solicitud_inspeccion_paises" (
    "id" SERIAL NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "paisId" INTEGER NOT NULL,

    CONSTRAINT "solicitud_inspeccion_paises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_inspeccion_variedades" (
    "id" SERIAL NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "variedadId" INTEGER NOT NULL,

    CONSTRAINT "solicitud_inspeccion_variedades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_inspeccion_calibres" (
    "id" SERIAL NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "calibreId" INTEGER NOT NULL,

    CONSTRAINT "solicitud_inspeccion_calibres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_inspeccion_categorias" (
    "id" SERIAL NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "categoriaId" INTEGER NOT NULL,

    CONSTRAINT "solicitud_inspeccion_categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_inspeccion_embalajes" (
    "id" SERIAL NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "articuloId" INTEGER NOT NULL,

    CONSTRAINT "solicitud_inspeccion_embalajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calificaciones" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "descripcionExtranjera" TEXT,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "calificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "solicitud_inspeccion_paises_solicitudId_paisId_key" ON "solicitud_inspeccion_paises"("solicitudId", "paisId");

-- CreateIndex
CREATE UNIQUE INDEX "solicitud_inspeccion_variedades_solicitudId_variedadId_key" ON "solicitud_inspeccion_variedades"("solicitudId", "variedadId");

-- CreateIndex
CREATE UNIQUE INDEX "solicitud_inspeccion_calibres_solicitudId_calibreId_key" ON "solicitud_inspeccion_calibres"("solicitudId", "calibreId");

-- CreateIndex
CREATE UNIQUE INDEX "solicitud_inspeccion_categorias_solicitudId_categoriaId_key" ON "solicitud_inspeccion_categorias"("solicitudId", "categoriaId");

-- CreateIndex
CREATE UNIQUE INDEX "solicitud_inspeccion_embalajes_solicitudId_articuloId_key" ON "solicitud_inspeccion_embalajes"("solicitudId", "articuloId");

-- AddForeignKey
ALTER TABLE "solicitudes_inspeccion" ADD CONSTRAINT "solicitudes_inspeccion_mercadoId_fkey" FOREIGN KEY ("mercadoId") REFERENCES "mercados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_inspeccion" ADD CONSTRAINT "solicitudes_inspeccion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "entidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_inspeccion" ADD CONSTRAINT "solicitudes_inspeccion_calificacionId_fkey" FOREIGN KEY ("calificacionId") REFERENCES "calificaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_inspeccion_paises" ADD CONSTRAINT "solicitud_inspeccion_paises_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitudes_inspeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_inspeccion_paises" ADD CONSTRAINT "solicitud_inspeccion_paises_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "paises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_inspeccion_variedades" ADD CONSTRAINT "solicitud_inspeccion_variedades_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitudes_inspeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_inspeccion_variedades" ADD CONSTRAINT "solicitud_inspeccion_variedades_variedadId_fkey" FOREIGN KEY ("variedadId") REFERENCES "variedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_inspeccion_calibres" ADD CONSTRAINT "solicitud_inspeccion_calibres_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitudes_inspeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_inspeccion_calibres" ADD CONSTRAINT "solicitud_inspeccion_calibres_calibreId_fkey" FOREIGN KEY ("calibreId") REFERENCES "calibres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_inspeccion_categorias" ADD CONSTRAINT "solicitud_inspeccion_categorias_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitudes_inspeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_inspeccion_categorias" ADD CONSTRAINT "solicitud_inspeccion_categorias_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_inspeccion_embalajes" ADD CONSTRAINT "solicitud_inspeccion_embalajes_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitudes_inspeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_inspeccion_embalajes" ADD CONSTRAINT "solicitud_inspeccion_embalajes_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
