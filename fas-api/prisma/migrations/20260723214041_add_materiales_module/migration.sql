-- CreateEnum
CREATE TYPE "TipoArticulo" AS ENUM ('EMBALAJE', 'ENVASE', 'MATERIAL_EMBALAJE', 'SERVICIO');

-- CreateEnum
CREATE TYPE "TipoCosteo" AS ENUM ('PROMEDIO_PONDERADO', 'ESTANDAR');

-- CreateEnum
CREATE TYPE "ModuloSistema" AS ENUM ('MATERIALES', 'FRUTA');

-- CreateEnum
CREATE TYPE "ClaseMovimiento" AS ENUM ('ENTRADA', 'SALIDA', 'TRASLADO');

-- CreateTable
CREATE TABLE "articulos" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoArticulo" NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "descripcionExtranjera" TEXT,
    "unidadId" INTEGER NOT NULL,
    "tipoCosteo" "TipoCosteo" NOT NULL,
    "valorEstandar" DECIMAL(14,4),
    "controlaStock" BOOLEAN NOT NULL DEFAULT true,
    "stockCritico" DECIMAL(14,3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articulos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_articulo" (
    "id" SERIAL NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "subidoPor" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_articulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_articulo_contenido" (
    "documentoId" INTEGER NOT NULL,
    "datos" BYTEA NOT NULL,

    CONSTRAINT "documentos_articulo_contenido_pkey" PRIMARY KEY ("documentoId")
);

-- CreateTable
CREATE TABLE "recetas" (
    "id" SERIAL NOT NULL,
    "embalajeId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidadAProducir" DECIMAL(14,3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recetas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receta_detalles" (
    "id" SERIAL NOT NULL,
    "recetaId" INTEGER NOT NULL,
    "componenteId" INTEGER NOT NULL,
    "cantidadAConsumir" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "receta_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_movimiento" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "modulos" "ModuloSistema"[],
    "clase" "ClaseMovimiento" NOT NULL,
    "requierePrecio" BOOLEAN NOT NULL DEFAULT false,
    "entidadRelacionada" "TipoEntidad",
    "emiteDTE" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipos_movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saldos_articulo" (
    "id" SERIAL NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "bodegaId" INTEGER NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "costoPromedio" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saldos_articulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos" (
    "id" SERIAL NOT NULL,
    "tipoMovimientoId" INTEGER NOT NULL,
    "entidadId" INTEGER,
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaMovimiento" TIMESTAMP(3) NOT NULL,
    "bodegaOrigenId" INTEGER,
    "bodegaDestinoId" INTEGER,
    "guiaReferencia" TEXT,
    "transporteEntidadId" INTEGER,
    "choferRut" TEXT,
    "choferNombre" TEXT,
    "placaCamion" TEXT,
    "placaRemolque" TEXT,
    "horaSalida" TIMESTAMP(3),
    "horaEstimadaLlegada" TIMESTAMP(3),
    "usuarioId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimiento_detalles" (
    "id" SERIAL NOT NULL,
    "movimientoId" INTEGER NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "precioUnitario" DECIMAL(14,4),

    CONSTRAINT "movimiento_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "articulos_codigo_key" ON "articulos"("codigo");

-- CreateIndex
CREATE INDEX "articulos_tipo_idx" ON "articulos"("tipo");

-- CreateIndex
CREATE INDEX "articulos_activo_idx" ON "articulos"("activo");

-- CreateIndex
CREATE INDEX "documentos_articulo_articuloId_idx" ON "documentos_articulo"("articuloId");

-- CreateIndex
CREATE UNIQUE INDEX "recetas_codigo_key" ON "recetas"("codigo");

-- CreateIndex
CREATE INDEX "recetas_embalajeId_idx" ON "recetas"("embalajeId");

-- CreateIndex
CREATE INDEX "receta_detalles_recetaId_idx" ON "receta_detalles"("recetaId");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_movimiento_codigo_key" ON "tipos_movimiento"("codigo");

-- CreateIndex
CREATE INDEX "tipos_movimiento_clase_idx" ON "tipos_movimiento"("clase");

-- CreateIndex
CREATE INDEX "saldos_articulo_articuloId_idx" ON "saldos_articulo"("articuloId");

-- CreateIndex
CREATE UNIQUE INDEX "saldos_articulo_articuloId_bodegaId_key" ON "saldos_articulo"("articuloId", "bodegaId");

-- CreateIndex
CREATE INDEX "movimientos_tipoMovimientoId_idx" ON "movimientos"("tipoMovimientoId");

-- CreateIndex
CREATE INDEX "movimientos_fechaMovimiento_idx" ON "movimientos"("fechaMovimiento");

-- CreateIndex
CREATE INDEX "movimiento_detalles_movimientoId_idx" ON "movimiento_detalles"("movimientoId");

-- CreateIndex
CREATE INDEX "movimiento_detalles_articuloId_idx" ON "movimiento_detalles"("articuloId");

-- AddForeignKey
ALTER TABLE "articulos" ADD CONSTRAINT "articulos_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidades_medida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_articulo" ADD CONSTRAINT "documentos_articulo_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_articulo_contenido" ADD CONSTRAINT "documentos_articulo_contenido_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "documentos_articulo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_embalajeId_fkey" FOREIGN KEY ("embalajeId") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receta_detalles" ADD CONSTRAINT "receta_detalles_recetaId_fkey" FOREIGN KEY ("recetaId") REFERENCES "recetas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receta_detalles" ADD CONSTRAINT "receta_detalles_componenteId_fkey" FOREIGN KEY ("componenteId") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldos_articulo" ADD CONSTRAINT "saldos_articulo_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldos_articulo" ADD CONSTRAINT "saldos_articulo_bodegaId_fkey" FOREIGN KEY ("bodegaId") REFERENCES "bodegas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_tipoMovimientoId_fkey" FOREIGN KEY ("tipoMovimientoId") REFERENCES "tipos_movimiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_entidadId_fkey" FOREIGN KEY ("entidadId") REFERENCES "entidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_bodegaOrigenId_fkey" FOREIGN KEY ("bodegaOrigenId") REFERENCES "bodegas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_bodegaDestinoId_fkey" FOREIGN KEY ("bodegaDestinoId") REFERENCES "bodegas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_transporteEntidadId_fkey" FOREIGN KEY ("transporteEntidadId") REFERENCES "entidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_detalles" ADD CONSTRAINT "movimiento_detalles_movimientoId_fkey" FOREIGN KEY ("movimientoId") REFERENCES "movimientos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_detalles" ADD CONSTRAINT "movimiento_detalles_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
