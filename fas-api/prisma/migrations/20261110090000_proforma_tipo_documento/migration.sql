-- Tipo de documento en Proformas (2026-11-09): la marca "exento" por línea de
-- la Proforma a Productor se reemplaza por el tipo de documento de la cabecera
-- (33 Factura Nacional afecta / 34 Factura Exenta), igual que el Generador DTE.
-- Decisión del usuario: todas las proformas existentes quedan como Factura
-- Nacional (33); las líneas marcadas exentas pasan a afectas. Las Facturas
-- Nacionales ya creadas no se modifican (conservan sus líneas y montos).
ALTER TABLE "proformas_material" ADD COLUMN "tipoDte" INTEGER NOT NULL DEFAULT 33;
ALTER TABLE "proformas_productor" ADD COLUMN "tipoDte" INTEGER NOT NULL DEFAULT 33;
ALTER TABLE "proforma_productor_linea" DROP COLUMN "exento";
