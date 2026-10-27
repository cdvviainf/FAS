-- Imagen de la especie para el banner de los PDF (una por especie, Bytes).
CREATE TABLE "especie_imagenes" (
    "especieId" INTEGER NOT NULL,
    "mime" TEXT NOT NULL,
    "datos" BYTEA NOT NULL,
    "subidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subidoPor" TEXT NOT NULL,

    CONSTRAINT "especie_imagenes_pkey" PRIMARY KEY ("especieId")
);

ALTER TABLE "especie_imagenes"
    ADD CONSTRAINT "especie_imagenes_especieId_fkey"
    FOREIGN KEY ("especieId") REFERENCES "especies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
