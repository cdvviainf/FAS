-- Artículos de SERVICIO: marca facturable + afecto/exento de IVA (exento solo
-- aplica cuando facturable=true). Alimenta la Proforma a Productores.
ALTER TABLE "articulos" ADD COLUMN "facturable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "articulos" ADD COLUMN "exento" BOOLEAN NOT NULL DEFAULT false;
