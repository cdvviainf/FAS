-- Flag "chofer chileno" en la Guía de Despacho del Embarque: el RUT del chofer
-- solo se valida/exige si es chileno. Default true (comportamiento actual).

ALTER TABLE "embarques" ADD COLUMN "guiaChoferChileno" BOOLEAN NOT NULL DEFAULT true;
