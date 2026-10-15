-- Códigos alternativos para Especie / Variedad / Categoría / Calibre (2026-10-14):
-- mismo patrón que articulo_codigos_equivalentes (hijo sin empresaId, tenant vía
-- el padre). La carga de stock matchea además por estos códigos.

CREATE TABLE "especie_codigos_equivalentes" (
    "id" SERIAL NOT NULL,
    "especieId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "especie_codigos_equivalentes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "especie_codigos_equivalentes_especieId_idx" ON "especie_codigos_equivalentes"("especieId");
ALTER TABLE "especie_codigos_equivalentes" ADD CONSTRAINT "especie_codigos_equivalentes_especieId_fkey" FOREIGN KEY ("especieId") REFERENCES "especies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "variedad_codigos_equivalentes" (
    "id" SERIAL NOT NULL,
    "variedadId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "variedad_codigos_equivalentes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "variedad_codigos_equivalentes_variedadId_idx" ON "variedad_codigos_equivalentes"("variedadId");
ALTER TABLE "variedad_codigos_equivalentes" ADD CONSTRAINT "variedad_codigos_equivalentes_variedadId_fkey" FOREIGN KEY ("variedadId") REFERENCES "variedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "categoria_codigos_equivalentes" (
    "id" SERIAL NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "categoria_codigos_equivalentes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "categoria_codigos_equivalentes_categoriaId_idx" ON "categoria_codigos_equivalentes"("categoriaId");
ALTER TABLE "categoria_codigos_equivalentes" ADD CONSTRAINT "categoria_codigos_equivalentes_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "calibre_codigos_equivalentes" (
    "id" SERIAL NOT NULL,
    "calibreId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "calibre_codigos_equivalentes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "calibre_codigos_equivalentes_calibreId_idx" ON "calibre_codigos_equivalentes"("calibreId");
ALTER TABLE "calibre_codigos_equivalentes" ADD CONSTRAINT "calibre_codigos_equivalentes_calibreId_fkey" FOREIGN KEY ("calibreId") REFERENCES "calibres"("id") ON DELETE CASCADE ON UPDATE CASCADE;
