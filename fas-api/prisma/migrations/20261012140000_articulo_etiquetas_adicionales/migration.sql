-- Etiquetas adicionales permitidas de un Artículo (2026-10-12): el conjunto
-- permitido del embalaje = articulos.etiquetaId (principal) ∪ estas filas.
-- Vacío = etiqueta FIJA (heredada en Stock, no editable); con ≥1 = DINÁMICA
-- (obligatoria en la carga, elegible sólo dentro del conjunto). Hijo de
-- articulos (tenant vía el padre, sin empresaId — igual que
-- articulo_codigos_equivalentes). No requiere backfill: la etiqueta existente
-- de cada artículo sigue siendo la principal.
CREATE TABLE "articulo_etiquetas" (
    "id" SERIAL NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "etiquetaId" INTEGER NOT NULL,

    CONSTRAINT "articulo_etiquetas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "articulo_etiquetas_articuloId_etiquetaId_key" ON "articulo_etiquetas"("articuloId", "etiquetaId");
CREATE INDEX "articulo_etiquetas_articuloId_idx" ON "articulo_etiquetas"("articuloId");
CREATE INDEX "articulo_etiquetas_etiquetaId_idx" ON "articulo_etiquetas"("etiquetaId");

ALTER TABLE "articulo_etiquetas" ADD CONSTRAINT "articulo_etiquetas_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "articulos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "articulo_etiquetas" ADD CONSTRAINT "articulo_etiquetas_etiquetaId_fkey" FOREIGN KEY ("etiquetaId") REFERENCES "etiquetas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
