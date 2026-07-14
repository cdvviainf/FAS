-- AlterTable
ALTER TABLE "calibres" ADD COLUMN     "control" TEXT[];

-- AlterTable
ALTER TABLE "categorias" ADD COLUMN     "control" TEXT[];

-- AlterTable
ALTER TABLE "especies" ADD COLUMN     "unidadMedidaCalidadId" INTEGER;

-- AlterTable
ALTER TABLE "temporadas" ADD COLUMN     "predeterminada" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "bodega_contactos" (
    "id" SERIAL NOT NULL,
    "bodegaId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bodega_contactos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "especies" ADD CONSTRAINT "especies_unidadMedidaCalidadId_fkey" FOREIGN KEY ("unidadMedidaCalidadId") REFERENCES "unidades_medida"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bodega_contactos" ADD CONSTRAINT "bodega_contactos_bodegaId_fkey" FOREIGN KEY ("bodegaId") REFERENCES "bodegas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
