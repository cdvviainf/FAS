-- Backfill de los códigos de Aduana del SII estándar (COD-ADU-SII-002) para los
-- registros YA existentes, en todas las empresas — así no depende de correr el
-- seed. Solo las tablas pequeñas y fijas del SII; Puertos y Países se cargan con
-- los datos del cliente (la validación al enviar al SII obliga a completarlos).
-- Solo escribe donde falta (codigoAduana IS NULL), para no pisar ediciones.

-- Cláusula de Venta (tabla SII): 1=CIF, 2=C&F(CFR), 3=FOB, 5=EX-WORKS.
UPDATE "clausulas_venta" SET "codigoAduana" = '3' WHERE "codigo" = 'FOB' AND "codigoAduana" IS NULL;
UPDATE "clausulas_venta" SET "codigoAduana" = '2' WHERE "codigo" = 'CFR' AND "codigoAduana" IS NULL;
UPDATE "clausulas_venta" SET "codigoAduana" = '1' WHERE "codigo" = 'CIF' AND "codigoAduana" IS NULL;
UPDATE "clausulas_venta" SET "codigoAduana" = '5' WHERE "codigo" = 'EXW' AND "codigoAduana" IS NULL;

-- Vía de transporte (tabla SII): 1=Marítima, 4=Aéreo, 7=Carretero/Terrestre.
UPDATE "tipos_embarque" SET "codigoAduana" = '1' WHERE "codigo" = 'MARITIMO' AND "codigoAduana" IS NULL;
UPDATE "tipos_embarque" SET "codigoAduana" = '4' WHERE "codigo" = 'AEREO' AND "codigoAduana" IS NULL;
UPDATE "tipos_embarque" SET "codigoAduana" = '7' WHERE "codigo" = 'TERRESTRE' AND "codigoAduana" IS NULL;

-- Modalidad de Venta "A firme" (Parametro bajo MODALIDAD_VENTA) → código SII 1.
UPDATE "parametros" p SET "codigoAduana" = '1'
FROM "tipos_parametro" tp
WHERE p."empresaId" = tp."empresaId"
  AND p."tipoParametroId" = tp."id"
  AND tp."codigo" = 'MODALIDAD_VENTA'
  AND p."codigo" = 'FIRME'
  AND p."codigoAduana" IS NULL;
