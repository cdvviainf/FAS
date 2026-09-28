-- CreateTable
CREATE TABLE "articulo_codigos_equivalentes" (
    "id" SERIAL NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "articulo_codigos_equivalentes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "articulo_codigos_equivalentes_articuloId_idx" ON "articulo_codigos_equivalentes"("articuloId");

-- AddForeignKey
ALTER TABLE "articulo_codigos_equivalentes" ADD CONSTRAINT "articulo_codigos_equivalentes_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "articulos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

