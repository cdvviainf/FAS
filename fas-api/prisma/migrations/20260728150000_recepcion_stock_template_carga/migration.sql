-- CreateEnum
CREATE TYPE "OrigenRecepcion" AS ENUM ('COMPRA', 'CONSIGNACION');

-- CreateEnum
CREATE TYPE "EstadoRecepcion" AS ENUM ('CARGADA', 'VALIDADA', 'RECHAZADA');


-- CreateTable
CREATE TABLE "recepciones" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "ordenCompraId" INTEGER,
    "origen" "OrigenRecepcion" NOT NULL,
    "plantaId" INTEGER NOT NULL,
    "direccionPlantaId" INTEGER NOT NULL,
    "templateCargaId" INTEGER,
    "estado" "EstadoRecepcion" NOT NULL DEFAULT 'CARGADA',
    "observaciones" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "recepciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recepcion_adjuntos" (
    "id" SERIAL NOT NULL,
    "recepcionId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "subidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subidoPor" TEXT NOT NULL,

    CONSTRAINT "recepcion_adjuntos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recepcion_adjuntos_contenido" (
    "adjuntoId" INTEGER NOT NULL,
    "datos" BYTEA NOT NULL,

    CONSTRAINT "recepcion_adjuntos_contenido_pkey" PRIMARY KEY ("adjuntoId")
);

-- CreateTable
CREATE TABLE "pallets" (
    "id" SERIAL NOT NULL,
    "recepcionId" INTEGER NOT NULL,
    "numeroPallet" TEXT NOT NULL,
    "origen" "OrigenRecepcion" NOT NULL,
    "productorId" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pallet_lineas" (
    "id" SERIAL NOT NULL,
    "palletId" INTEGER NOT NULL,
    "especieId" INTEGER NOT NULL,
    "variedadId" INTEGER NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "calibreId" INTEGER NOT NULL,
    "cajas" INTEGER NOT NULL,

    CONSTRAINT "pallet_lineas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates_carga" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "tieneCabecera" BOOLEAN NOT NULL DEFAULT true,
    "filaCabecera" INTEGER,
    "filaPrimerRegistro" INTEGER NOT NULL,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3),
    "actualizadoPor" TEXT,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPor" TEXT,

    CONSTRAINT "templates_carga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates_carga_campos" (
    "id" SERIAL NOT NULL,
    "templateCargaId" INTEGER NOT NULL,
    "campo" TEXT NOT NULL,
    "columna" TEXT NOT NULL,

    CONSTRAINT "templates_carga_campos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recepciones_numero_key" ON "recepciones"("numero");

-- CreateIndex: único solo entre filas activas (no representable en el DSL de
-- Prisma) — permite recepcionar de nuevo una OC cuya Recepción anterior fue
-- eliminada (soft delete), sin perder la protección contra duplicados
-- concurrentes (QAR-RCT-004).
CREATE UNIQUE INDEX "recepciones_ordenCompraId_activa_key" ON "recepciones"("ordenCompraId") WHERE "eliminadoEn" IS NULL;

-- CreateIndex
CREATE INDEX "recepciones_plantaId_idx" ON "recepciones"("plantaId");

-- CreateIndex
CREATE INDEX "recepciones_templateCargaId_idx" ON "recepciones"("templateCargaId");

-- CreateIndex
CREATE INDEX "recepciones_eliminadoEn_idx" ON "recepciones"("eliminadoEn");

-- CreateIndex
CREATE INDEX "recepcion_adjuntos_recepcionId_idx" ON "recepcion_adjuntos"("recepcionId");

-- CreateIndex
CREATE INDEX "pallets_recepcionId_idx" ON "pallets"("recepcionId");

-- CreateIndex
CREATE INDEX "pallets_productorId_idx" ON "pallets"("productorId");

-- CreateIndex
CREATE INDEX "pallet_lineas_palletId_idx" ON "pallet_lineas"("palletId");

-- CreateIndex
CREATE INDEX "templates_carga_eliminadoEn_idx" ON "templates_carga"("eliminadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "templates_carga_campos_templateCargaId_campo_key" ON "templates_carga_campos"("templateCargaId", "campo");


ALTER TABLE "recepciones" ADD CONSTRAINT "recepciones_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "ordenes_compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recepciones" ADD CONSTRAINT "recepciones_plantaId_fkey" FOREIGN KEY ("plantaId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recepciones" ADD CONSTRAINT "recepciones_direccionPlantaId_fkey" FOREIGN KEY ("direccionPlantaId") REFERENCES "entidad_direcciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recepciones" ADD CONSTRAINT "recepciones_templateCargaId_fkey" FOREIGN KEY ("templateCargaId") REFERENCES "templates_carga"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recepcion_adjuntos" ADD CONSTRAINT "recepcion_adjuntos_recepcionId_fkey" FOREIGN KEY ("recepcionId") REFERENCES "recepciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recepcion_adjuntos_contenido" ADD CONSTRAINT "recepcion_adjuntos_contenido_adjuntoId_fkey" FOREIGN KEY ("adjuntoId") REFERENCES "recepcion_adjuntos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pallets" ADD CONSTRAINT "pallets_recepcionId_fkey" FOREIGN KEY ("recepcionId") REFERENCES "recepciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pallets" ADD CONSTRAINT "pallets_productorId_fkey" FOREIGN KEY ("productorId") REFERENCES "entidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pallet_lineas" ADD CONSTRAINT "pallet_lineas_palletId_fkey" FOREIGN KEY ("palletId") REFERENCES "pallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pallet_lineas" ADD CONSTRAINT "pallet_lineas_especieId_fkey" FOREIGN KEY ("especieId") REFERENCES "especies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pallet_lineas" ADD CONSTRAINT "pallet_lineas_variedadId_fkey" FOREIGN KEY ("variedadId") REFERENCES "variedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pallet_lineas" ADD CONSTRAINT "pallet_lineas_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pallet_lineas" ADD CONSTRAINT "pallet_lineas_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "articulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pallet_lineas" ADD CONSTRAINT "pallet_lineas_calibreId_fkey" FOREIGN KEY ("calibreId") REFERENCES "calibres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "templates_carga_campos" ADD CONSTRAINT "templates_carga_campos_templateCargaId_fkey" FOREIGN KEY ("templateCargaId") REFERENCES "templates_carga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unique partial index (G2/DoD-02, mismo patrón que el resto de mantenedores
-- con codigo): único solo entre filas activas, compatible con soft delete.
CREATE UNIQUE INDEX IF NOT EXISTS ux_templates_carga_codigo ON templates_carga (codigo) WHERE "eliminadoEn" IS NULL;

